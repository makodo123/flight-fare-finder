"""Handle ECPay recurring-period callbacks and renew valid subscriptions."""

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
    for item in _table.scan().get("Items", []):
        if item.get("merchant_trade_no") == trade_no:
            return item
    return None


def handler(event, _context):
    params = form_params(event)
    secret = load_secret(_secrets, ECPAY_SECRET_ID)
    if (
        not valid_check_mac(params, secret)
        or str(params.get("MerchantID", "")) != secret_merchant_id(secret)
        or str(params.get("SimulatePaid", "")) == "1"
        or str(params.get("RtnCode", "")) != "1"
    ):
        print("ECPay period ignored: validation or payment status did not pass")
        return callback_response()
    item = find_subscription(params)
    if not item:
        return callback_response()

    now = datetime.now(timezone.utc)
    exec_times = int(params.get("ExecTimes", "0") or 0)
    successful_times = int(params.get("TotalSuccessTimes", "0") or 0)
    ended = exec_times > 0 and successful_times >= exec_times
    new_status = "expired" if ended else "active"
    end = item.get("current_period_end") if ended else period_end(now)
    _table.update_item(
        Key={"email": item["email"], "route": item["route"]},
        UpdateExpression="SET subscription_status=:status, current_period_end=:end, updated_at=:now",
        ExpressionAttributeValues={":status": new_status, ":end": end, ":now": now.isoformat()},
    )
    if new_status == "active" and STATUS_QUEUE_URL:
        _sqs.send_message(
            QueueUrl=STATUS_QUEUE_URL,
            MessageBody=json.dumps(
                {
                    "event_type": "welcome",
                    # TotalSuccessTimes is stable for retries of the same
                    # renewal and advances for each successfully paid period.
                    "notification_id": f"{item.get('merchant_trade_no', '')}-{successful_times}",
                    "email": item["email"],
                    "route": item["route"],
                    "target_price": int(item["target_price"]),
                    "current_period_end": end,
                }
            ),
        )
    return callback_response()
