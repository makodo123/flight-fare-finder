"""Small standard-library helpers shared by the ECPay Lambda handlers."""

import base64
import hashlib
import hmac
import json
import os
import urllib.parse
from calendar import monthrange
from datetime import datetime, timezone


def load_secret(secrets_client, secret_id):
    return json.loads(secrets_client.get_secret_value(SecretId=secret_id)["SecretString"])


def ecpay_url_encode(value):
    encoded = urllib.parse.quote_plus(str(value), safe="")
    encoded = encoded.replace("~", "%7E").lower()
    replacements = {
        "%2d": "-",
        "%5f": "_",
        "%2e": ".",
        "%21": "!",
        "%2a": "*",
        "%28": "(",
        "%29": ")",
    }
    for source, target in replacements.items():
        encoded = encoded.replace(source, target)
    return encoded


def check_mac_value(params, secret):
    merchant_id = secret.get("merchant_id") or secret.get("MerchantID")
    hash_key = secret.get("hash_key") or secret.get("HashKey")
    hash_iv = secret.get("hash_iv") or secret.get("HashIV")
    values = [(str(key), value) for key, value in params.items() if str(key).lower() != "checkmacvalue"]
    values.sort(key=lambda item: item[0].lower())
    body = "&".join(f"{key}={value if value is not None else ''}" for key, value in values)
    raw = f"HashKey={hash_key}&{body}&HashIV={hash_iv}"
    return hashlib.sha256(ecpay_url_encode(raw).encode("utf-8")).hexdigest().upper()


def valid_check_mac(params, secret):
    provided = str(params.get("CheckMacValue", "")).upper()
    expected = check_mac_value(params, secret)
    return bool(provided) and hmac.compare_digest(provided, expected)


def secret_merchant_id(secret):
    return str(secret.get("merchant_id") or secret.get("MerchantID") or "")


def request_body(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        return base64.b64decode(body).decode("utf-8")
    return body


def form_params(event):
    parsed = urllib.parse.parse_qs(request_body(event), keep_blank_values=True)
    return {key: values[-1] if values else "" for key, values in parsed.items()}


def json_response(status, payload):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json; charset=utf-8"},
        "body": json.dumps(payload, ensure_ascii=False),
    }


def callback_response():
    return {
        "statusCode": 200,
        "headers": {"content-type": "text/plain; charset=utf-8"},
        "body": "1|OK",
    }


def add_months(value):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    month = value.month + 1
    year = value.year + (month > 12)
    month = 1 if month > 12 else month
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def period_end(now=None):
    return add_months(now or datetime.now(timezone.utc)).isoformat()


def status_queue_url():
    return os.environ.get("STATUS_QUEUE_URL", "")
