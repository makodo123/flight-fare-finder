"""List the paid subscriptions associated with one email address."""

import json
import os

import boto3
from boto3.dynamodb.conditions import Key


TABLE_NAME = os.environ.get("TABLE_NAME", "subscriptions")
_table = boto3.resource("dynamodb").Table(TABLE_NAME)


def handler(event, _context):
    email = str((event.get("queryStringParameters") or {}).get("email", "")).strip().lower()
    if not email:
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"error": "email is required"}),
        }
    result = _table.query(KeyConditionExpression=Key("email").eq(email))
    items = result.get("Items", [])
    for item in items:
        item["target_price"] = int(item["target_price"])
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"items": items}),
    }
