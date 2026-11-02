# CLI

`eventgate` runs the same analysis and policy as the API, without a server. It reads the storage backend from the same environment variables (`.env.example`), so by default it uses the JSON contracts in `contracts/`.

```bash
pip install -e .          # installs the eventgate command
eventgate --help
```

## `eventgate check`

Analyze a change and apply the release policy.

```bash
eventgate check --event OrderPlaced --current 1 --proposed 3 --env production
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--event`, `-e` | required | Event type |
| `--current`, `-c` | required | Current version |
| `--proposed`, `-p` | required | Proposed version |
| `--env` | `production` | `development`, `staging` or `production` (other values are rejected) |
| `--format` | `table` | `table`, `json` or `markdown` (the same report as the API) |
| `--fail-on-review` | off | Exit 1 instead of 2 on REVIEW |
| `--persist` | off | Write the result to release history (or set `EVENTGATE_PERSIST_HISTORY=true`). If writing fails, a warning is printed and the exit code still reflects the decision. |

| Exit code | Meaning |
| --- | --- |
| 0 | ALLOW |
| 1 | BLOCK, an error (unknown event or version), or REVIEW with `--fail-on-review` |
| 2 | REVIEW |

## `eventgate test`

Assert that a change gets the decision you expect; exit 0 on a match, 1 otherwise.

```bash
eventgate test --event OrderPlaced --current 1 --proposed 4 --expected REVIEW --env production
```

## `eventgate catalog`

```bash
eventgate catalog                     # event types, latest versions, consumer counts
eventgate catalog --event OrderPlaced # versions and subscribed consumers of one event
```

## `eventgate history`

```bash
eventgate history --event OrderPlaced --limit 10
```

Lists recorded reviews from the configured history store (`.eventgate/history.json` locally, DynamoDB when `EVENTGATE_STORAGE_BACKEND=dynamodb`), newest first. `--limit`/`-n` defaults to 20.

## Pull request gate

`.github/workflows/eventgate-contract-check.yml` runs on pull requests that change `contracts/**`. `scripts/ci_contract_diff.py` finds the changed event contract files, compares each proposed version with the highest lower version in the working tree, and runs `eventgate check --env production --fail-on-review`; any BLOCK or REVIEW fails the job and the results are written to the job summary. A manual `workflow_dispatch` run checks one change you name.

Limitation: the comparison is between adjacent versions in the pull request's working tree, so editing an existing version file in place is not compared against its previous content on the base branch.
