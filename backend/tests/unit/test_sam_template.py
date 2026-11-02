"""Static checks on template.yaml: resources, IAM scoping, routing and throttling."""

from pathlib import Path

import yaml

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_TEMPLATE_PATH = _REPO_ROOT / "template.yaml"


def test_sam_template_eventbridge_resources():
    assert _TEMPLATE_PATH.exists()

    # Load YAML ignoring CloudFormation tags like !Sub, !Ref, !GetAtt
    class CFTagLoader(yaml.SafeLoader):
        pass

    def ignore_tag(loader, node):
        if isinstance(node, yaml.ScalarNode):
            return loader.construct_scalar(node)
        if isinstance(node, yaml.SequenceNode):
            return loader.construct_sequence(node)
        if isinstance(node, yaml.MappingNode):
            return loader.construct_mapping(node)
        return None

    for tag in ("!Ref", "!Sub", "!GetAtt", "!Select", "!Split", "!Join"):
        CFTagLoader.add_constructor(tag, ignore_tag)

    with open(_TEMPLATE_PATH, encoding="utf-8") as f:
        template = yaml.load(f, Loader=CFTagLoader)

    resources = template.get("Resources", {})

    # 1. Custom Event Bus
    assert "EventGateEventBus" in resources
    assert resources["EventGateEventBus"]["Type"] == "AWS::Events::EventBus"

    # 2. EventBridge Rule
    assert "OrderPlacedEventRule" in resources
    rule = resources["OrderPlacedEventRule"]["Properties"]
    assert rule["State"] == "ENABLED"
    pattern = rule["EventPattern"]
    assert pattern["source"] == ["primex.eventgate"]
    assert pattern["detail-type"] == ["EventGateEvent"]
    assert pattern["detail"]["eventType"] == ["OrderPlaced"]
    assert len(rule["Targets"]) == 3

    # 3. Three Consumer Lambdas
    for consumer in ("Billing", "Inventory", "Analytics"):
        fn_key = f"{consumer}ConsumerFunction"
        perm_key = f"{consumer}ConsumerPermission"
        assert fn_key in resources
        fn_props = resources[fn_key]["Properties"]
        assert fn_props["Runtime"] == "python3.14"
        assert fn_props["MemorySize"] == 128
        assert fn_props["Timeout"] == 5
        assert fn_props["Handler"] == "consumer_handler.handler"

        # Permission
        assert perm_key in resources
        assert resources[perm_key]["Properties"]["Principal"] == "events.amazonaws.com"

    # 4. EventGateFunction routes and policies
    api_fn = resources["EventGateFunction"]["Properties"]
    events = api_fn["Events"]
    assert "HealthCheck" in events
    assert events["HealthCheck"]["Properties"]["Path"] == "/health"
    assert "CatchAllProxy" in events
    assert events["CatchAllProxy"]["Properties"]["Path"] == "/{proxy+}"
    assert events["CatchAllProxy"]["Properties"]["Method"] == "ANY"

    # 5. Outputs
    outputs = template.get("Outputs", {})
    assert "EventBusName" in outputs
    assert "EventBusArn" in outputs
    assert "BillingConsumerFunctionName" in outputs
    assert "InventoryConsumerFunctionName" in outputs
    assert "AnalyticsConsumerFunctionName" in outputs


def test_sam_template_release_history_infrastructure():
    """Verify SAM template declares ReleaseHistoryTable, Lambda env var, and IAM policies."""
    assert _TEMPLATE_PATH.exists()

    class CFTagLoader(yaml.SafeLoader):
        pass

    def ignore_tag(loader, node):
        if isinstance(node, yaml.ScalarNode):
            return loader.construct_scalar(node)
        if isinstance(node, yaml.SequenceNode):
            return loader.construct_sequence(node)
        if isinstance(node, yaml.MappingNode):
            return loader.construct_mapping(node)
        return None

    for tag in ("!Ref", "!Sub", "!GetAtt", "!Select", "!Split", "!Join"):
        CFTagLoader.add_constructor(tag, ignore_tag)

    with open(_TEMPLATE_PATH, encoding="utf-8") as f:
        template = yaml.load(f, Loader=CFTagLoader)

    resources = template.get("Resources", {})

    # 1. ReleaseHistoryTable resource
    assert "ReleaseHistoryTable" in resources
    table = resources["ReleaseHistoryTable"]
    assert table["Type"] == "AWS::DynamoDB::Table"
    props = table["Properties"]
    assert props["BillingMode"] == "PAY_PER_REQUEST"

    # Primary key
    key_schema = {k["AttributeName"]: k["KeyType"] for k in props["KeySchema"]}
    assert key_schema == {"recordId": "HASH"}

    # Attributes
    attr_defs = {a["AttributeName"]: a["AttributeType"] for a in props["AttributeDefinitions"]}
    assert attr_defs["recordId"] == "S"
    assert attr_defs["eventType"] == "S"
    assert attr_defs["timestamp"] == "S"

    # GSI
    gsis = props.get("GlobalSecondaryIndexes", [])
    assert len(gsis) == 1
    gsi = gsis[0]
    assert gsi["IndexName"] == "EventTypeIndex"
    gsi_keys = {k["AttributeName"]: k["KeyType"] for k in gsi["KeySchema"]}
    assert gsi_keys == {"eventType": "HASH", "timestamp": "RANGE"}
    assert gsi["Projection"]["ProjectionType"] == "ALL"

    # 2. Lambda Environment Variable
    fn_props = resources["EventGateFunction"]["Properties"]
    env_vars = fn_props["Environment"]["Variables"]
    assert "RELEASE_HISTORY_TABLE_NAME" in env_vars

    # 3. IAM Least-Privilege Policies
    policies = fn_props["Policies"]
    history_policy = None
    for p in policies:
        for stmt in p.get("Statement", []):
            if stmt.get("Sid") == "AccessReleaseHistoryTable":
                history_policy = stmt
                break
    assert history_policy is not None
    assert history_policy["Effect"] == "Allow"
    assert set(history_policy["Action"]) == {
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
    }

    # 4. Outputs
    outputs = template.get("Outputs", {})
    assert "ReleaseHistoryTableName" in outputs


def _load_template() -> dict:
    class Loader(yaml.SafeLoader):
        pass

    def any_tag(loader, tag_suffix, node):
        if isinstance(node, yaml.ScalarNode):
            return loader.construct_scalar(node)
        if isinstance(node, yaml.SequenceNode):
            return loader.construct_sequence(node)
        return loader.construct_mapping(node)

    Loader.add_multi_constructor("!", any_tag)
    return yaml.load(_TEMPLATE_PATH.read_text(encoding="utf-8"), Loader=Loader)


def test_http_api_is_throttled():
    api = _load_template()["Resources"]["EventGateHttpApi"]["Properties"]
    settings = api["DefaultRouteSettings"]
    assert 0 < settings["ThrottlingRateLimit"] <= settings["ThrottlingBurstLimit"]


def test_lambda_package_contains_cedar_policy_and_dependency():
    """CodeUri is backend/src, so the policy and cedarpy must both live there."""
    function = _load_template()["Resources"]["EventGateFunction"]["Properties"]
    code_root = _REPO_ROOT / function["CodeUri"]
    assert (code_root / "eventgate" / "policies" / "release_policy.cedar").is_file()
    requirements = (code_root / "requirements.txt").read_text(encoding="utf-8")
    assert "cedarpy" in requirements
