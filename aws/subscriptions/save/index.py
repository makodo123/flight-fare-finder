"""Create or update a paid recurring route subscription through ECPay."""

import html
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3

from ecpay.shared import check_mac_value, json_response, load_secret, secret_merchant_id


TABLE_NAME = os.environ.get("TABLE_NAME", "subscriptions")
ECPAY_SECRET_ID = os.environ.get("ECPAY_SECRET_ID", "flight/ecpay")
API_BASE_URL = os.environ.get("PUBLIC_API_BASE_URL", "").rstrip("/")
SITE_URL = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
ECPAY_CHECKOUT_URL = os.environ.get(
    "ECPAY_CHECKOUT_URL", "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"
)
PLANS = {
    "TPE-TYO": {"plan_name": "tokyo", "origin": "TPE", "destination": "TYO"},
    "TPE-SEL": {"plan_name": "seoul", "origin": "TPE", "destination": "SEL"},
    "TPE-LON": {"plan_name": "london", "origin": "TPE", "destination": "LON"},
}
_table = boto3.resource("dynamodb").Table(TABLE_NAME)
_secrets = boto3.client("secretsmanager")
TAIPEI_TZ = timezone(timedelta(hours=8))


def response(status, body):
    return json_response(status, body)


def next_trade_no():
    return f"FP{datetime.now(timezone.utc):%y%m%d%H%M%S}{secrets.token_hex(3)}"[:20]


def current_status(item):
    status = item.get("subscription_status")
    if status in {"active", "pending_payment", "cancelled", "expired"}:
        return status
    return "expired"


def is_cancelled_in_grace(item):
    if current_status(item) != "cancelled":
        return False
    try:
        end = datetime.fromisoformat(str(item.get("current_period_end", "")).replace("Z", "+00:00"))
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        return end >= datetime.now(timezone.utc)
    except ValueError:
        return False


def update_route(item, email, route, plan, target_price, now):
    status = current_status(item) if item else "pending_payment"
    if status == "cancelled" and not is_cancelled_in_grace(item):
        status = "pending_payment"
    _table.update_item(
        Key={"email": email, "route": route},
        UpdateExpression=(
            "SET plan_name=:plan_name, origin=:origin, destination=:destination, "
            "target_price=:target_price, currency=:currency, subscription_status=:status, "
            "updated_at=:now, created_at=if_not_exists(created_at,:now)"
        ),
        ExpressionAttributeValues={
            ":plan_name": plan["plan_name"],
            ":origin": plan["origin"],
            ":destination": plan["destination"],
            ":target_price": Decimal(str(target_price)),
            ":currency": "TWD",
            ":status": status,
            ":now": now,
        },
    )
    return status


def checkout_form(email, route, target_price, secret, now):
    merchant_trade_no = next_trade_no()
    amount = str(secret.get("amount", target_price))
    params = {
        "MerchantID": secret_merchant_id(secret),
        "MerchantTradeNo": merchant_trade_no,
        "MerchantTradeDate": now.astimezone(TAIPEI_TZ).strftime("%Y/%m/%d %H:%M:%S"),
        "PaymentType": "aio",
        "TotalAmount": amount,
        "TradeDesc": "Flight Price Notifier subscription",
        "ItemName": f"Flight Price Notifier {route} monthly subscription",
        "ReturnURL": f"{API_BASE_URL}/ecpay-return",
        "ChoosePayment": "Credit",
        "EncryptType": "1",
        "OrderResultURL": f"{API_BASE_URL}/ecpay-result",
        "CustomField1": email,
        "CustomField2": route,
        "CustomField3": "",
        "CustomField4": "",
        "PeriodAmount": amount,
        "PeriodType": "M",
        "Frequency": "1",
        "ExecTimes": "999",
        "PeriodReturnURL": f"{API_BASE_URL}/ecpay-period",
    }
    params["CheckMacValue"] = check_mac_value(params, secret)
    hidden = "".join(
        f'<input type="hidden" name="{html.escape(str(key), quote=True)}" value="{html.escape(str(value), quote=True)}">'
        for key, value in params.items()
    )
    document = (
        "<!doctype html><html lang=\"zh-Hant\"><head><meta charset=\"utf-8\">"
        "<title>Redirecting to payment</title></head><body>"
        f'<form method="post" action="{html.escape(ECPAY_CHECKOUT_URL, quote=True)}">{hidden}</form>'
        "<p>Redirecting to secure payment…</p><script>document.forms[0].submit();</script>"
        "</body></html>"
    )
    return merchant_trade_no, document


def handler(event, _context):
    try:
        payload = json.loads(event.get("body") or "{}")
        email = str(payload.get("email", "")).strip().lower()
        route = str(payload.get("route", "")).strip().upper()
        target_price = int(payload.get("target_price"))
        if not email or route not in PLANS or target_price < 1:
            return response(400, {"error": "email, a supported route, and a positive target_price are required"})
    except (TypeError, ValueError, json.JSONDecodeError):
        return response(400, {"error": "invalid subscription payload"})

    existing = _table.get_item(Key={"email": email, "route": route}).get("Item") or {}
    plan = PLANS[route]
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    status = current_status(existing)

    if status == "active" or is_cancelled_in_grace(existing):
        status = update_route(existing, email, route, plan, target_price, now_iso)
        return response(
            200,
            {
                "email": email,
                "route": route,
                "target_price": target_price,
                "currency": "TWD",
                "subscription_status": status,
                "current_period_end": existing.get("current_period_end"),
                "updated_at": now_iso,
            },
        )

    secret = load_secret(_secrets, ECPAY_SECRET_ID)
    merchant_trade_no, document = checkout_form(email, route, target_price, secret, now)
    _table.update_item(
        Key={"email": email, "route": route},
        UpdateExpression=(
            "SET plan_name=:plan_name, origin=:origin, destination=:destination, "
            "target_price=:target_price, currency=:currency, subscription_status=:status, "
            "merchant_trade_no=:trade_no, updated_at=:now, created_at=if_not_exists(created_at,:now)"
        ),
        ExpressionAttributeValues={
            ":plan_name": plan["plan_name"],
            ":origin": plan["origin"],
            ":destination": plan["destination"],
            ":target_price": Decimal(str(target_price)),
            ":currency": "TWD",
            ":status": "pending_payment",
            ":trade_no": merchant_trade_no,
            ":now": now_iso,
        },
    )
    return {
        "statusCode": 200,
        "headers": {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"},
        "body": document,
    }
