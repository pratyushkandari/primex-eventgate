"""Static checks on the automatic deploy: the GitHub deploy role and its workflow."""

from pathlib import Path

import yaml

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class _CFTagLoader(yaml.SafeLoader):
    pass


def _ignore_tag(loader, node):
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    return loader.construct_mapping(node)


for _tag in ("!Ref", "!Sub", "!GetAtt"):
    _CFTagLoader.add_constructor(_tag, _ignore_tag)


def _role() -> dict:
    text = (_REPO_ROOT / "infra" / "github-deploy-role.yaml").read_text(encoding="utf-8")
    return yaml.load(text, Loader=_CFTagLoader)["Resources"]["DeployRole"]["Properties"]


def _statements() -> dict[str, dict]:
    return {s["Sid"]: s for s in _role()["Policies"][0]["PolicyDocument"]["Statement"]}


def test_only_the_main_branch_of_the_repository_can_assume_the_role():
    (statement,) = _role()["AssumeRolePolicyDocument"]["Statement"]
    conditions = statement["Condition"]["StringEquals"]
    assert conditions["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
    assert conditions["token.actions.githubusercontent.com:sub"] == (
        "repo:${GitHubRepository}:ref:refs/heads/main"
    )


def test_the_role_cannot_change_itself():
    assert not _role()["RoleName"].startswith("primex-eventgate-dev-")
    assert _statements()["StackFunctionRoles"]["Resource"].endswith(":role/${StackPrefix}-*")


def test_tables_cannot_be_deleted_and_roles_only_reach_lambda():
    statements = _statements()
    assert statements["KeepTheTables"] == {
        "Sid": "KeepTheTables",
        "Effect": "Deny",
        "Action": "dynamodb:DeleteTable",
        "Resource": "*",
    }
    assert statements["PassRolesOnlyToLambda"]["Condition"] == {
        "StringEquals": {"iam:PassedToService": "lambda.amazonaws.com"}
    }


def test_deploy_runs_after_ci_on_main_and_never_cancels_a_running_deploy():
    workflow = yaml.safe_load((_REPO_ROOT / ".github/workflows/deploy.yml").read_text("utf-8"))
    trigger = workflow[True]["workflow_run"]  # PyYAML reads the "on" key as True
    assert trigger == {"workflows": ["CI"], "types": ["completed"], "branches": ["main"]}
    assert workflow["concurrency"]["cancel-in-progress"] is False
    assert workflow["permissions"] == {"contents": "read", "id-token": "write"}
    assert "conclusion == 'success'" in workflow["jobs"]["deploy"]["if"]
