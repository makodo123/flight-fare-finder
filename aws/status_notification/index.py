"""Send one Resend message for each welcome or cancellation event."""

import html
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key


HISTORY_TABLE = os.environ.get("HISTORY_TABLE", "notification_history")
RESEND_SECRET_ID = os.environ.get("RESEND_SECRET_ID", "flight/resend")
_history = boto3.resource("dynamodb").Table(HISTORY_TABLE)
_secrets = boto3.client("secretsmanager")


def route_label(route):
    return {"TPE-TYO": "台北 → 東京", "TPE-SEL": "台北 → 首爾", "TPE-LON": "台北 → 倫敦"}.get(route, route)


def already_sent(pk):
    return bool(_history.query(KeyConditionExpression=Key("pk").eq(pk), Limit=1).get("Items"))


def send_email(secret, recipient, subject, html_body, text_body):
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps({"from": secret["from"], "to": recipient, "subject": subject, "html": html_body, "text": text_body}).encode("utf-8"),
        headers={"Authorization": f"Bearer {secret['api_key']}", "Content-Type": "application/json"},
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


def handler(event, _context):
    secret = json.loads(_secrets.get_secret_value(SecretId=RESEND_SECRET_ID)["SecretString"])
    for record in event.get("Records", []):
        message = json.loads(record["body"])
        event_type = message.get("event_type")
        if event_type not in {"welcome", "cancel"}:
            continue
        email = str(message["email"]).strip().lower()
        route = str(message["route"]).upper()
        pk = f"status#{email}#{route}#{event_type}"
        if already_sent(pk):
            continue
        label = html.escape(route_label(route))
        end = html.escape(str(message.get("current_period_end", "")))
        if event_type == "welcome":
            subject = f"✈️ {route_label(route)} 訂閱成功"
            html_body = f"<h1>訂閱成功</h1><p>{label} 已開始監控。</p><p>有效至：{end}</p>"
            text_body = f"{route_label(route)} 訂閱成功，已開始監控。有效至：{end}"
        else:
            subject = f"{route_label(route)} 訂閱已取消"
            html_body = f"<h1>訂閱已取消</h1><p>{label} 將持續有效至：{end}</p>"
            text_body = f"{route_label(route)} 訂閱已取消，將持續有效至：{end}"
        if send_email(secret, email, subject, html_body, text_body):
            _history.put_item(Item={"pk": pk, "sent_at": datetime.now(timezone.utc).isoformat(), "email": email, "route": route, "event_type": event_type})
    return {"ok": True}
