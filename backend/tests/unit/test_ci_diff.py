import json
from pathlib import Path
from unittest.mock import patch

import pytest
from scripts.ci_contract_diff import (
    main,
    parse_contract_info,
    resolve_current_version,
    run_contract_check,
)


def test_parse_contract_info_valid(tmp_path: Path):
    contract_file = tmp_path / "v2.json"
    contract_file.write_text(
        json.dumps({"eventType": "OrderPlaced", "version": 2, "fields": {}}),
        encoding="utf-8",
    )
    event_type, version = parse_contract_info(contract_file)
    assert event_type == "OrderPlaced"
    assert version == 2


def test_parse_contract_info_invalid(tmp_path: Path):
    contract_file = tmp_path / "invalid.json"
    contract_file.write_text(
        json.dumps({"description": "missing eventType"}),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="missing 'eventType' or 'version'"):
        parse_contract_info(contract_file)


def test_resolve_current_version_derives_preceding_version():
    # OrderPlaced has [1, 2, 3, 4]
    v_for_2 = resolve_current_version("OrderPlaced", proposed_version=2)
    assert v_for_2 == 1

    v_for_3 = resolve_current_version("OrderPlaced", proposed_version=3)
    assert v_for_3 == 2

    v_for_4 = resolve_current_version("OrderPlaced", proposed_version=4)
    assert v_for_4 == 3


def test_resolve_current_version_initial_v1():
    v_for_1 = resolve_current_version("OrderPlaced", proposed_version=1)
    assert v_for_1 is None


def test_run_contract_check_safe():
    exit_code, output = run_contract_check(
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=2,
        environment="production",
    )
    assert exit_code == 0
    assert "Final Decision: ALLOW" in output


def test_run_contract_check_breaking():
    exit_code, output = run_contract_check(
        event_type="OrderPlaced",
        current_version=1,
        proposed_version=3,
        environment="production",
    )
    assert exit_code == 1
    assert "Final Decision: BLOCK" in output


def test_ci_diff_main_safe():
    with patch(
        "sys.argv",
        [
            "ci_contract_diff.py",
            "-f",
            "contracts/events/order-placed/v2-safe.json",
            "--env",
            "production",
        ],
    ):
        code = main()
        assert code == 0


def test_ci_diff_main_breaking():
    with patch(
        "sys.argv",
        [
            "ci_contract_diff.py",
            "-f",
            "contracts/events/order-placed/v3-breaking.json",
            "--env",
            "production",
        ],
    ):
        code = main()
        assert code == 1
