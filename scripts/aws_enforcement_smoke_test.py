"""AWS live enforcement smoke test script for EventGate Phase 3.

Verifies:
  1. GET /health
  2. Scenario A (v1 -> v2): ALLOW -> Published to EventBridge -> All 3 consumers receive event
  3. Scenario B (v1 -> v3): BLOCK -> EventBridge publication prevented -> 0 consumers receive event
  4. Scenario C (v1 -> v4): REVIEW -> EventBridge publication prevented -> 0 consumers receive event
  5. Invalid Payload -> 422 INVALID_EVENT_PAYLOAD

Dynamic CloudWatch Discovery:
  Discovers consumer Lambda function names directly from CloudFormation stack outputs
  (BillingConsumerFunctionName, InventoryConsumerFunctionName, AnalyticsConsumerFunctionName).
  Derives /aws/lambda/<function-name> log groups without hardcoding physical names.

Usage:
  python scripts/aws_enforcement_smoke_test.py [api_url] \
    [--stack-name primex-eventgate-dev] [--region ap-south-1]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any

import boto3


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


def get_stack_outputs(stack_name: str, region: str) -> dict[str, str]:
    """Dynamically retrieve CloudFormation stack outputs."""
    cf = boto3.client("cloudformation", region_name=region)
    resp = cf.describe_stacks(StackName=stack_name)
    stacks = resp.get("Stacks", [])
    if not stacks:
        raise ValueError(f"Stack '{stack_name}' not found in region '{region}'.")

    outputs = {}
    for item in stacks[0].get("Outputs", []):
        outputs[item["OutputKey"]] = item["OutputValue"]
    return outputs


def poll_logs_for_event_id(
    logs_client: Any,
    log_group_name: str,
    event_id: str,
    start_time_ms: int,
    timeout_sec: int = 30,
    poll_interval_sec: int = 3,
) -> bool:
    """Poll CloudWatch log group events to check if event_id appears."""
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            resp = logs_client.filter_log_events(
                logGroupName=log_group_name,
                filterPattern=f'"{event_id}"',
                startTime=start_time_ms,
            )
            events = resp.get("events", [])
            if events:
                return True
        except logs_client.exceptions.ResourceNotFoundException:
            # Log group may not have been created yet if function hasn't run
            pass
        except Exception as exc:
            print(f"      [WARN] Log filter error on {log_group_name}: {exc}")

        time.sleep(poll_interval_sec)
    return False


def run_enforcement_smoke_test(
    api_url: str,
    stack_name: str,
    region: str,
) -> bool:
    """Run full Phase 3 live enforcement verification."""
    print(f"\n{'=' * 70}")
    print("  PrimeX EventGate — Live Phase 3 Enforcement Smoke Test")
    print(f"  Target API: {api_url}")
    print(f"  Stack:      {stack_name} ({region})")
    print(f"{'=' * 70}\n")

    logs_client = boto3.client("logs", region_name=region)

    # 1. Discover consumer log groups dynamically
    print("[Discovery] Fetching CloudFormation stack outputs...", end=" ")
    try:
        outputs = get_stack_outputs(stack_name, region)
        billing_fn = outputs["BillingConsumerFunctionName"]
        inventory_fn = outputs["InventoryConsumerFunctionName"]
        analytics_fn = outputs["AnalyticsConsumerFunctionName"]
        consumer_log_groups = {
            "billing-service": f"/aws/lambda/{billing_fn}",
            "inventory-service": f"/aws/lambda/{inventory_fn}",
            "analytics-service": f"/aws/lambda/{analytics_fn}",
        }
        print("DONE")
        for cid, lg in consumer_log_groups.items():
            print(f"  - {cid}: {lg}")
        print()
    except Exception as exc:
        print(f"FAILED: {exc}")
        return False

    all_passed = True
    base_url = api_url.rstrip("/")

    # 2. Health check
    print("[1/5] Checking GET /health ...", end=" ")
    try:
        status, body = http_request(f"{base_url}/health")
        if status == 200 and body.get("status") == "ok":
            print(f"PASS (status={status}, service={body.get('service')})")
        else:
            print(f"FAIL (status={status}, body={body})")
            all_passed = False
    except Exception as exc:
        print(f"ERROR: {exc}")
        all_passed = False

    # 3. Scenario A: Safe (v1 -> v2) -> ALLOW -> PutEvents -> 3 Consumers Receive
    print("[2/5] Scenario A (v1 -> v2: ALLOW -> EventBridge Fan-Out) ...")
    start_time_ms = int(time.time() * 1000) - 2000
    payload_a = {
        "orderId": "O1001",
        "amount": 500,
        "items": [{"sku": "SKU-001", "quantity": 1}],
        "shippingMethod": "FedEx",
        "couponCode": "SAVE10",
        "metadata": {"channel": "web"},
    }
    try:
        status, body = http_request(
            f"{base_url}/api/v1/events/publish",
            method="POST",
            data={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "payload": payload_a,
            },
            headers={"X-Request-ID": f"test-scen-a-{int(time.time())}"},
        )
        event_id = body.get("eventId")
        published = body.get("published")
        decision = body.get("decision")
        eb_id = body.get("eventBridgeEventId")

        if status == 200 and published is True and decision == "ALLOW" and eb_id:
            print(
                f"      API GATE: PASS (status=200, published=True, "
                f"eventId={event_id}, ebId={eb_id})"
            )
        else:
            print(
                f"      API GATE: FAIL (status={status}, published={published}, "
                f"decision={decision})"
            )
            all_passed = False

        # Verify all 3 consumers receive the event in CloudWatch
        print("      Polling consumer CloudWatch logs for eventId receipt (max 30s)...")
        all_consumers_received = True
        for consumer_id, log_group in consumer_log_groups.items():
            received = poll_logs_for_event_id(
                logs_client=logs_client,
                log_group_name=log_group,
                event_id=event_id,
                start_time_ms=start_time_ms,
                timeout_sec=30,
            )
            if received:
                print(f"        - {consumer_id}: RECEIVED (PASS)")
            else:
                print(f"        - {consumer_id}: TIMED OUT (FAIL)")
                all_consumers_received = False

        if not all_consumers_received:
            all_passed = False

    except Exception as exc:
        print(f"      ERROR: {exc}")
        all_passed = False

    # 4. Scenario B: Breaking (v1 -> v3) -> BLOCK -> NO EventBridge -> 0 Consumers Receive
    print("[3/5] Scenario B (v1 -> v3: BLOCK -> Publication Prevented) ...")
    start_time_ms = int(time.time() * 1000) - 2000
    payload_b = {
        "orderId": "O1001",
        "amount": 500,
        "items": [{"sku": "SKU-001", "quantity": 1}],
        "shippingMethod": {"carrier": "FedEx", "trackingCode": "TRK-1001"},
        "couponCode": "SAVE10",
    }
    try:
        status, body = http_request(
            f"{base_url}/api/v1/events/publish",
            method="POST",
            data={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 3,
                "payload": payload_b,
            },
            headers={"X-Request-ID": f"test-scen-b-{int(time.time())}"},
        )
        event_id = body.get("eventId")
        published = body.get("published")
        decision = body.get("decision")

        if status == 409 and published is False and decision == "BLOCK":
            print(
                f"      API GATE: PASS (status=409, published=False, "
                f"decision=BLOCK, eventId={event_id})"
            )
        else:
            print(
                f"      API GATE: FAIL (status={status}, published={published}, "
                f"decision={decision})"
            )
            all_passed = False

        # Verify absence in consumer logs over polling window
        print("      Verifying event absence across consumer logs (polling max 15s)...")
        any_consumer_received = False
        for consumer_id, log_group in consumer_log_groups.items():
            appeared = poll_logs_for_event_id(
                logs_client=logs_client,
                log_group_name=log_group,
                event_id=event_id,
                start_time_ms=start_time_ms,
                timeout_sec=15,
            )
            if appeared:
                print(f"        - {consumer_id}: UNEXPECTED RECEIPT (FAIL)")
                any_consumer_received = True
            else:
                print(f"        - {consumer_id}: NOT RECEIVED (PASS)")

        if any_consumer_received:
            all_passed = False

    except Exception as exc:
        print(f"      ERROR: {exc}")
        all_passed = False

    # 5. Scenario C: Risk (v1 -> v4) -> REVIEW -> NO EventBridge -> 0 Consumers Receive
    print("[4/5] Scenario C (v1 -> v4: REVIEW -> Publication Prevented) ...")
    start_time_ms = int(time.time() * 1000) - 2000
    payload_c = {
        "orderId": "O1001",
        "amount": 500,
        "items": [{"sku": "SKU-001", "quantity": 1}],
        "shippingMethod": "FedEx",
    }
    try:
        status, body = http_request(
            f"{base_url}/api/v1/events/publish",
            method="POST",
            data={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 4,
                "payload": payload_c,
            },
            headers={"X-Request-ID": f"test-scen-c-{int(time.time())}"},
        )
        event_id = body.get("eventId")
        published = body.get("published")
        decision = body.get("decision")

        if status == 409 and published is False and decision == "REVIEW":
            print(
                f"      API GATE: PASS (status=409, published=False, "
                f"decision=REVIEW, eventId={event_id})"
            )
        else:
            print(
                f"      API GATE: FAIL (status={status}, published={published}, "
                f"decision={decision})"
            )
            all_passed = False

        # Verify absence in consumer logs
        print("      Verifying event absence across consumer logs (polling max 15s)...")
        any_consumer_received = False
        for consumer_id, log_group in consumer_log_groups.items():
            appeared = poll_logs_for_event_id(
                logs_client=logs_client,
                log_group_name=log_group,
                event_id=event_id,
                start_time_ms=start_time_ms,
                timeout_sec=15,
            )
            if appeared:
                print(f"        - {consumer_id}: UNEXPECTED RECEIPT (FAIL)")
                any_consumer_received = True
            else:
                print(f"        - {consumer_id}: NOT RECEIVED (PASS)")

        if any_consumer_received:
            all_passed = False

    except Exception as exc:
        print(f"      ERROR: {exc}")
        all_passed = False

    # 6. Invalid Payload Validation
    print("[5/5] Checking Invalid Payload (422 INVALID_EVENT_PAYLOAD) ...", end=" ")
    try:
        status, body = http_request(
            f"{base_url}/api/v1/events/publish",
            method="POST",
            data={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "payload": {"orderId": "O1", "amount": "invalid-string"},
            },
        )
        error_code = body.get("error", {}).get("code")
        if status == 422 and error_code == "INVALID_EVENT_PAYLOAD":
            print(f"PASS (status=422, code={error_code})")
        else:
            print(f"FAIL (status={status}, code={error_code})")
            all_passed = False
    except Exception as exc:
        print(f"ERROR: {exc}")
        all_passed = False

    print(f"\n{'=' * 70}")
    if all_passed:
        print("  ALL LIVE ENFORCEMENT SMOKE TESTS PASSED!")
    else:
        print("  SOME LIVE ENFORCEMENT SMOKE TESTS FAILED!")
    print(f"{'=' * 70}\n")

    return all_passed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run live Phase 3 enforcement smoke tests against deployed EventGate stack"
    )
    parser.add_argument("api_url", nargs="?", help="Base URL of deployed API Gateway")
    parser.add_argument(
        "--stack-name",
        default="primex-eventgate-dev",
        help="CloudFormation stack name (default: primex-eventgate-dev)",
    )
    parser.add_argument(
        "--region",
        default="ap-south-1",
        help="AWS region name (default: ap-south-1)",
    )
    args = parser.parse_args()

    api_url = args.api_url
    if not api_url:
        # Discover dynamically from stack outputs
        print(f"Retrieving ApiUrl from stack '{args.stack_name}' in region '{args.region}'...")
        outputs = get_stack_outputs(args.stack_name, args.region)
        api_url = outputs.get("ApiUrl")
        if not api_url:
            print(f"Error: ApiUrl not found in stack '{args.stack_name}' outputs.")
            return 1

    success = run_enforcement_smoke_test(
        api_url=api_url,
        stack_name=args.stack_name,
        region=args.region,
    )
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
