"""AWS smoke test script for EventGate deployed API Gateway HTTP API.

Verifies:
  - GET /health
  - POST /api/v1/analyze (v1 -> v2) == ALLOW / LOW
  - POST /api/v1/analyze (v1 -> v3) == BLOCK / HIGH
  - POST /api/v1/analyze (v1 -> v4) == REVIEW / MEDIUM

Usage:
  python scripts/aws_smoke_test.py https://<api-id>.execute-api.<region>.amazonaws.com
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


def http_request(
    url: str,
    method: str = "GET",
    data: dict | None = None,
    headers: dict | None = None,
) -> tuple[int, dict]:
    """Execute an HTTP request and return (status_code, json_body)."""
    req_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    body_bytes = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            return status, json.loads(content)
    except urllib.error.HTTPError as err:
        status = err.code
        try:
            content = err.read().decode("utf-8")
            return status, json.loads(content)
        except Exception:
            return status, {"error": str(err)}


def run_smoke_tests(base_url: str) -> bool:
    """Run verification tests against the deployed API Gateway endpoint."""
    base_url = base_url.rstrip("/")
    print(f"\n{'=' * 65}")
    print("  EventGate AWS API Smoke Test")
    print(f"  Target: {base_url}")
    print(f"{'=' * 65}\n")

    all_passed = True

    # 1. Health Check
    health_url = f"{base_url}/health"
    print("[1/4] Checking GET /health ...", end=" ")
    try:
        status, body = http_request(health_url)
        if status == 200 and body.get("status") == "ok":
            svc = body.get("service")
            ver = body.get("version")
            print(f"PASS (status={status}, service={svc}, version={ver})")
        else:
            print(f"FAIL (status={status}, body={body})")
            all_passed = False
    except Exception as exc:
        print(f"ERROR: {exc}")
        all_passed = False

    # 2. Golden Scenario A: v1 -> v2 (Safe / Optional field added)
    analyze_url = f"{base_url}/api/v1/analyze"
    print("[2/4] Checking Scenario A (v1 -> v2: ALLOW / LOW) ...", end=" ")
    try:
        status, body = http_request(
            analyze_url,
            method="POST",
            data={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 2},
        )
        decision = body.get("decision")
        severity = body.get("severity")
        findings_count = len(body.get("findings", []))
        if status == 200 and decision == "ALLOW" and severity == "LOW":
            print(f"PASS (decision={decision}, severity={severity}, findings={findings_count})")
        else:
            print(f"FAIL (status={status}, decision={decision}, severity={severity})")
            print(f"      Body: {body}")
            all_passed = False
    except Exception as exc:
        print(f"ERROR: {exc}")
        all_passed = False

    # 3. Golden Scenario B: v1 -> v3 (Breaking / Field type changed)
    print("[3/4] Checking Scenario B (v1 -> v3: BLOCK / HIGH) ...", end=" ")
    try:
        status, body = http_request(
            analyze_url,
            method="POST",
            data={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 3},
        )
        decision = body.get("decision")
        severity = body.get("severity")
        findings = body.get("findings", [])
        inv_findings = [f for f in findings if f.get("consumerId") == "inventory-service"]
        has_break = any(f.get("status") == "BREAK" for f in inv_findings)

        if status == 200 and decision == "BLOCK" and severity == "HIGH" and has_break:
            print(f"PASS (decision={decision}, severity={severity}, inventory BREAK verified)")
        else:
            print(
                f"FAIL (status={status}, decision={decision}, "
                f"severity={severity}, has_break={has_break})"
            )
            print(f"      Body: {body}")
            all_passed = False
    except Exception as exc:
        print(f"ERROR: {exc}")
        all_passed = False

    # 4. Golden Scenario C: v1 -> v4 (Risk / Optional field removed)
    print("[4/4] Checking Scenario C (v1 -> v4: REVIEW / MEDIUM) ...", end=" ")
    try:
        status, body = http_request(
            analyze_url,
            method="POST",
            data={"eventType": "OrderPlaced", "currentVersion": 1, "proposedVersion": 4},
        )
        decision = body.get("decision")
        severity = body.get("severity")
        findings = body.get("findings", [])
        ana_findings = [f for f in findings if f.get("consumerId") == "analytics-service"]
        has_risk = any(f.get("status") == "RISK" for f in ana_findings)

        if status == 200 and decision == "REVIEW" and severity == "MEDIUM" and has_risk:
            print(f"PASS (decision={decision}, severity={severity}, analytics RISK verified)")
        else:
            print(
                f"FAIL (status={status}, decision={decision}, "
                f"severity={severity}, has_risk={has_risk})"
            )
            print(f"      Body: {body}")
            all_passed = False
    except Exception as exc:
        print(f"ERROR: {exc}")
        all_passed = False

    print(f"\n{'=' * 65}")
    if all_passed:
        print("  ALL AWS SMOKE TESTS PASSED!")
    else:
        print("  SOME AWS SMOKE TESTS FAILED!")
    print(f"{'=' * 65}\n")
    return all_passed


def main() -> int:
    parser = argparse.ArgumentParser(description="Run smoke tests against deployed EventGate API")
    parser.add_argument(
        "api_url",
        help="Base URL of deployed API Gateway (e.g. https://xyz.execute-api.us-east-1.amazonaws.com)",
    )
    args = parser.parse_args()

    success = run_smoke_tests(args.api_url)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
