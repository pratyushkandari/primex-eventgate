"""Run every check the CI runs: lint, type checks, tests with coverage, build, E2E.

    python scripts/check.py              # everything
    python scripts/check.py --skip-e2e   # without the end-to-end suites (no Docker or browser)
    python scripts/check.py --only backend|frontend|backend-e2e|e2e

backend-e2e needs Docker (it starts DynamoDB Local); e2e needs Playwright's
Chromium. JUnit XML and coverage reports go to reports/ (gitignored) and
frontend/coverage/. Uses the current Python interpreter for backend tools, so
run it from the project's virtual environment. Stops at the first failing step.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
PY = sys.executable
NPM = shutil.which("npm") or "npm"

STEPS: dict[str, list[tuple[str, list[str], Path]]] = {
    "backend": [
        ("ruff lint", [PY, "-m", "ruff", "check", "backend", "scripts", "consumers", "perf"], ROOT),
        (
            "ruff format",
            [PY, "-m", "ruff", "format", "--check", "backend", "scripts", "consumers", "perf"],
            ROOT,
        ),
        ("mypy", [PY, "-m", "mypy"], ROOT),
        (
            "pytest + coverage",
            [
                PY,
                "-m",
                "pytest",
                "--cov=eventgate",
                "--cov-report=term",
                "--cov-report=xml:reports/backend-coverage.xml",
                "--junitxml=reports/backend-junit.xml",
                "-q",
            ],
            ROOT,
        ),
    ],
    "frontend": [
        ("oxlint", [NPM, "run", "lint"], FRONTEND),
        ("tsc", [NPM, "run", "typecheck"], FRONTEND),
        (
            "vitest + coverage",
            [
                NPM,
                "run",
                "test:coverage",
                "--",
                "--reporter=default",
                "--reporter=junit",
                "--outputFile.junit=../reports/frontend-junit.xml",
            ],
            FRONTEND,
        ),
        ("vite build", [NPM, "run", "build"], FRONTEND),
    ],
    "backend-e2e": [
        (
            "pytest -m e2e (HTTP, DynamoDB Local)",
            [PY, "scripts/run_backend_e2e.py", "-q", "--junitxml=reports/backend-e2e-junit.xml"],
            ROOT,
        ),
    ],
    "e2e": [
        ("playwright", [NPM, "run", "test:e2e"], FRONTEND),
    ],
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--skip-e2e", action="store_true", help="skip both end-to-end suites")
    parser.add_argument("--only", choices=sorted(STEPS), help="run one group")
    args = parser.parse_args()

    groups = (
        [args.only]
        if args.only
        else [g for g in STEPS if not (g.endswith("e2e") and args.skip_e2e)]
    )
    results: list[tuple[str, float]] = []
    for group in groups:
        for name, cmd, cwd in STEPS[group]:
            print(f"\n=== {group}: {name} ===", flush=True)
            start = time.perf_counter()
            code = subprocess.call(cmd, cwd=cwd)
            elapsed = time.perf_counter() - start
            if code != 0:
                print(f"\nFAILED: {group}: {name} (exit {code})")
                return code
            results.append((f"{group}: {name}", elapsed))

    print("\nAll checks passed:")
    for name, elapsed in results:
        print(f"  {name:<32} {elapsed:6.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
