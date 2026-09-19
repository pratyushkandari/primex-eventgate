"""EventGate CLI -- Developer and CI release-control gate.

Commands:
- eventgate check: Analyze event compatibility and enforce release policy
- eventgate catalog: Inspect registered event contracts and schemas
- eventgate history: Query release audit records
- eventgate test: Run automated contract regression assertions

Exit codes for 'check':
- 0: ALLOW (Safe or permitted by environment policy)
- 1: BLOCK (Breaking change rejected)
- 2: REVIEW (Manual approval required, exits 1 if --fail-on-review)
"""

from __future__ import annotations

import os
import sys

import click

from eventgate.api.dependencies import (
    get_analysis_service,
    get_catalog_service,
    get_history_service,
)
from eventgate.application.services.release_history_service import ReleaseHistoryService
from eventgate.domain.enums import CompatibilityStatus, Decision
from eventgate.domain.errors import EventGateError
from eventgate.domain.history import ReleaseRecord
from eventgate.domain.reports import generate_json_report, generate_markdown_report
from eventgate.infrastructure.repositories.release_review_repository import (
    InMemoryReleaseReviewRepository,
)


@click.group()
@click.version_option(version="0.1.0", prog_name="eventgate")
def main():
    """EventGate - Enterprise Event Contract Release-Control Platform."""
    pass


@main.command(name="check")
@click.option(
    "--event",
    "-e",
    "event_type",
    required=True,
    help="Event contract name (e.g. OrderPlaced).",
)
@click.option(
    "--current",
    "-c",
    "current_version",
    type=int,
    required=True,
    help="Current production contract version.",
)
@click.option(
    "--proposed",
    "-p",
    "proposed_version",
    type=int,
    required=True,
    help="Proposed new contract version.",
)
@click.option(
    "--env",
    "environment",
    default="production",
    show_default=True,
    help="Target deployment environment (development, staging, production).",
)
@click.option(
    "--format",
    "output_format",
    type=click.Choice(["table", "json", "markdown"], case_sensitive=False),
    default="table",
    show_default=True,
    help="Output formatting style.",
)
@click.option(
    "--fail-on-review",
    is_flag=True,
    default=False,
    help="Treat REVIEW decision as failure (exit code 1).",
)
@click.option(
    "--persist",
    is_flag=True,
    default=False,
    help="Persist evaluation record to release history.",
)
def check_command(
    event_type: str,
    current_version: int,
    proposed_version: int,
    environment: str,
    output_format: str,
    fail_on_review: bool,
    persist: bool,
):
    """Analyze contract compatibility against downstream consumers and evaluate policy."""
    try:
        service = get_analysis_service()
        result = service.analyze(
            event_type=event_type,
            current_version=current_version,
            proposed_version=proposed_version,
            environment=environment,
        )
    except EventGateError as exc:
        click.secho(f"Error: {exc.message} ({exc.code})", fg="red", err=True)
        sys.exit(1)
    except Exception as exc:
        click.secho(f"Unexpected error during analysis: {exc}", fg="red", err=True)
        sys.exit(1)

    # Persist in history
    try:
        should_persist = persist or os.environ.get("EVENTGATE_PERSIST_HISTORY", "").lower() in (
            "1",
            "true",
            "yes",
        )
        if should_persist:
            history_service = get_history_service()
        else:
            history_service = ReleaseHistoryService(review_repo=InMemoryReleaseReviewRepository())
        findings_summary = [
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
            for f in result.findings
        ]
        affected_consumers = sorted(
            {f.consumer_id for f in result.findings if f.status != CompatibilityStatus.SAFE}
        )
        history_service.record_evaluation(
            analysis_id=result.analysis_id,
            event_type=result.event_type,
            current_version=result.current_version,
            proposed_version=result.proposed_version,
            environment=result.environment,
            compatibility_result=result.compatibility_result,
            severity=result.severity.value,
            policy_name=result.policy_name,
            policy_reason=result.policy_reason or result.summary,
            decision=result.decision.value,
            affected_consumers=affected_consumers,
            findings_summary=findings_summary,
        )
    except Exception:
        pass

    # Build Record for report rendering
    rec = ReleaseRecord(
        record_id=result.analysis_id,
        analysis_id=result.analysis_id,
        event_type=result.event_type,
        current_version=result.current_version,
        proposed_version=result.proposed_version,
        environment=result.environment,
        compatibility_result=result.compatibility_result,
        severity=result.severity.value,
        policy_name=result.policy_name,
        policy_reason=result.policy_reason or result.summary,
        decision=result.decision.value,
        affected_consumers=sorted(
            {f.consumer_id for f in result.findings if f.status != CompatibilityStatus.SAFE}
        ),
        findings_summary=[
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
            for f in result.findings
        ],
        published=False,
    )

    if output_format.lower() == "json":
        click.echo(generate_json_report(rec))
    elif output_format.lower() == "markdown":
        click.echo(generate_markdown_report(rec))
    else:
        # Table format
        _render_table_summary(result)

    # Determine exit code
    if result.decision == Decision.ALLOW:
        sys.exit(0)
    elif result.decision == Decision.BLOCK:
        sys.exit(1)
    else:
        # Decision.REVIEW
        if fail_on_review:
            sys.exit(1)
        sys.exit(2)


def _render_table_summary(result):
    dec_color = (
        "green"
        if result.decision == Decision.ALLOW
        else ("red" if result.decision == Decision.BLOCK else "yellow")
    )

    click.echo("")
    click.secho(
        f"EventGate Release Gate: {result.event_type} "
        f"v{result.current_version} -> v{result.proposed_version}",
        bold=True,
    )
    click.echo(f"  Environment:    {result.environment}")
    click.echo(f"  Compatibility:  {result.compatibility_result} ({result.severity.value})")
    click.echo(f"  Policy Engine:  {result.policy_name}")
    click.echo(f"  Policy Reason:  {result.policy_reason}")
    click.secho(f"  Final Decision: {result.decision.value}", fg=dec_color, bold=True)
    click.echo("")

    if result.warnings:
        for w in result.warnings:
            click.secho(f"  [WARNING] {w}", fg="yellow")
        click.echo("")

    break_count = sum(1 for f in result.findings if f.status == CompatibilityStatus.BREAK)
    risk_count = sum(1 for f in result.findings if f.status == CompatibilityStatus.RISK)
    safe_count = sum(1 for f in result.findings if f.status == CompatibilityStatus.SAFE)

    click.echo(
        f"Consumers: {safe_count} safe, {risk_count} risk, {break_count} broken "
        f"({len(result.findings)} checks evaluated)"
    )

    if break_count > 0 or risk_count > 0:
        click.echo("")
        click.echo("Impacted Consumers & Diagnostics:")
        for f in result.findings:
            if f.status != CompatibilityStatus.SAFE:
                status_color = "red" if f.status == CompatibilityStatus.BREAK else "yellow"
                click.secho(
                    f"  * [{f.status.value}] {f.consumer_id} -> field '{f.field}'",
                    fg=status_color,
                )
                click.echo(f"      Rule:     {f.rule_id}")
                if f.expected_type and f.proposed_type:
                    click.echo(
                        f"      Change:   expected {f.expected_type}, proposed {f.proposed_type}"
                    )
                click.echo(f"      Reason:   {f.reason}")
    click.echo("")


@main.command(name="catalog")
@click.option("--event", "-e", "event_type", help="Optional event type to inspect detail.")
def catalog_command(event_type: str | None):
    """List registered event types or inspect specific contract versions."""
    service = get_catalog_service()
    if event_type:
        try:
            detail = service.get_event_detail(event_type)
            click.secho(f"Event: {detail.event_type}", bold=True)
            click.echo(f"  Versions ({detail.version_count}): {detail.versions}")
            click.echo(f"  Subscribed Consumers ({len(detail.consumers)}):")
            for c in detail.consumers:
                click.echo(f"    - {c.consumer_id} ({len(c.expected_fields)} expected fields)")
        except EventGateError as exc:
            click.secho(f"Error: {exc.message}", fg="red", err=True)
            sys.exit(1)
    else:
        catalog = service.get_event_catalog()
        click.secho(f"Registered Event Contracts ({len(catalog)}):", bold=True)
        for item in catalog:
            click.echo(
                f"  * {item.event_type:<20} "
                f"latest: v{item.latest_version}  "
                f"versions: {len(item.versions)}  "
                f"consumers: {item.consumer_count}"
            )


@main.command(name="history")
@click.option("--event", "-e", "event_type", help="Filter history by event type.")
@click.option(
    "--limit", "-n", default=20, show_default=True, help="Number of records to display."
)
def history_command(event_type: str | None, limit: int):
    """List recent persistent release review audit records."""
    service = get_history_service()
    reviews = service.list_reviews(event_type=event_type, limit=limit)
    if not reviews:
        click.echo("No release evaluations recorded in history.")
        return

    click.secho(f"Recent Release Reviews ({len(reviews)}):", bold=True)
    for r in reviews:
        dec_color = (
            "green"
            if r.decision == "ALLOW"
            else ("red" if r.decision == "BLOCK" else "yellow")
        )
        pub_str = (
            "PUBLISHED"
            if r.published
            else ("PREVENTED" if r.attempted_publish else "EVALUATED")
        )
        click.echo(
            f"  {r.timestamp.strftime('%Y-%m-%d %H:%M:%S')}  "
            f"{r.event_type} v{r.current_version}->v{r.proposed_version}  "
            f"{r.environment:<11}  "
            f"Decision: ",
            nl=False,
        )
        click.secho(f"{r.decision:<6}", fg=dec_color, bold=True, nl=False)
        click.echo(f"  [{pub_str}]  id: {r.record_id[:8]}...")


@main.command(name="test")
@click.option("--event", "-e", "event_type", required=True, help="Event contract name.")
@click.option(
    "--current", "-c", "current_version", type=int, required=True, help="Current version."
)
@click.option(
    "--proposed", "-p", "proposed_version", type=int, required=True, help="Proposed version."
)
@click.option(
    "--expected",
    "expected_decision",
    required=True,
    type=click.Choice(["ALLOW", "REVIEW", "BLOCK"], case_sensitive=False),
)
@click.option("--env", "environment", default="production", show_default=True)
def test_command(
    event_type: str,
    current_version: int,
    proposed_version: int,
    expected_decision: str,
    environment: str,
):
    """Assert actual release decision matches expected policy outcome."""
    service = get_analysis_service()
    result = service.analyze(
        event_type=event_type,
        current_version=current_version,
        proposed_version=proposed_version,
        environment=environment,
    )
    expected_upper = expected_decision.upper()
    actual_decision = result.decision.value

    if actual_decision == expected_upper:
        click.secho(
            f"PASS: {event_type} v{current_version}->v{proposed_version} ({environment}) "
            f"evaluates to {actual_decision} as expected.",
            fg="green",
        )
        sys.exit(0)
    else:
        click.secho(
            f"FAIL: {event_type} v{current_version}->v{proposed_version} ({environment}) "
            f"expected {expected_upper} but got {actual_decision}.",
            fg="red",
            bold=True,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
