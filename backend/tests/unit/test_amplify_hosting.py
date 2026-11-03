"""Static checks on the Amplify Hosting configuration for the console."""

from pathlib import Path

import yaml

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
EXPECTED_HEADERS = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


def _load(name: str) -> dict:
    return yaml.safe_load((_REPO_ROOT / name).read_text(encoding="utf-8"))


def test_security_headers_are_declared_in_custom_http_for_the_frontend_app():
    apps = {app["appRoot"]: app for app in _load("customHttp.yml")["applications"]}
    rules = apps["frontend"]["customHeaders"]
    all_paths = next(rule for rule in rules if rule["pattern"] == "**/*")
    assert {h["key"]: h["value"] for h in all_paths["headers"]} == EXPECTED_HEADERS


def test_build_spec_carries_no_custom_headers():
    """Amplify ignores headers in amplify.yml, so they must not be declared there."""
    for app in _load("amplify.yml")["applications"]:
        assert "customHeaders" not in app
