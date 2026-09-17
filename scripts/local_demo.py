"""Local interactive demonstration script for EventGate Phase 1.

Executes deterministic consumer impact analysis using real contract files
and application domain services. Demonstrates all three golden scenarios:
1. v1 -> v2-safe: Optional field added (ALLOW)
2. v1 -> v3-breaking: Type changed on consumed field (BLOCK)
3. v1 -> v4-risk: Optional field removed from consumed contract (REVIEW)
"""

from __future__ import annotations

import sys
from pathlib import Path

from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.domain.compatibility import CompatibilityEngine
from eventgate.domain.models import AnalysisResult
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)

_SCRIPTS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPTS_DIR.parent


def _print_separator(char: str = "=", length: int = 72) -> None:
    print(char * length)


def _format_result(scenario_title: str, result: AnalysisResult) -> None:
    _print_separator()
    print(f"SCENARIO: {scenario_title}")
    print(f"Event Type:        {result.event_type}")
    print(f"Transition:        v{result.current_version} -> v{result.proposed_version}")
    print(f"Aggregate Decision:{result.decision.value} (Severity: {result.severity.value})")
    print(f"Summary:           {result.summary}")
    print("\nConsumer Findings:")

    for finding in result.findings:
        field_str = f" [field: {finding.field}]" if finding.field and finding.field != "*" else ""
        print(
            f"  - Consumer: {finding.consumer_id:<20} "
            f"Status: {finding.status.value:<6} "
            f"Rule: {finding.rule_id}{field_str}"
        )
        print(f"    Reason: {finding.reason}")

    print("\nChange Set Summary:")
    cs = result.change_set
    print(f"  Added fields:        {cs.added_fields or 'None'}")
    print(f"  Removed fields:      {cs.removed_fields or 'None'}")
    if cs.type_changes:
        tc_strs = [f"{tc.field}: {tc.from_type} -> {tc.to_type}" for tc in cs.type_changes]
        print(f"  Type changes:        {', '.join(tc_strs)}")
    else:
        print("  Type changes:        None")
    if cs.requiredness_changes:
        rc_strs = [
            f"{rc.field}: required={rc.from_required} -> required={rc.to_required}"
            for rc in cs.requiredness_changes
        ]
        print(f"  Requiredness changes:{', '.join(rc_strs)}")
    else:
        print("  Requiredness changes:None")
    _print_separator()
    print()


def main() -> None:
    contracts_dir = _REPO_ROOT / "contracts"
    if not contracts_dir.exists():
        print(f"Error: Contracts directory not found at {contracts_dir}", file=sys.stderr)
        sys.exit(1)

    print("Initializing EventGate Domain Engine & Repositories...")
    event_repo = JsonEventContractRepository(contracts_dir)
    consumer_repo = JsonConsumerContractRepository(contracts_dir)
    engine = CompatibilityEngine()
    service = EventAnalysisService(event_repo, consumer_repo, engine)

    print(f"Loaded contracts from: {contracts_dir}\n")

    # 1. Scenario A: v1 -> v2-safe
    result_a = service.analyze("OrderPlaced", current_version=1, proposed_version=2)
    _format_result("Scenario A (v1 -> v2-safe): Metadata Field Added", result_a)

    # 2. Scenario B: v1 -> v3-breaking
    result_b = service.analyze("OrderPlaced", current_version=1, proposed_version=3)
    _format_result("Scenario B (v1 -> v3-breaking): Shipping Method Type Change", result_b)

    # 3. Scenario C: v1 -> v4-risk
    result_c = service.analyze("OrderPlaced", current_version=1, proposed_version=4)
    _format_result("Scenario C (v1 -> v4-risk): Optional Coupon Code Removed", result_c)

    print("All three golden demo scenarios executed successfully.")


if __name__ == "__main__":
    main()
