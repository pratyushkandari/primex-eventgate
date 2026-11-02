"""Unit tests for the EventGate CLI."""

import json

from click.testing import CliRunner

from eventgate.cli.main import main


def test_cli_help():
    runner = CliRunner()
    result = runner.invoke(main, ["--help"])
    assert result.exit_code == 0
    assert "EventGate" in result.output
    assert "check" in result.output
    assert "catalog" in result.output
    assert "history" in result.output
    assert "test" in result.output


def test_cli_version():
    runner = CliRunner()
    result = runner.invoke(main, ["--version"])
    assert result.exit_code == 0
    assert "eventgate, version" in result.output


def test_cli_catalog_all():
    runner = CliRunner()
    result = runner.invoke(main, ["catalog"])
    assert result.exit_code == 0
    assert "Registered Event Contracts" in result.output
    assert "OrderPlaced" in result.output
    assert "PaymentCompleted" in result.output
    assert "UserCreated" in result.output


def test_cli_catalog_event_detail():
    runner = CliRunner()
    result = runner.invoke(main, ["catalog", "-e", "OrderPlaced"])
    assert result.exit_code == 0
    assert "Event: OrderPlaced" in result.output
    assert "Versions (4): [1, 2, 3, 4]" in result.output
    assert "billing-service" in result.output
    assert "inventory-service" in result.output
    assert "analytics-service" in result.output


def test_cli_catalog_event_not_found():
    runner = CliRunner()
    result = runner.invoke(main, ["catalog", "-e", "NonExistentEvent"])
    assert result.exit_code == 1
    assert "Error:" in result.output


def test_cli_check_safe_allow():
    runner = CliRunner()
    result = runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "2", "--env", "production"],
    )
    assert result.exit_code == 0
    assert "Final Decision: ALLOW" in result.output
    assert "Compatibility:  SAFE (LOW)" in result.output


def test_cli_check_breaking_block():
    runner = CliRunner()
    result = runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "3", "--env", "production"],
    )
    assert result.exit_code == 1
    assert "Final Decision: BLOCK" in result.output
    assert "Compatibility:  BREAK (HIGH)" in result.output
    assert "inventory-service" in result.output
    assert "shippingMethod" in result.output


def test_cli_check_risk_review():
    runner = CliRunner()
    result = runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "4", "--env", "production"],
    )
    assert result.exit_code == 2
    assert "Final Decision: REVIEW" in result.output
    assert "Compatibility:  RISK (MEDIUM)" in result.output
    assert "analytics-service" in result.output


def test_cli_check_fail_on_review():
    runner = CliRunner()
    result = runner.invoke(
        main,
        [
            "check",
            "-e",
            "OrderPlaced",
            "-c",
            "1",
            "-p",
            "4",
            "--env",
            "production",
            "--fail-on-review",
        ],
    )
    assert result.exit_code == 1
    assert "Final Decision: REVIEW" in result.output


def test_cli_check_json_format():
    runner = CliRunner()
    result = runner.invoke(
        main,
        [
            "check",
            "-e",
            "OrderPlaced",
            "-c",
            "1",
            "-p",
            "2",
            "--env",
            "production",
            "--format",
            "json",
        ],
    )
    assert result.exit_code == 0
    parsed = json.loads(result.output)
    assert parsed["event_type"] == "OrderPlaced"
    assert parsed["decision"] == "ALLOW"
    assert parsed["compatibility_result"] == "SAFE"


def test_cli_check_markdown_format():
    runner = CliRunner()
    result = runner.invoke(
        main,
        [
            "check",
            "-e",
            "OrderPlaced",
            "-c",
            "1",
            "-p",
            "3",
            "--env",
            "production",
            "--format",
            "markdown",
        ],
    )
    assert result.exit_code == 1
    assert "# EventGate Release Review Report" in result.output
    assert "**BLOCK**" in result.output


def test_cli_test_command_pass():
    runner = CliRunner()
    result = runner.invoke(
        main,
        [
            "test",
            "-e",
            "OrderPlaced",
            "-c",
            "1",
            "-p",
            "2",
            "--expected",
            "ALLOW",
            "--env",
            "production",
        ],
    )
    assert result.exit_code == 0
    assert "PASS:" in result.output


def test_cli_test_command_fail():
    runner = CliRunner()
    result = runner.invoke(
        main,
        [
            "test",
            "-e",
            "OrderPlaced",
            "-c",
            "1",
            "-p",
            "3",
            "--expected",
            "ALLOW",
            "--env",
            "production",
        ],
    )
    assert result.exit_code == 1
    assert "FAIL:" in result.output


def test_cli_history_command():
    runner = CliRunner()
    # Trigger an analysis first with --persist to ensure at least 1 record
    runner.invoke(
        main,
        ["check", "-e", "OrderPlaced", "-c", "1", "-p", "2", "--env", "production", "--persist"],
    )
    result = runner.invoke(main, ["history", "-n", "5"])
    assert result.exit_code == 0
    assert "Recent Release Reviews" in result.output
    assert "OrderPlaced" in result.output


def test_cli_rejects_unknown_environment():
    runner = CliRunner()
    result = runner.invoke(
        main, ["check", "-e", "OrderPlaced", "-c", "1", "-p", "2", "--env", "prod"]
    )
    assert result.exit_code == 2
    assert "prod" in result.output


def test_cli_test_command_unknown_event_reports_error():
    runner = CliRunner()
    result = runner.invoke(
        main, ["test", "-e", "NoSuchEvent", "-c", "1", "-p", "2", "--expected", "ALLOW"]
    )
    assert result.exit_code == 1
    assert "CONTRACT_NOT_FOUND" in result.output
    assert result.exception is None or isinstance(result.exception, SystemExit)


def test_cli_check_persist_failure_warns_but_keeps_decision(monkeypatch):
    from eventgate.cli import main as cli_module

    class BrokenHistory:
        def record_evaluation(self, **kwargs):
            raise OSError("disk full")

    monkeypatch.setattr(cli_module, "get_history_service", lambda: BrokenHistory())
    runner = CliRunner()
    result = runner.invoke(main, ["check", "-e", "OrderPlaced", "-c", "1", "-p", "2", "--persist"])
    assert result.exit_code == 0
    assert "could not persist history record: disk full" in result.output


def test_cli_check_persist_writes_configured_history(isolate_history_for_tests):
    runner = CliRunner()
    result = runner.invoke(main, ["check", "-e", "OrderPlaced", "-c", "1", "-p", "3", "--persist"])
    assert result.exit_code == 1
    assert "OrderPlaced" in isolate_history_for_tests.read_text(encoding="utf-8")


def test_cli_check_without_persist_leaves_history_untouched(isolate_history_for_tests):
    before = isolate_history_for_tests.read_text(encoding="utf-8")
    runner = CliRunner()
    runner.invoke(main, ["check", "-e", "OrderPlaced", "-c", "1", "-p", "3"])
    assert isolate_history_for_tests.read_text(encoding="utf-8") == before


def test_cli_check_prints_policy_warnings_in_development():
    runner = CliRunner()
    result = runner.invoke(
        main, ["check", "-e", "OrderPlaced", "-c", "1", "-p", "4", "--env", "development"]
    )
    assert result.exit_code == 0
    assert "[WARNING] Medium-risk change permitted in development environment." in result.output


def test_cli_history_with_no_records_says_so(isolate_history_for_tests):
    runner = CliRunner()
    result = runner.invoke(main, ["history"])
    assert result.exit_code == 0
    assert "No release evaluations recorded in history." in result.output
