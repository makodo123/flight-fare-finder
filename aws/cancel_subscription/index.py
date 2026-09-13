"""Cancel an ECPay recurring subscription while preserving its paid period."""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import boto3

from ecpay.shared import check_mac_value, json_response, load_secret, period_end


TABLE_NAME = os.environ.get("TABLE_NAME", "subscriptions")
ECPAY_SECRET_ID = os.environ.get("ECPAY_SECRET_ID", "flight/ecpay")
STATUS_QUEUE_URL = os.environ.get("STATUS_QUEUE_URL", "")
ECPAY_ACTION_URL = os.environ.get(
    "ECPAY_ACTION_URL", "https://payment-stage.ecpay.com.tw/Cashier/CreditCardPeriodAction"
)
_table = boto3.resource("dynamodb").Table(TABLE_NAME)
_sqs = boto3.client("sqs")
_secrets = boto3.client("secretsmanager")


def handler(event, _context):
    try:
        payload = json.loads(event.get("body") or "{}")
        email = str(payload.get("email", "")).strip().lower()
        route = str(payload.get("route", "")).strip().upper()
    except json.JSONDecodeError:
        return json_response(400, {"error": "invalid cancellation payload"})
    if not email or not route:
        return json_response(400, {"error": "email and route are required"})
    item = _table.get_item(Key={"email": email, "route": route}).get("Item")
    if not item:
        return json_response(404, {"error": "subscription not found"})
    if item.get("subscription_status") == "cancelled":
        return json_response(200, item)

    secret = load_secret(_secrets, ECPAY_SECRET_ID)
    if item.get("merchant_trade_no"):
        request_time = str(int(datetime.now(timezone.utc).timestamp()))
        params = {
            "MerchantID": str(secret.get("merchant_id") or secret.get("MerchantID")),
            "MerchantTradeNo": item["merchant_trade_no"],
            "Action": "Cancel",
            # ECPay rejects periodic-action calls outside its short validation
            # window. TimeStamp must also be included in CheckMacValue.
            "TimeStamp": request_time,
        }
        params["CheckMacValue"] = check_mac_value(params, secret)
        request = urllib.request.Request(
            ECPAY_ACTION_URL,
            data=urllib.parse.urlencode(params).encode("utf-8"),
            headers={"content-type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as result:
                raw_response = result.read().decode("utf-8", "replace")
            try:
                response_params = json.loads(raw_response)
            except json.JSONDecodeError:
                response_params = {
                    key: values[-1]
                    for key, values in urllib.parse.parse_qs(raw_response, keep_blank_values=True).items()
                }
            rtn_code = str(response_params.get("RtnCode", ""))
            if rtn_code != "1":
                rtn_message = str(response_params.get("RtnMsg", ""))[:160]
                print(f"ECPay cancellation declined: RtnCode={rtn_code}, RtnMsg={rtn_message}")
                return json_response(502, {"error": "ECPay could not cancel this subscription"})
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            print(f"ECPay cancellation failed: {type(error).__name__}")
            return json_response(502, {"error": "ECPay could not cancel this subscription"})

    now = datetime.now(timezone.utc)
    end = item.get("current_period_end") or period_end(now)
    _table.update_item(
        Key={"email": email, "route": route},
        UpdateExpression="SET subscription_status=:cancelled, current_period_end=:end, cancelled_at=:now, updated_at=:now",
        ExpressionAttributeValues={":cancelled": "cancelled", ":end": end, ":now": now.isoformat()},
    )
    if STATUS_QUEUE_URL:
        _sqs.send_message(
            QueueUrl=STATUS_QUEUE_URL,
            MessageBody=json.dumps({"event_type": "cancel", "email": email, "route": route, "current_period_end": end}),
        )
    return json_response(
        200,
        {
            "email": email,
            "route": route,
            "target_price": int(item["target_price"]),
            "currency": item.get("currency", "TWD"),
            "subscription_status": "cancelled",
            "current_period_end": end,
            "updated_at": now.isoformat(),
        },
    )
