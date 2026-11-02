"""Unit tests and conformance testing for EventGate release policy engines."""

import pytest

from eventgate.domain.enums import CompatibilityStatus, Decision, Severity
from eventgate.domain.errors import ConfigurationError
from eventgate.domain.models import Finding
from eventgate.domain.policy import (
    CedarReleasePolicyEngine,
    StandardReleasePolicyEngine,
    get_policy_engine,
)


@pytest.fixture
def standard_engine() -> StandardReleasePolicyEngine:
    return StandardReleasePolicyEngine()


@pytest.fixture
def cedar_engine() -> CedarReleasePolicyEngine:
    return CedarReleasePolicyEngine()


def _make_findings(severity: Severity) -> list[Finding]:
    if severity == Severity.HIGH:
        status = CompatibilityStatus.BREAK
    elif severity == Severity.MEDIUM:
        status = CompatibilityStatus.RISK
    else:
        status = CompatibilityStatus.SAFE

    return [
        Finding(
            consumer_id="billing-service",
            status=status,
            rule_id="RULE_TEST",
            field="orderId",
            expected_type="string",
            proposed_type="string",
            severity=severity,
            reason="Test finding",
        )
    ]


@pytest.mark.parametrize(
    ("env", "severity", "compat_result", "expected_decision"),
    [
        ("production", Severity.LOW, "SAFE", Decision.ALLOW),
        ("production", Severity.MEDIUM, "RISK", Decision.REVIEW),
        ("production", Severity.HIGH, "BREAK", Decision.BLOCK),
        ("staging", Severity.LOW, "SAFE", Decision.ALLOW),
        ("staging", Severity.MEDIUM, "RISK", Decision.REVIEW),
        ("staging", Severity.HIGH, "BREAK", Decision.BLOCK),
        ("development", Severity.LOW, "SAFE", Decision.ALLOW),
        ("development", Severity.MEDIUM, "RISK", Decision.ALLOW),  # with warning
        ("development", Severity.HIGH, "BREAK", Decision.BLOCK),
    ],
)
def test_standard_policy_matrix(
    standard_engine: StandardReleasePolicyEngine,
    env: str,
    severity: Severity,
    compat_result: str,
    expected_decision: Decision,
):
    """Verify standard policy engine satisfies the authoritative release policy matrix."""
    findings = _make_findings(severity)
    res = standard_engine.evaluate(
        compatibility_result=compat_result,
        severity=severity,
        environment=env,
        findings=findings,
    )
    assert res.decision == expected_decision

    if env == "development" and severity == Severity.MEDIUM:
        assert len(res.warnings) > 0
    else:
        assert len(res.warnings) == 0


@pytest.mark.parametrize(
    ("env", "severity", "compat_result"),
    [
        ("production", Severity.LOW, "SAFE"),
        ("production", Severity.MEDIUM, "RISK"),
        ("production", Severity.HIGH, "BREAK"),
        ("staging", Severity.LOW, "SAFE"),
        ("staging", Severity.MEDIUM, "RISK"),
        ("staging", Severity.HIGH, "BREAK"),
        ("development", Severity.LOW, "SAFE"),
        ("development", Severity.MEDIUM, "RISK"),
        ("development", Severity.HIGH, "BREAK"),
    ],
)
def test_cedar_conformance_with_standard_policy(
    standard_engine: StandardReleasePolicyEngine,
    cedar_engine: CedarReleasePolicyEngine,
    env: str,
    severity: Severity,
    compat_result: str,
):
    """Conformance test proving Standard and Cedar produce identical decisions."""
    findings = _make_findings(severity)
    std_res = standard_engine.evaluate(
        compatibility_result=compat_result,
        severity=severity,
        environment=env,
        findings=findings,
    )
    cedar_res = cedar_engine.evaluate(
        compatibility_result=compat_result,
        severity=severity,
        environment=env,
        findings=findings,
    )

    assert std_res.decision == cedar_res.decision, (
        f"Mismatch for env={env}, sev={severity}: "
        f"Standard={std_res.decision}, Cedar={cedar_res.decision}"
    )


def test_get_policy_engine_factory(monkeypatch):
    """Test get_policy_engine respects EVENTGATE_POLICY_ENGINE."""
    monkeypatch.setenv("EVENTGATE_POLICY_ENGINE", "standard")
    assert isinstance(get_policy_engine(), StandardReleasePolicyEngine)

    monkeypatch.setenv("EVENTGATE_POLICY_ENGINE", "cedar")
    assert isinstance(get_policy_engine(), CedarReleasePolicyEngine)

    monkeypatch.setenv("EVENTGATE_POLICY_ENGINE", "unknown_engine")
    with pytest.raises(ConfigurationError):
        get_policy_engine()


def test_policy_matrix_matches_documented_rules():
    from eventgate.domain.policy import policy_matrix

    assert policy_matrix() == [
        {"environment": "production", "low": "ALLOW", "medium": "REVIEW", "high": "BLOCK"},
        {"environment": "staging", "low": "ALLOW", "medium": "REVIEW", "high": "BLOCK"},
        {
            "environment": "development",
            "low": "ALLOW",
            "medium": "ALLOW with warning",
            "high": "BLOCK",
        },
    ]


def test_cedar_policy_ships_inside_the_package():
    """Lambda deploys only backend/src, so the policy must load from the package."""
    from importlib import resources

    from eventgate.domain.policy import load_cedar_policy_text

    packaged = resources.files("eventgate").joinpath("policies/release_policy.cedar")
    assert packaged.is_file()
    assert "PROD_BLOCK_BREAK" in load_cedar_policy_text()


def test_cedar_missing_policy_file_is_configuration_error(tmp_path):
    with pytest.raises(ConfigurationError, match="Cannot read Cedar policy"):
        CedarReleasePolicyEngine(policy_path=tmp_path / "missing.cedar")


@pytest.mark.parametrize("environment", ["production", "staging", "development"])
@pytest.mark.parametrize("severity", list(Severity))
def test_cedar_and_standard_engines_agree(environment, severity):
    compat = {Severity.LOW: "SAFE", Severity.MEDIUM: "RISK", Severity.HIGH: "BREAK"}[severity]
    findings = _make_findings(severity)
    standard = StandardReleasePolicyEngine().evaluate(compat, severity, environment, findings)
    cedar = CedarReleasePolicyEngine().evaluate(compat, severity, environment, findings)
    assert standard.decision == cedar.decision
    assert bool(standard.warnings) == bool(cedar.warnings)
