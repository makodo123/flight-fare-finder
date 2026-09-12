"""Read configured routes and fan them out to the fare parser asynchronously."""

import json
import os

import boto3


BUCKET = os.environ["CONFIG_BUCKET"]
ROUTES_KEY = os.environ.get("ROUTES_KEY", "flight-routes.json")
PARSER_FUNCTION = os.environ.get("PARSER_FUNCTION", "flight-parser")

_s3 = boto3.client("s3")
_lambda = boto3.client("lambda")


def handler(_event, _context):
    routes = json.loads(_s3.get_object(Bucket=BUCKET, Key=ROUTES_KEY)["Body"].read())
    invoked = 0
    for item in routes:
        origin = item["origin"].upper()
        destination = item["destination"].upper()
        payload = {"origin": origin, "destination": destination, "route": f"{origin}-{destination}"}
        _lambda.invoke(
            FunctionName=PARSER_FUNCTION,
            InvocationType="Event",
            Payload=json.dumps(payload).encode("utf-8"),
        )
        invoked += 1
    print(f"scheduled {invoked} routes")
    return {"ok": True, "routes": invoked}
