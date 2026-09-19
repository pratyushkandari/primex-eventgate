"""CI Contract Diff & Release Gate Runner.

Inspects Git pull request or commit diffs for changed event contract definitions,
deterministically resolves the preceding established contract version from the
repository, and executes the EventGate release policy gate.

Usage:
    python scripts/ci_contract_diff.py [--file path/to/contract.json] [--env production]
    python scripts/ci_contract_diff.py --base-ref origin/main --head-ref HEAD
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_SRC = REPO_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from eventgate.config.settings import get_contracts_dir  # noqa: E402
from eventgate.infrastructure.repositories.event_contract_repository import (  # noqa: E402
    JsonEventContractRepository,
)


def detect_changed_files(base_ref: str = "origin/main", head_ref: str = "HEAD") -> list[Path]:
    """Detect changed contract JSON files using git diff."""
    # Try git diff against base_ref
    cmd = ["git", "diff", "--name-only", f"{base_ref}...{head_ref}"]
    try:
        res = subprocess.run(
            cmd,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
        if res.returncode == 0 and res.stdout.strip():
            files = [
                REPO_ROOT / line.strip()
                for line in res.stdout.strip().splitlines()
                if line.strip()
            ]
            return [
                f
                for f in files
                if "contracts/events" in str(f).replace("\\", "/") and f.suffix == ".json"
            ]
    except Exception:
        pass

    # Fallback: git diff HEAD~1
    try:
        res = subprocess.run(
            ["git", "diff", "--name-only", "HEAD~1"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
        if res.returncode == 0 and res.stdout.strip():
            files = [
                REPO_ROOT / line.strip()
                for line in res.stdout.strip().splitlines()
                if line.strip()
            ]
            return [
                f
                for f in files
                if "contracts/events" in str(f).replace("\\", "/") and f.suffix == ".json"
            ]
    except Exception:
        pass

    return []


def parse_contract_info(file_path: Path) -> tuple[str, int]:
    """Extract event type and proposed version from contract JSON."""
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)

    event_type = data.get("eventType")
    version = data.get("version")

    if not event_type or version is None:
        raise ValueError(
            f"Invalid contract format in {file_path}: missing 'eventType' or 'version'"
        )

    return str(event_type), int(version)


def resolve_current_version(
    event_type: str,
    proposed_version: int,
    contracts_dir: Path | None = None,
) -> int | None:
    """Derive the established current version from the repository catalog.

    Finds the highest existing version strictly lower than proposed_version.
    If none exist (e.g. initial v1 creation), returns None.
    """
    contracts_path = contracts_dir or get_contracts_dir()
    repo = JsonEventContractRepository(contracts_path)

    try:
        existing_versions = repo.get_event_versions(event_type)
    except Exception:
        existing_versions = []

    prior_versions = [v for v in existing_versions if v < proposed_version]
    if prior_versions:
        return max(prior_versions)

    # If proposed_version is greater than 1 but no prior versions found in repo,
    # fallback to proposed_version - 1
    if proposed_version > 1:
        return proposed_version - 1

    return None


def run_contract_check(
    event_type: str,
    current_version: int,
    proposed_version: int,
    environment: str = "production",
    fail_on_review: bool = False,
) -> tuple[int, str]:
    """Execute eventgate check via CLI and return (exit_code, output)."""
    cmd = [
        sys.executable,
        "-m",
        "eventgate.cli.main",
        "check",
        "--event",
        event_type,
        "--current",
        str(current_version),
        "--proposed",
        str(proposed_version),
        "--env",
        environment,
    ]
    if fail_on_review:
        cmd.append("--fail-on-review")

    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND_SRC)

    res = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    output = res.stdout + (("\n" + res.stderr) if res.stderr else "")
    return res.returncode, output


def main() -> int:
    """CI contract diff entry point."""
    parser = argparse.ArgumentParser(
        description="EventGate CI contract change diff analyzer and release gate."
    )
    parser.add_argument(
        "--file",
        "-f",
        type=Path,
        help="Explicit contract file to evaluate (skips git diff detection).",
    )
    parser.add_argument(
        "--base-ref",
        default="origin/main",
        help="Base git reference for diff calculation (default: origin/main).",
    )
    parser.add_argument(
        "--head-ref",
        default="HEAD",
        help="Head git reference for diff calculation (default: HEAD).",
    )
    parser.add_argument(
        "--env",
        default="production",
        help="Target deployment environment (default: production).",
    )
    parser.add_argument(
        "--fail-on-review",
        action="store_true",
        help="Treat REVIEW decision as non-zero failure.",
    )
    parser.add_argument(
        "--summary-file",
        type=Path,
        help="File path to write GitHub Step Summary markdown.",
    )

    args = parser.parse_args()

    # Determine files to inspect
    if args.file:
        files = [args.file.resolve()]
    else:
        files = detect_changed_files(base_ref=args.base_ref, head_ref=args.head_ref)

    if not files:
        print("CI Gate: No event contract changes detected under contracts/events/**.")
        return 0

    print(f"CI Gate: Detected {len(files)} changed event contract(s).")
    overall_failure = False
    summaries: list[str] = [
        "## EventGate Contract Release Gate Summary\n",
        f"**Environment:** `{args.env}`\n",
    ]

    for contract_file in files:
        if not contract_file.exists():
            print(f"Skipping non-existent file: {contract_file}")
            continue

        try:
            event_type, proposed_version = parse_contract_info(contract_file)
        except Exception as exc:
            print(f"Error parsing contract {contract_file}: {exc}", file=sys.stderr)
            overall_failure = True
            continue

        current_version = resolve_current_version(event_type, proposed_version)

        if current_version is None:
            print(
                f"Notice: {event_type} v{proposed_version} is an initial contract version. "
                f"Skipping backward compatibility check."
            )
            summaries.append(
                f"- **{event_type} v{proposed_version}**: Initial contract release (SAFE)"
            )
            continue

        print(
            f"Evaluating: {event_type} "
            f"(current: v{current_version} -> proposed: v{proposed_version})"
        )
        exit_code, output = run_contract_check(
            event_type=event_type,
            current_version=current_version,
            proposed_version=proposed_version,
            environment=args.env,
            fail_on_review=args.fail_on_review,
        )

        print(output)

        if exit_code == 0:
            summaries.append(
                f"- **{event_type} v{current_version} -> v{proposed_version}**: "
                f"`ALLOW` (Release Permitted)"
            )
        elif exit_code == 1:
            overall_failure = True
            summaries.append(
                f"- **{event_type} v{current_version} -> v{proposed_version}**: "
                f"`BLOCK` (Release Blocked - Breaking Changes Detected)"
            )
        elif exit_code == 2:
            if args.fail_on_review:
                overall_failure = True
            summaries.append(
                f"- **{event_type} v{current_version} -> v{proposed_version}**: "
                f"`REVIEW` (Manual Approval Required)"
            )

    # Write summary if requested
    summary_dest = args.summary_file or os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_dest:
        try:
            with open(summary_dest, "a", encoding="utf-8") as f:
                f.write("\n".join(summaries) + "\n")
        except Exception as exc:
            print(f"Warning: Failed to write step summary: {exc}", file=sys.stderr)

    return 1 if overall_failure else 0


if __name__ == "__main__":
    sys.exit(main())
