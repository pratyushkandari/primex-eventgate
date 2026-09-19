"""Policy abstraction and evaluation engines for EventGate releases.

Strictly decouples compatibility analysis (SAFE / RISK / BREAK) from release
policy decisions (ALLOW / REVIEW / BLOCK) across deployment environments:
- development
- staging
- production

Supported policy engines:
1. 'standard' — Deterministic pure Python engine.
2. 'cedar'    — Evaluates formal AWS Cedar policy specifications via cedarpy.
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from eventgate.domain.enums import Decision, Severity
from eventgate.domain.errors import ConfigurationError
from eventgate.domain.models import Finding

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
        if policy_path is None:
            curr = Path(__file__).resolve().parent
            found_path = None
            for _ in range(6):
                candidate = curr / "policies" / "release_policy.cedar"
                if candidate.exists():
                    found_path = candidate
                    break
                curr = curr.parent
            root_fallback = (
                Path(__file__).resolve().parents[4] / "policies" / "release_policy.cedar"
            )
            policy_path = found_path or root_fallback

        self._policy_path = policy_path
        self._policy_text = self._load_policy()

    def _load_policy(self) -> str:
        """Load Cedar policy text from disk; raise ConfigurationError if missing."""
        if not self._policy_path.exists():
            raise ConfigurationError(
                f"Cedar policy file not found at '{self._policy_path}'. "
                "Ensure policies/release_policy.cedar exists when EVENTGATE_POLICY_ENGINE=cedar."
            )
        try:
            return self._policy_path.read_text(encoding="utf-8")
        except Exception as exc:
            raise ConfigurationError(
                f"Failed to read Cedar policy file '{self._policy_path}': {exc}"
            ) from exc

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


def get_policy_engine(provider: str | None = None) -> IPolicyEngine:
    """Instantiate and return the configured policy engine.

    Strictly honors EVENTGATE_POLICY_ENGINE without silent fallback.
    """
    engine_type = (
        provider or os.environ.get("EVENTGATE_POLICY_ENGINE", "standard")
    ).strip().lower()

    if engine_type == "standard":
        return StandardReleasePolicyEngine()
    elif engine_type == "cedar":
        return CedarReleasePolicyEngine()
    else:
        raise ConfigurationError(
            f"Unknown policy engine '{engine_type}'. Supported engines: 'standard', 'cedar'."
        )
