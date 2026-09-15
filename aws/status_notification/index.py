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
        # Resend rejects direct HTTP requests without a User-Agent (HTTP 403,
        # error 1010), so include a stable identifier for this Lambda client.
        headers={
            "Authorization": f"Bearer {secret['api_key']}",
            "Content-Type": "application/json",
            "User-Agent": "flight-fare-finder-status-notification/1.0",
        },
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
        # A person may cancel and later start a new subscription for the same
        # route.  Preserve idempotency for retries of one SQS message, while
        # allowing each distinct subscription/payment event to send its own
        # welcome email.
        notification_id = str(message.get("notification_id", "")).strip()
        pk = f"status#{email}#{route}#{event_type}"
        if notification_id:
            pk = f"{pk}#{notification_id}"
        if already_sent(pk):
            continue
        label = html.escape(route_label(route))
        end = html.escape(str(message.get("current_period_end", "")))
        if event_type == "welcome":
            subject = f"歡迎訂閱 Flight Price Notifier ✈️ ({route})"
            html_body = f"""<!doctype html>
<html lang="zh-Hant"><body style="margin:0;background:#f6f8fb;color:#202124;font-family:Arial,'Noto Sans TC',sans-serif;">
  <main style="max-width:620px;margin:32px auto;padding:36px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;">
    <h1 style="margin:0 0 24px;font-size:26px;">訂閱成功！Welcome aboard ✈️</h1>
    <p style="font-size:16px;line-height:1.7;">你已成功訂閱 <strong>{label}</strong> 航線的降價通知。當票價達到你的目標價，我們會立刻寄信通知你。</p>
    <p style="font-size:16px;line-height:1.7;">You're now subscribed to price-drop alerts for <strong>{label}</strong>. We'll email you the moment the fare hits your target.</p>
    <p style="font-size:16px;line-height:1.7;">隨時可在會員中心取消訂閱。</p>
    <p style="margin:28px 0 0;color:#6b7280;font-size:13px;">訂閱有效至：{end}</p>
  </main>
</body></html>"""
            text_body = (
                f"訂閱成功！Welcome aboard ✈️\n\n"
                f"你已成功訂閱 {route_label(route)} 航線的降價通知。當票價達到你的目標價，我們會立刻寄信通知你。\n\n"
                f"You're now subscribed to price-drop alerts for {route_label(route)}. "
                "We'll email you the moment the fare hits your target.\n\n"
                f"隨時可在會員中心取消訂閱。\n訂閱有效至：{end}"
            )
        else:
            subject = f"{route_label(route)} 訂閱已取消"
            html_body = f"<h1>訂閱已取消</h1><p>{label} 將持續有效至：{end}</p>"
            text_body = f"{route_label(route)} 訂閱已取消，將持續有效至：{end}"
        if send_email(secret, email, subject, html_body, text_body):
            _history.put_item(Item={"pk": pk, "sent_at": datetime.now(timezone.utc).isoformat(), "email": email, "route": route, "event_type": event_type})
    return {"ok": True}
