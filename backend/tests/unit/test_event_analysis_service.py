"""Tests for EventAnalysisService — the main application use case."""

import pytest

from eventgate.application.services.event_analysis_service import EventAnalysisService
from eventgate.domain.compatibility import (
    RULE_CONSUMER_UNAFFECTED,
    RULE_FIELD_TYPE_CHANGED,
    RULE_OPTIONAL_FIELD_ADDED,
    RULE_OPTIONAL_FIELD_REMOVED,
)
from eventgate.domain.enums import CompatibilityStatus, Decision, Severity
from eventgate.domain.errors import (
    InvalidAnalysisRequestError,
    UnsupportedEventVersionError,
)


class TestEventAnalysisService:
    """Tests using the real contract fixtures."""

    @pytest.fixture(autouse=True)
    def setup_service(self, event_repo, consumer_repo, engine):
        self.service = EventAnalysisService(event_repo, consumer_repo, engine)

    def test_safe_analysis(self):
        result = self.service.analyze("OrderPlaced", 1, 2)
        assert result.decision == Decision.ALLOW
        assert result.severity == Severity.LOW
        assert all(f.status == CompatibilityStatus.SAFE for f in result.findings)
        assert result.event_type == "OrderPlaced"
        assert result.current_version == 1
        assert result.proposed_version == 2

    def test_breaking_analysis(self):
        result = self.service.analyze("OrderPlaced", 1, 3)
        assert result.decision == Decision.BLOCK
        assert result.severity == Severity.HIGH
        # inventory-service should BREAK.
        inv_findings = [f for f in result.findings if f.consumer_id == "inventory-service"]
        assert any(f.status == CompatibilityStatus.BREAK for f in inv_findings)

    def test_risk_analysis(self):
        result = self.service.analyze("OrderPlaced", 1, 4)
        assert result.decision == Decision.REVIEW
        assert result.severity == Severity.MEDIUM
        # analytics-service should RISK.
        ana_findings = [f for f in result.findings if f.consumer_id == "analytics-service"]
        assert any(f.status == CompatibilityStatus.RISK for f in ana_findings)

    def test_unknown_event_type(self):
        with pytest.raises(Exception):
            self.service.analyze("NonExistent", 1, 2)

    def test_unknown_version(self):
        with pytest.raises(UnsupportedEventVersionError):
            self.service.analyze("OrderPlaced", 1, 99)

    def test_invalid_empty_event_type(self):
        with pytest.raises(InvalidAnalysisRequestError):
            self.service.analyze("", 1, 2)

    def test_invalid_zero_version(self):
        with pytest.raises(InvalidAnalysisRequestError):
            self.service.analyze("OrderPlaced", 0, 1)

    def test_invalid_same_versions(self):
        with pytest.raises(InvalidAnalysisRequestError):
            self.service.analyze("OrderPlaced", 1, 1)

    def test_request_id_preserved(self):
        result = self.service.analyze("OrderPlaced", 1, 2, request_id="test-123")
        assert result.request_id == "test-123"

    def test_analysis_id_generated(self):
        result = self.service.analyze("OrderPlaced", 1, 2)
        assert result.analysis_id is not None
        assert len(result.analysis_id) > 0

    def test_change_set_present(self):
        result = self.service.analyze("OrderPlaced", 1, 3)
        assert result.change_set is not None
        assert len(result.change_set.type_changes) > 0

    def test_multiple_consumers_evaluated(self):
        result = self.service.analyze("OrderPlaced", 1, 2)
        consumer_ids = {f.consumer_id for f in result.findings}
        assert "billing-service" in consumer_ids
        assert "inventory-service" in consumer_ids
        assert "analytics-service" in consumer_ids

    def test_summary_present(self):
        result = self.service.analyze("OrderPlaced", 1, 2)
        assert result.summary is not None
        assert len(result.summary) > 0


# ---------------------------------------------------------------------------
# Golden scenario tests — permanent regression guards
# ---------------------------------------------------------------------------


class TestGoldenScenarios:
    """These tests protect the three demo scenarios against regressions."""

    @pytest.fixture(autouse=True)
    def setup_service(self, event_repo, consumer_repo, engine):
        self.service = EventAnalysisService(event_repo, consumer_repo, engine)

    def test_golden_a_safe(self):
        """v1 → v2-safe: all consumers SAFE via EVT005 (metadata added), decision ALLOW."""
        result = self.service.analyze("OrderPlaced", 1, 2)
        assert result.decision == Decision.ALLOW
        assert result.severity == Severity.LOW

        for f in result.findings:
            assert f.status == CompatibilityStatus.SAFE, (
                f"{f.consumer_id} expected SAFE but got {f.status}"
            )
            assert f.rule_id == RULE_OPTIONAL_FIELD_ADDED

    def test_golden_b_breaking(self):
        """v1 → v3-breaking: inventory BREAK (EVT001), billing & analytics SAFE (EVT008)."""
        result = self.service.analyze("OrderPlaced", 1, 3)
        assert result.decision == Decision.BLOCK
        assert result.severity == Severity.HIGH

        by_consumer = {f.consumer_id: f for f in result.findings}

        # Inventory breaks on shippingMethod string→object (EVT001).
        assert by_consumer["inventory-service"].status == CompatibilityStatus.BREAK
        assert by_consumer["inventory-service"].rule_id == RULE_FIELD_TYPE_CHANGED
        assert by_consumer["inventory-service"].field == "shippingMethod"

        # Billing and analytics are unaffected by shippingMethod change (EVT008).
        assert by_consumer["billing-service"].status == CompatibilityStatus.SAFE
        assert by_consumer["billing-service"].rule_id == RULE_CONSUMER_UNAFFECTED

        assert by_consumer["analytics-service"].status == CompatibilityStatus.SAFE
        assert by_consumer["analytics-service"].rule_id == RULE_CONSUMER_UNAFFECTED

    def test_golden_c_risk(self):
        """v1 → v4-risk: analytics RISK (EVT006), billing & inventory SAFE (EVT008)."""
        result = self.service.analyze("OrderPlaced", 1, 4)
        assert result.decision == Decision.REVIEW
        assert result.severity == Severity.MEDIUM

        by_consumer = {f.consumer_id: f for f in result.findings}

        # Analytics consumes optional couponCode, which was removed (EVT006).
        assert by_consumer["analytics-service"].status == CompatibilityStatus.RISK
        assert by_consumer["analytics-service"].rule_id == RULE_OPTIONAL_FIELD_REMOVED
        assert by_consumer["analytics-service"].field == "couponCode"

        # Billing and inventory do not consume couponCode, so they are unaffected (EVT008).
        assert by_consumer["billing-service"].status == CompatibilityStatus.SAFE
        assert by_consumer["billing-service"].rule_id == RULE_CONSUMER_UNAFFECTED

        assert by_consumer["inventory-service"].status == CompatibilityStatus.SAFE
        assert by_consumer["inventory-service"].rule_id == RULE_CONSUMER_UNAFFECTED
