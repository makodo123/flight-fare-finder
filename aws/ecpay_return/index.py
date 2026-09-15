"""Handle ECPay's first successful recurring-payment callback."""

import json
import os
from datetime import datetime, timezone

import boto3

from ecpay.shared import callback_response, form_params, load_secret, period_end, secret_merchant_id, valid_check_mac


TABLE_NAME = os.environ.get("TABLE_NAME", "subscriptions")
ECPAY_SECRET_ID = os.environ.get("ECPAY_SECRET_ID", "flight/ecpay")
STATUS_QUEUE_URL = os.environ.get("STATUS_QUEUE_URL", "")
_table = boto3.resource("dynamodb").Table(TABLE_NAME)
_sqs = boto3.client("sqs")
_secrets = boto3.client("secretsmanager")


def find_subscription(params):
    email = str(params.get("CustomField1", "")).strip().lower()
    route = str(params.get("CustomField2", "")).strip().upper()
    if email and route:
        item = _table.get_item(Key={"email": email, "route": route}).get("Item")
        if item:
            return item
    trade_no = params.get("MerchantTradeNo")
    if not trade_no:
        return None
    scan = _table.scan()
    for item in scan.get("Items", []):
        if item.get("merchant_trade_no") == trade_no:
            return item
    return None


def handler(event, _context):
    params = form_params(event)
    secret = load_secret(_secrets, ECPAY_SECRET_ID)
    if (
        not valid_check_mac(params, secret)
        or str(params.get("MerchantID", "")) != secret_merchant_id(secret)
        or str(params.get("RtnCode", "")) != "1"
        or str(params.get("SimulatePaid", "")) == "1"
    ):
        print("ECPay return ignored: validation or payment status did not pass")
        return callback_response()

    item = find_subscription(params)
    if not item:
        print("ECPay return ignored: subscription was not found")
        return callback_response()
    email = item["email"]
    route = item["route"]
    now = datetime.now(timezone.utc)
    already_active = item.get("subscription_status") == "active" and item.get("merchant_trade_no") == params.get("MerchantTradeNo")
    end = period_end(now)
    _table.update_item(
        Key={"email": email, "route": route},
        UpdateExpression="SET subscription_status=:active, current_period_end=:end, merchant_trade_no=:trade_no, updated_at=:now",
        ExpressionAttributeValues={
            ":active": "active",
            ":end": end,
            ":trade_no": params.get("MerchantTradeNo", item.get("merchant_trade_no")),
            ":now": now.isoformat(),
        },
    )
    if not already_active and STATUS_QUEUE_URL:
        _sqs.send_message(
            QueueUrl=STATUS_QUEUE_URL,
            MessageBody=json.dumps(
                {
                    "event_type": "welcome",
                    # The ECPay trade number is unique for each fresh checkout.
                    # It lets the consumer distinguish a re-subscription from
                    # a retry of an earlier callback for the same route.
                    "notification_id": str(params.get("MerchantTradeNo", item.get("merchant_trade_no", ""))),
                    "email": email,
                    "route": route,
                    "target_price": int(item["target_price"]),
                    "current_period_end": end,
                }
            ),
        )
    return callback_response()
