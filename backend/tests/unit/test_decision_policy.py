"""Tests for the aggregate decision policy."""

from eventgate.domain.decision import aggregate_decision, generate_summary
from eventgate.domain.enums import CompatibilityStatus, Decision, Severity
from eventgate.domain.models import Finding


def _finding(status: CompatibilityStatus, consumer_id: str = "svc") -> Finding:
    severity = {
        CompatibilityStatus.SAFE: Severity.LOW,
        CompatibilityStatus.RISK: Severity.MEDIUM,
        CompatibilityStatus.BREAK: Severity.HIGH,
    }[status]
    return Finding(
        consumer_id=consumer_id,
        status=status,
        rule_id="TEST",
        field="x",
        expected_type=None,
        proposed_type=None,
        severity=severity,
        reason="test",
    )


class TestDecisionPolicy:
    def test_all_safe_is_allow(self):
        findings = [_finding(CompatibilityStatus.SAFE)]
        decision, severity = aggregate_decision(findings)
        assert decision == Decision.ALLOW
        assert severity == Severity.LOW

    def test_risk_without_break_is_review(self):
        findings = [
            _finding(CompatibilityStatus.SAFE, "a"),
            _finding(CompatibilityStatus.RISK, "b"),
        ]
        decision, severity = aggregate_decision(findings)
        assert decision == Decision.REVIEW
        assert severity == Severity.MEDIUM

    def test_break_is_block(self):
        findings = [_finding(CompatibilityStatus.BREAK)]
        decision, severity = aggregate_decision(findings)
        assert decision == Decision.BLOCK
        assert severity == Severity.HIGH

    def test_break_plus_risk_is_block(self):
        findings = [
            _finding(CompatibilityStatus.RISK, "a"),
            _finding(CompatibilityStatus.BREAK, "b"),
        ]
        decision, severity = aggregate_decision(findings)
        assert decision == Decision.BLOCK
        assert severity == Severity.HIGH

    def test_all_break_is_block(self):
        findings = [
            _finding(CompatibilityStatus.BREAK, "a"),
            _finding(CompatibilityStatus.BREAK, "b"),
        ]
        decision, severity = aggregate_decision(findings)
        assert decision == Decision.BLOCK
        assert severity == Severity.HIGH

    def test_empty_findings_is_review(self):
        """No consumers registered → REVIEW (empty consumer policy)."""
        decision, severity = aggregate_decision([])
        assert decision == Decision.REVIEW
        assert severity == Severity.MEDIUM

    # Safety invariants
    def test_block_implies_break_exists(self):
        findings = [
            _finding(CompatibilityStatus.SAFE, "a"),
            _finding(CompatibilityStatus.BREAK, "b"),
        ]
        decision, _ = aggregate_decision(findings)
        assert decision == Decision.BLOCK
        statuses = {f.status for f in findings}
        assert CompatibilityStatus.BREAK in statuses

    def test_allow_implies_no_break(self):
        findings = [_finding(CompatibilityStatus.SAFE)]
        decision, _ = aggregate_decision(findings)
        assert decision == Decision.ALLOW
        assert all(f.status != CompatibilityStatus.BREAK for f in findings)


class TestSummaryGeneration:
    def test_allow_summary(self):
        findings = [_finding(CompatibilityStatus.SAFE)]
        summary = generate_summary(Decision.ALLOW, findings)
        assert "compatible" in summary.lower()

    def test_block_summary_with_count(self):
        findings = [
            _finding(CompatibilityStatus.BREAK, "a"),
            _finding(CompatibilityStatus.BREAK, "b"),
        ]
        summary = generate_summary(Decision.BLOCK, findings)
        assert "2" in summary
        assert "incompatible" in summary.lower()

    def test_review_summary(self):
        findings = [_finding(CompatibilityStatus.RISK)]
        summary = generate_summary(Decision.REVIEW, findings)
        assert "review" in summary.lower()

    def test_empty_findings_summary(self):
        summary = generate_summary(Decision.REVIEW, [])
        assert "no registered consumers" in summary.lower()
