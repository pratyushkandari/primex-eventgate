"""Release policy: turns a compatibility verdict into ALLOW / REVIEW / BLOCK.

Compatibility (SAFE / RISK / BREAK) says what a change does to consumers; the
policy decides what to do about it in a given environment. Two engines
implement the same matrix:

- 'standard': plain Python, the default.
- 'cedar': evaluates the Cedar policy shipped in eventgate/policies/ via cedarpy.

EVENTGATE_POLICY_ENGINE selects the engine; an unknown value is a configuration
error rather than a silent fallback.
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from importlib import resources
from pathlib import Path
from typing import Any

from eventgate.domain.enums import Decision, Environment, Severity
from eventgate.domain.errors import ConfigurationError
from eventgate.domain.models import Finding

CEDAR_POLICY_RESOURCE = "policies/release_policy.cedar"


def load_cedar_policy_text(policy_path: Path | None = None) -> str:
    """Return the Cedar policy source (the packaged file unless a path is given).

    Raises ConfigurationError if the file is missing or unreadable.
    """
    try:
        if policy_path is not None:
            return policy_path.read_text(encoding="utf-8")
        return resources.files("eventgate").joinpath(CEDAR_POLICY_RESOURCE).read_text("utf-8")
    except OSError as exc:
        location = policy_path or f"eventgate/{CEDAR_POLICY_RESOURCE}"
        raise ConfigurationError(f"Cannot read Cedar policy '{location}': {exc}") from exc


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PolicyEvaluationResult:
    """Outcome of evaluating release policy for an event change."""

    decision: Decision
    reason: str
    policy_name: str
    applied_rule: str
    provider: str
    warnings: list[str] = field(default_factory=list)


class IPolicyEngine(ABC):
    """Abstract policy engine port."""

    @abstractmethod
    def evaluate(
        self,
        compatibility_result: str,
        severity: Severity,
        environment: str,
        findings: list[Finding],
        context: dict[str, Any] | None = None,
    ) -> PolicyEvaluationResult:
        """Evaluate release policy and derive the final release decision."""
        pass


class StandardReleasePolicyEngine(IPolicyEngine):
    """Pure, deterministic release policy engine implementing the EventGate matrix:

    | Environment | LOW   | MEDIUM              | HIGH  |
    |-------------|-------|---------------------|-------|
    | production  | ALLOW | REVIEW              | BLOCK |
    | staging     | ALLOW | REVIEW              | BLOCK |
    | development | ALLOW | ALLOW with warning  | BLOCK |
    """

    POLICY_NAME = "StandardReleasePolicy"
    PROVIDER_NAME = "standard"

    def evaluate(
        self,
        compatibility_result: str,
        severity: Severity,
        environment: str,
        findings: list[Finding],
        context: dict[str, Any] | None = None,
    ) -> PolicyEvaluationResult:
        env = (environment or "production").strip().lower()

        # HIGH severity / BREAK is strictly blocked across all environments
        if severity == Severity.HIGH or compatibility_result == "BREAK":
            break_count = sum(1 for f in findings if f.severity == Severity.HIGH)
            rule = "PROD_BLOCK_BREAK" if env != "development" else "DEV_BLOCK_BREAK"
            reason = (
                f"Release policy for '{env}' strictly blocks breaking changes "
                f"({break_count} high-severity break{'s' if break_count != 1 else ''} detected)."
            )
            return PolicyEvaluationResult(
                decision=Decision.BLOCK,
                reason=reason,
                policy_name=self.POLICY_NAME,
                applied_rule=rule,
                provider=self.PROVIDER_NAME,
            )

        # MEDIUM severity / RISK requires review in prod/staging, allows with warning in dev
        if severity == Severity.MEDIUM or compatibility_result == "RISK":
            if env == "development":
                return PolicyEvaluationResult(
                    decision=Decision.ALLOW,
                    reason=(
                        "Development environment policy permits medium-risk changes "
                        "with non-blocking warning."
                    ),
                    policy_name=self.POLICY_NAME,
                    applied_rule="DEV_ALLOW_WARNING",
                    provider=self.PROVIDER_NAME,
                    warnings=[
                        "Medium-risk change permitted in development environment. "
                        "Review downstream impacts before promoting to staging or production."
                    ],
                )
            # staging or production
            return PolicyEvaluationResult(
                decision=Decision.REVIEW,
                reason=(
                    f"Release policy for '{env}' requires manual engineering "
                    "review for medium-risk changes."
                ),
                policy_name=self.POLICY_NAME,
                applied_rule="PROD_REVIEW_MEDIUM",
                provider=self.PROVIDER_NAME,
                warnings=[],
            )

        # LOW severity / SAFE is allowed across all environments
        return PolicyEvaluationResult(
            decision=Decision.ALLOW,
            reason=(
                f"Release policy for '{env}' permits backward-compatible "
                "changes (all consumers safe)."
            ),
            policy_name=self.POLICY_NAME,
            applied_rule="ALLOW_SAFE",
            provider=self.PROVIDER_NAME,
            warnings=[],
        )


class CedarReleasePolicyEngine(IPolicyEngine):
    """Evaluates policies authored in the Cedar policy specification language."""

    POLICY_NAME = "CedarReleasePolicy"
    PROVIDER_NAME = "cedar"

    def __init__(self, policy_path: Path | None = None):
        self._policy_text = load_cedar_policy_text(policy_path)

    def evaluate(
        self,
        compatibility_result: str,
        severity: Severity,
        environment: str,
        findings: list[Finding],
        context: dict[str, Any] | None = None,
    ) -> PolicyEvaluationResult:
        try:
            import cedarpy
        except ImportError as exc:
            raise ConfigurationError(
                "Cedar engine configured (EVENTGATE_POLICY_ENGINE=cedar) "
                "but 'cedarpy' is not installed."
            ) from exc

        env = (environment or "production").strip().lower()
        event_type = (context or {}).get("event_type", "UnknownEvent")

        request_payload = {
            "principal": f'Environment::"{env}"',
            "action": 'Action::"Release"',
            "resource": f'ContractRelease::"{event_type}"',
            "context": {
                "severity": severity.value,
                "compatibilityResult": compatibility_result,
            },
        }

        try:
            authz_result = cedarpy.is_authorized(
                request=request_payload,
                policies=self._policy_text,
                entities=[],
            )
        except Exception as exc:
            raise ConfigurationError(f"Cedar policy evaluation execution failed: {exc}") from exc

        # Interpret Cedar decision
        # Cedar returns Allow or Deny
        decision_val = authz_result.decision.value  # "Allow" or "Deny"

        if decision_val == "Allow":
            if env == "development" and severity == Severity.MEDIUM:
                return PolicyEvaluationResult(
                    decision=Decision.ALLOW,
                    reason="Cedar policy permitted medium-risk change in development environment.",
                    policy_name=self.POLICY_NAME,
                    applied_rule="DEV_ALLOW_WARNING",
                    provider=self.PROVIDER_NAME,
                    warnings=[
                        "Medium-risk change permitted in development environment "
                        "under Cedar policy."
                    ],
                )
            return PolicyEvaluationResult(
                decision=Decision.ALLOW,
                reason=f"Cedar policy permitted release in environment '{env}'.",
                policy_name=self.POLICY_NAME,
                applied_rule="ALLOW_SAFE",
                provider=self.PROVIDER_NAME,
            )

        # Deny can mean BLOCK or REVIEW depending on severity & policy rules
        if severity == Severity.HIGH or compatibility_result == "BREAK":
            return PolicyEvaluationResult(
                decision=Decision.BLOCK,
                reason=f"Cedar policy strictly denied high-severity breaking change in '{env}'.",
                policy_name=self.POLICY_NAME,
                applied_rule="PROD_BLOCK_BREAK",
                provider=self.PROVIDER_NAME,
            )

        # Medium in staging/production evaluates to Deny, meaning REVIEW
        return PolicyEvaluationResult(
            decision=Decision.REVIEW,
            reason=f"Cedar policy requires engineering review for medium-risk change in '{env}'.",
            policy_name=self.POLICY_NAME,
            applied_rule="PROD_REVIEW_MEDIUM",
            provider=self.PROVIDER_NAME,
        )


def get_policy_engine_type() -> str:
    """Return the configured policy engine name ('standard' or 'cedar')."""
    return os.environ.get("EVENTGATE_POLICY_ENGINE", "standard").strip().lower()


def get_policy_engine(provider: str | None = None) -> IPolicyEngine:
    """Instantiate the configured policy engine.

    Raises ConfigurationError for an unknown engine name instead of falling back.
    """
    engine_type = (provider or get_policy_engine_type()).strip().lower()
    if engine_type == "standard":
        return StandardReleasePolicyEngine()
    if engine_type == "cedar":
        return CedarReleasePolicyEngine()
    raise ConfigurationError(
        f"Unknown policy engine '{engine_type}'. Supported engines: 'standard', 'cedar'."
    )


def policy_matrix() -> list[dict[str, str]]:
    """Decision per environment and severity, derived from the standard engine.

    Used by the policy inspection endpoint so the published matrix cannot drift
    from the rules that are actually enforced.
    """
    engine = StandardReleasePolicyEngine()
    compat_for = {Severity.LOW: "SAFE", Severity.MEDIUM: "RISK", Severity.HIGH: "BREAK"}
    rows = []
    for env in (Environment.PRODUCTION, Environment.STAGING, Environment.DEVELOPMENT):
        row = {"environment": env.value}
        for severity in Severity:
            result = engine.evaluate(compat_for[severity], severity, env.value, findings=[])
            label = result.decision.value
            if result.warnings:
                label += " with warning"
            row[severity.value.lower()] = label
        rows.append(row)
    return rows
