"""Unit tests for storage backend configuration and dependency injection."""

import os
from unittest.mock import patch

from eventgate.api.dependencies import get_analysis_service
from eventgate.config.settings import (
    get_aws_region,
    get_consumer_contracts_table_name,
    get_event_contracts_table_name,
    get_storage_backend,
)
from eventgate.infrastructure.repositories.consumer_contract_repository import (
    JsonConsumerContractRepository,
)
from eventgate.infrastructure.repositories.dynamo_consumer_contract_repository import (
    DynamoConsumerContractRepository,
)
from eventgate.infrastructure.repositories.dynamo_event_contract_repository import (
    DynamoEventContractRepository,
)
from eventgate.infrastructure.repositories.event_contract_repository import (
    JsonEventContractRepository,
)


class TestStorageConfiguration:
    def test_default_backend_is_local(self):
        with patch.dict(os.environ, {}, clear=True):
            assert get_storage_backend() == "local"

    def test_explicit_local_backend(self):
        with patch.dict(os.environ, {"EVENTGATE_STORAGE_BACKEND": "local"}):
            assert get_storage_backend() == "local"

    def test_dynamodb_backend(self):
        with patch.dict(os.environ, {"EVENTGATE_STORAGE_BACKEND": "dynamodb"}):
            assert get_storage_backend() == "dynamodb"

    def test_invalid_backend_defaults_to_local(self):
        with patch.dict(os.environ, {"EVENTGATE_STORAGE_BACKEND": "unknown_backend"}):
            assert get_storage_backend() == "local"

    def test_table_name_defaults_and_overrides(self):
        with patch.dict(os.environ, {}, clear=True):
            assert get_event_contracts_table_name() == "primex-eventgate-dev-event-contracts"
            assert get_consumer_contracts_table_name() == "primex-eventgate-dev-consumer-contracts"

        with patch.dict(
            os.environ,
            {
                "EVENT_CONTRACTS_TABLE_NAME": "custom-events",
                "CONSUMER_CONTRACTS_TABLE_NAME": "custom-consumers",
            },
        ):
            assert get_event_contracts_table_name() == "custom-events"
            assert get_consumer_contracts_table_name() == "custom-consumers"

    def test_aws_region_resolution(self):
        with patch.dict(os.environ, {}, clear=True):
            assert get_aws_region() == "us-east-1"

        with patch.dict(os.environ, {"AWS_REGION": "ap-south-1"}, clear=True):
            assert get_aws_region() == "ap-south-1"

        with patch.dict(os.environ, {"AWS_DEFAULT_REGION": "eu-west-1"}, clear=True):
            assert get_aws_region() == "eu-west-1"


class TestStorageDependencyInjection:
    def test_local_storage_dependency_injection(self):
        with patch.dict(os.environ, {"EVENTGATE_STORAGE_BACKEND": "local"}):
            service = get_analysis_service()
            assert isinstance(service._event_repo, JsonEventContractRepository)
            assert isinstance(service._consumer_repo, JsonConsumerContractRepository)

    def test_dynamodb_storage_dependency_injection(self):
        with patch.dict(
            os.environ,
            {
                "EVENTGATE_STORAGE_BACKEND": "dynamodb",
                "EVENT_CONTRACTS_TABLE_NAME": "test-events",
                "CONSUMER_CONTRACTS_TABLE_NAME": "test-consumers",
                "AWS_REGION": "us-east-1",
            },
        ):
            # Patch boto3.resource so no real AWS network calls are attempted
            with patch("boto3.resource"):
                service = get_analysis_service()
                assert isinstance(service._event_repo, DynamoEventContractRepository)
                assert isinstance(service._consumer_repo, DynamoConsumerContractRepository)
