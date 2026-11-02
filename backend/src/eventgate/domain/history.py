"""Release history records: the audit trail of analyses and publication attempts."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any

from eventgate.domain.enums import CompatibilityStatus, Decision, Severity
from eventgate.domain.models import Finding


def summarize_findings(findings: Iterable[Finding]) -> list[dict[str, Any]]:
    """Serialize findings into the camelCase shape stored on release records."""
    return [
        {
            "consumerId": f.consumer_id,
            "status": f.status.value,
            "ruleId": f.rule_id,
            "field": f.field,
            "expectedType": f.expected_type,
            "proposedType": f.proposed_type,
            "severity": f.severity.value,
            "reason": f.reason,
        }
        for f in findings
    ]


def affected_consumer_ids(findings: Iterable[Finding]) -> list[str]:
    """Sorted IDs of consumers with at least one RISK or BREAK finding."""
    return sorted({f.consumer_id for f in findings if f.status != CompatibilityStatus.SAFE})


@dataclass(frozen=True)
class ReleaseRecord:
    """One analysis of a contract change and, if attempted, its publication outcome."""

    record_id: str
    analysis_id: str
    event_type: str
    current_version: int
    proposed_version: int
    environment: str
    compatibility_result: str
    severity: str
    policy_name: str
    policy_reason: str
    decision: str
    affected_consumers: list[str]
    findings_summary: list[dict[str, Any]]
    published: bool
    attempted_publish: bool = False
    event_id: str | None = None
    event_bridge_event_id: str | None = None
    request_id: str | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    published_at: datetime | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize record to dictionary with ISO timestamps."""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        if self.published_at:
            data["published_at"] = self.published_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReleaseRecord:
        """Construct ReleaseRecord from dictionary."""
        ts_str = data.get("timestamp")
        ts = datetime.fromisoformat(ts_str) if ts_str else datetime.now(UTC)

        pub_ts_str = data.get("published_at")
        pub_ts = datetime.fromisoformat(pub_ts_str) if pub_ts_str else None

        return cls(
            record_id=data["record_id"],
            analysis_id=data.get("analysis_id", data["record_id"]),
            event_type=data["event_type"],
            current_version=int(data["current_version"]),
            proposed_version=int(data["proposed_version"]),
            environment=data.get("environment", "production"),
            compatibility_result=data.get("compatibility_result", "SAFE"),
            severity=data.get("severity", Severity.LOW.value),
            policy_name=data.get("policy_name", "StandardReleasePolicy"),
            policy_reason=data.get("policy_reason", "Policy evaluation completed"),
            decision=data.get("decision", Decision.ALLOW.value),
            affected_consumers=list(data.get("affected_consumers", [])),
            findings_summary=list(data.get("findings_summary", [])),
            published=bool(data.get("published", False)),
            attempted_publish=bool(data.get("attempted_publish", False)),
            event_id=data.get("event_id"),
            event_bridge_event_id=data.get("event_bridge_event_id"),
            request_id=data.get("request_id"),
            timestamp=ts,
            published_at=pub_ts,
            error=data.get("error"),
        )
