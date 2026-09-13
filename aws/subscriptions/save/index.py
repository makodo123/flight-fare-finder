"""Create or update a free M1 route subscription."""

import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3


TABLE_NAME = os.environ.get("TABLE_NAME", "subscriptions")
PLANS = {
    "TPE-TYO": {"plan_name": "tokyo", "origin": "TPE", "destination": "TYO"},
    "TPE-SEL": {"plan_name": "seoul", "origin": "TPE", "destination": "SEL"},
    "TPE-LON": {"plan_name": "london", "origin": "TPE", "destination": "LON"},
}
_table = boto3.resource("dynamodb").Table(TABLE_NAME)


def response(status: int, body: dict):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


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

    plan = PLANS[route]
    now = datetime.now(timezone.utc).isoformat()
    _table.update_item(
        Key={"email": email, "route": route},
        UpdateExpression=(
            "SET plan_name=:plan_name, origin=:origin, destination=:destination, "
            "target_price=:target_price, currency=:currency, updated_at=:now, "
            "created_at=if_not_exists(created_at,:now)"
        ),
        ExpressionAttributeValues={
            ":plan_name": plan["plan_name"],
            ":origin": plan["origin"],
            ":destination": plan["destination"],
            ":target_price": Decimal(str(target_price)),
            ":currency": "TWD",
            ":now": now,
        },
    )
    return response(
        200,
        {"email": email, "route": route, "target_price": target_price, "currency": "TWD", "updated_at": now},
    )
