"""Fetch one fare route and enqueue subscribers whose TWD target is met."""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr


QUEUE_URL = os.environ["QUEUE_URL"]
SUBSCRIPTIONS_TABLE = os.environ.get("SUBSCRIPTIONS_TABLE", "subscriptions")
SECRET_ID = os.environ.get("TRAVELPAYOUTS_SECRET_ID", "flight/travelpayouts")
USER_AGENT = "Mozilla/5.0 (compatible; flight-notifier/1.0)"

_dynamodb = boto3.resource("dynamodb")
_subscriptions = _dynamodb.Table(SUBSCRIPTIONS_TABLE)
_sqs = boto3.client("sqs")
_secrets = boto3.client("secretsmanager")


def next_month() -> str:
    today = date.today()
    year = today.year + (today.month == 12)
    month = 1 if today.month == 12 else today.month + 1
    return f"{year:04d}-{month:02d}"


def fetch_cheapest(origin: str, destination: str, month: str, token: str, currency: str):
    query = urllib.parse.urlencode(
        {
            "origin": origin,
            "destination": destination,
            "depart_date": month,
            "currency": currency,
            "token": token,
        }
    )
    request = urllib.request.Request(
        f"https://api.travelpayouts.com/v1/prices/cheap?{query}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read())
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        print(f"Travelpayouts {currency.upper()} request skipped: {type(error).__name__}")
        return None

    offers = payload.get("data", {}).get(destination, {}) if payload.get("success") else {}
    if not offers:
        return None

    best = min(offers.values(), key=lambda offer: offer["price"])
    return {
        "price": int(best["price"]),
        "currency": currency.upper(),
        "airline": best.get("airline"),
        "depart_date": best.get("departure_at"),
        "return_date": best.get("return_at"),
    }


def subscription_items(route: str):
    items = []
    scan_kwargs = {"FilterExpression": Attr("route").eq(route)}
    while True:
        page = _subscriptions.scan(**scan_kwargs)
        items.extend(page.get("Items", []))
        if "LastEvaluatedKey" not in page:
            return items
        scan_kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def handler(event, _context):
    origin = str(event["origin"]).upper()
    destination = str(event["destination"]).upper()
    route = str(event.get("route") or f"{origin}-{destination}").upper()
    token = json.loads(_secrets.get_secret_value(SecretId=SECRET_ID)["SecretString"])["token"]
    month = next_month()
    twd = fetch_cheapest(origin, destination, month, token, "twd")
    if not twd:
        print(f"no TWD fare for {route}; skipping")
        return {"ok": True, "route": route, "matched": 0}

    usd = fetch_cheapest(origin, destination, month, token, "usd")
    matched = 0
    for subscriber in subscription_items(route):
        target_price = Decimal(str(subscriber["target_price"]))
        if target_price < Decimal(str(twd["price"])):
            continue
        message = {
            "email": subscriber["email"],
            "route": route,
            "plan_name": subscriber.get("plan_name"),
            "target_price": int(target_price),
            "cheapest": twd,
        }
        if usd:
            message["cheapest_usd"] = usd
        _sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=json.dumps(message))
        matched += 1

    print(f"{route}: {twd['price']} TWD, matched={matched}")
    return {"ok": True, "route": route, "matched": matched}
