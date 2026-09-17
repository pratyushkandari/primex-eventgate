"""Unit tests verifying SAM template configuration for Phase 3 EventBridge resources."""

from pathlib import Path

import yaml

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_TEMPLATE_PATH = _REPO_ROOT / "template.yaml"


def test_sam_template_phase3_resources():
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
    assert "PublishEvent" in events
    assert events["PublishEvent"]["Properties"]["Path"] == "/api/v1/events/publish"
    assert events["PublishEvent"]["Properties"]["Method"] == "POST"

    # 5. Outputs
    outputs = template.get("Outputs", {})
    assert "EventBusName" in outputs
    assert "EventBusArn" in outputs
    assert "BillingConsumerFunctionName" in outputs
    assert "InventoryConsumerFunctionName" in outputs
    assert "AnalyticsConsumerFunctionName" in outputs
