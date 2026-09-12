"""Consume a matched fare, de-duplicate it, and send one Resend alert."""

import html
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key


HISTORY_TABLE = os.environ.get("HISTORY_TABLE", "notification_history")
RESEND_SECRET_ID = os.environ.get("RESEND_SECRET_ID", "flight/resend")
FLOOR_HOURS = int(os.environ.get("NOTIFY_FLOOR_HOURS", "24"))
REALERT_PCT = Decimal(os.environ.get("REALERT_PCT", "20"))
REALERT_ABS_TWD = Decimal(os.environ.get("REALERT_ABS_TWD", "2000"))
USER_AGENT = "Mozilla/5.0 (compatible; flight-notifier/1.0)"

_history = boto3.resource("dynamodb").Table(HISTORY_TABLE)
_secrets = boto3.client("secretsmanager")


def route_label(route: str) -> str:
    return {"TPE-TYO": "台北 → 東京", "TPE-SEL": "台北 → 首爾"}.get(route, route.replace("-", " → "))


def booking_url(route: str, fare: dict) -> str:
    origin, destination = route.split("-", 1)
    depart = (fare.get("depart_date") or "")[8:10] + (fare.get("depart_date") or "")[5:7]
    returning = (fare.get("return_date") or "")[8:10] + (fare.get("return_date") or "")[5:7]
    if len(depart) == 4 and len(returning) == 4:
        return f"https://www.aviasales.com/search/{origin}{depart}{destination}{returning}"
    return "https://www.aviasales.com/"


def email_parts(route: str, fare: dict, target_price: int, usd_price: int | None):
    label = route_label(route)
    price = int(fare["price"])
    subject = f"✈️ {label} 降價通知！NT${price:,} 已達標"
    usd_line = f"<p>約 US${usd_price:,}</p>" if usd_price is not None else ""
    text_usd = f"\n約 US${usd_price:,}" if usd_price is not None else ""
    link = booking_url(route, fare)
    airline = html.escape(str(fare.get("airline") or ""))
    html_body = (
        f"<h1>{html.escape(label)} 票價已達標</h1>"
        f"<p><strong>NT${price:,}</strong>（你的目標：NT${target_price:,}）</p>"
        f"{usd_line}<p>{airline}</p>"
        f'<p><a href="{html.escape(link, quote=True)}">立即訂購</a></p>'
    )
    text_body = f"{label} 票價已達標：NT${price:,}（你的目標：NT${target_price:,}）{text_usd}\n立即訂購：{link}"
    return subject, html_body, text_body


def should_send(pk: str, new_price: Decimal) -> bool:
    response = _history.query(KeyConditionExpression=Key("pk").eq(pk), ScanIndexForward=False, Limit=1)
    latest = response.get("Items", [])
    if not latest:
        return True
    last = latest[0]
    sent_at = datetime.fromisoformat(last["sent_at"].replace("Z", "+00:00"))
    if (datetime.now(timezone.utc) - sent_at).total_seconds() >= FLOOR_HOURS * 3600:
        return True
    old_price = Decimal(str(last["price"]))
    return new_price <= old_price * (Decimal("1") - REALERT_PCT / Decimal("100")) or old_price - new_price >= REALERT_ABS_TWD


def send_email(secret: dict, recipient: str, subject: str, html_body: str, text_body: str) -> bool:
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps({"from": secret["from"], "to": recipient, "subject": subject, "html": html_body, "text": text_body}).encode("utf-8"),
        headers={"Authorization": f"Bearer {secret['api_key']}", "Content-Type": "application/json", "User-Agent": USER_AGENT},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return 200 <= response.status < 300
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:300]
        if error.code in (403, 422):
            print(f"permanent Resend failure ({error.code}); dropping: {detail}")
            return False
        raise


def process(message: dict, secret: dict):
    email = message["email"]
    route = message["route"]
    fare = message["cheapest"]
    price = Decimal(str(fare["price"]))
    pk = f"{email}#{route}"
    if not should_send(pk, price):
        print(f"{pk}: skipped (deduped)")
        return
    usd = message.get("cheapest_usd") or {}
    subject, html_body, text_body = email_parts(route, fare, int(message["target_price"]), int(usd["price"]) if "price" in usd else None)
    if not send_email(secret, email, subject, html_body, text_body):
        return
    _history.put_item(Item={"pk": pk, "sent_at": datetime.now(timezone.utc).isoformat(), "price": price, "email": email, "route": route})
    print(f"{pk}: sent NT${int(price):,}")


def handler(event, _context):
    secret = json.loads(_secrets.get_secret_value(SecretId=RESEND_SECRET_ID)["SecretString"])
    for record in event.get("Records", []):
        process(json.loads(record["body"]), secret)
    return {"ok": True}
