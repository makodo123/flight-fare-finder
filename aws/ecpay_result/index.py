"""Return the browser to the static app without changing subscription state."""

import os


SITE_URL = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")


def handler(_event, _context):
    return {
        "statusCode": 302,
        "headers": {"location": f"{SITE_URL}/app?purchase=success", "cache-control": "no-store"},
        "body": "",
    }
