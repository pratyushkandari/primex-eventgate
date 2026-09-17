"""Aggregate decision policy for EventGate.

Centralizes the logic that converts a list of consumer findings into an overall
decision, severity, and summary. This is the single source of truth for:

  Any BREAK  →  BLOCK / HIGH
  Any RISK   →  REVIEW / MEDIUM
  All SAFE   →  ALLOW / LOW

EMPTY CONSUMER POLICY:
If no consumers are registered for the event type, the decision is REVIEW / MEDIUM.
"We don't know who uses this" must not silently become ALLOW.
"""

from __future__ import annotations

from eventgate.domain.enums import CompatibilityStatus, Decision, Severity
from eventgate.domain.models import Finding


def aggregate_decision(findings: list[Finding]) -> tuple[Decision, Severity]:
    """Determine the overall decision and severity from consumer findings.

    Returns (Decision, Severity).
    """
    if not findings:
        # No consumers registered — cannot confirm safety.
        return Decision.REVIEW, Severity.MEDIUM

    statuses = {f.status for f in findings}

    if CompatibilityStatus.BREAK in statuses:
        return Decision.BLOCK, Severity.HIGH
    if CompatibilityStatus.RISK in statuses:
        return Decision.REVIEW, Severity.MEDIUM
    return Decision.ALLOW, Severity.LOW


def generate_summary(decision: Decision, findings: list[Finding]) -> str:
    """Produce a deterministic human-readable summary for the analysis result."""
    if not findings:
        return (
            "No registered consumers were found for this event type. "
            "Compatibility cannot be fully verified."
        )

    if decision == Decision.ALLOW:
        return "All registered consumers are compatible with the proposed event."
    if decision == Decision.BLOCK:
        break_count = sum(1 for f in findings if f.status == CompatibilityStatus.BREAK)
        consumer_word = "consumer" if break_count == 1 else "consumers"
        return f"The proposed event is incompatible with {break_count} registered {consumer_word}."
    # REVIEW
    risk_count = sum(1 for f in findings if f.status == CompatibilityStatus.RISK)
    check_word = "check is" if risk_count == 1 else "checks are"
    return (
        f"The proposed event requires review because {risk_count} consumer "
        f"compatibility {check_word} uncertain."
    )
