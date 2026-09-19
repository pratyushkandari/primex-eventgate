# EventGate Developer & CI Release Control CLI

`eventgate` is the authoritative command-line release gate and developer tool for the PrimeX EventGate platform. It enforces contract compatibility, evaluates environment release policy, runs automated assertions, and integrates into Git pre-push hooks and CI/CD pipelines.

---

## 1. Installation & Environment Setup

### Editable Local Installation

From the repository root:

```bash
# In active virtual environment:
pip install -e .

# Verify installation:
eventgate --version
eventgate --help
```

### Direct Python Invocation

If running without global entrypoint installation:

```bash
python -m eventgate.cli.main --help
```

---

## 2. Command Reference

### `eventgate check`

Analyzes proposed event contract evolution against registered downstream consumer contracts and evaluates environment release policy.

```bash
eventgate check \
  --event <EVENT_TYPE> \
  --current <CURRENT_VERSION> \
  --proposed <PROPOSED_VERSION> \
  [--env production|staging|development] \
  [--format table|json|markdown] \
  [--fail-on-review]
```

#### Options:

| Option | Flag | Default | Description |
| :--- | :--- | :--- | :--- |
| `--event` | `-e` | *Required* | Contract name (e.g. `OrderPlaced`, `PaymentCompleted`) |
| `--current` | `-c` | *Required* | Established base version integer (e.g. `1`) |
| `--proposed` | `-p` | *Required* | Target release version integer (e.g. `2`, `3`) |
| `--env` | | `production` | Target deployment environment (`production`, `staging`, `development`) |
| `--format` | | `table` | Output format: `table`, `json`, or `markdown` |
| `--fail-on-review` | | `False` | Treat `REVIEW` decisions as failures (exit code `1`) |

#### Deterministic Exit Codes:

| Exit Code | Decision | Meaning |
| :---: | :---: | :--- |
| **`0`** | **`ALLOW`** | Safe backward-compatible change permitted by environment policy. |
| **`1`** | **`BLOCK`** | Breaking change rejected by policy. Gate blocks release. |
| **`2`** | **`REVIEW`** | Medium-risk change requires manual review. Returns `1` if `--fail-on-review` is set. |

#### Examples:

```bash
# 1. Evaluate safe addition (Exits 0):
eventgate check -e OrderPlaced -c 1 -p 2 --env production

# 2. Evaluate breaking field mutation (Exits 1):
eventgate check -e OrderPlaced -c 1 -p 3 --env production

# 3. Evaluate medium-risk optional field removal (Exits 2):
eventgate check -e OrderPlaced -c 1 -p 4 --env production

# 4. Strict CI gate evaluation (Exits 1 on review):
eventgate check -e OrderPlaced -c 1 -p 4 --env production --fail-on-review

# 5. Export GitHub-Flavored Markdown summary:
eventgate check -e OrderPlaced -c 1 -p 3 --env production --format markdown >> $GITHUB_STEP_SUMMARY
```

---

### `eventgate catalog`

Inspects registered event contracts, available versions, and subscribed consumers.

```bash
# List all registered event contracts:
eventgate catalog

# Inspect details for a specific event contract:
eventgate catalog --event OrderPlaced
```

---

### `eventgate history`

Queries persistent release audit records from the local audit store (`contracts/history/reviews.json`) or Amazon DynamoDB.

```bash
# View recent release reviews:
eventgate history

# Filter by event type and limit results:
eventgate history --event OrderPlaced --limit 10
```

---

### `eventgate test`

Runs automated contract regression assertions against expected policy outcomes.

```bash
eventgate test \
  --event <EVENT_TYPE> \
  --current <CURRENT_VERSION> \
  --proposed <PROPOSED_VERSION> \
  --expected ALLOW|REVIEW|BLOCK \
  [--env production]
```

#### Exit Codes:
* **`0`**: Actual release decision matches expected policy outcome (`PASS`).
* **`1`**: Actual release decision diverges from expectation (`FAIL`).

---

## 3. CI Version Detection (`scripts/ci_contract_diff.py`)

In continuous integration, contract files modified in a pull request are automatically detected from Git diffs.

```bash
python scripts/ci_contract_diff.py \
  --base-ref origin/main \
  --head-ref HEAD \
  --env production \
  --fail-on-review
```

### Deterministic Version Resolution:
1. `ci_contract_diff.py` scans changed paths under `contracts/events/**`.
2. For each changed contract JSON file, it parses `eventType` and proposed `version`.
3. It inspects existing repository contract versions and derives the established current version ($V_{current} = \max(v < V_{proposed})$). It never hard-codes version numbers.
4. Executes `eventgate check` and appends audit evidence to `$GITHUB_STEP_SUMMARY`.
5. Exits non-zero if any contract evolution is `BLOCK` or `REVIEW` (when `--fail-on-review` is enabled).

---

## 4. GitHub Actions Release Gate Workflow

The repository includes `.github/workflows/eventgate-contract-check.yml`, which triggers on:
- **Pull Requests:** Any change under `contracts/**`.
- **Manual Dispatch:** Allows testing arbitrary contract versions and environments directly from GitHub Actions UI.
