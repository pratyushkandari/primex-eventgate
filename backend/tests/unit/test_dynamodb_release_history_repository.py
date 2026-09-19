"""Unit tests for DynamoReleaseReviewRepository."""

from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from eventgate.domain.errors import ReleaseRecordNotFoundError
from eventgate.domain.history import ReleaseRecord
from eventgate.infrastructure.repositories.dynamo_release_review_repository import (
    DynamoReleaseReviewRepository,
)


def _make_sample_record(record_id="rec-001", event_type="OrderPlaced"):
    return ReleaseRecord(
        record_id=record_id,
        analysis_id=record_id,
        event_type=event_type,
        current_version=1,
        proposed_version=2,
        environment="production",
        compatibility_result="SAFE",
        severity="LOW",
        policy_name="StandardReleasePolicy",
        policy_reason="Safe change",
        decision="ALLOW",
        affected_consumers=[],
        findings_summary=[],
        published=False,
    )


class TestDynamoReleaseReviewRepository:
    def setup_method(self):
        self.mock_table = MagicMock()
        self.mock_resource = MagicMock()
        self.mock_resource.Table.return_value = self.mock_table
        self.repo = DynamoReleaseReviewRepository(
            table_name="test-release-history",
            dynamodb_resource=self.mock_resource,
        )

    def test_save_review_success(self):
        record = _make_sample_record("rec-save-01")
        saved = self.repo.save_review(record)
        assert saved.record_id == "rec-save-01"
        self.mock_table.put_item.assert_called_once()
        call_args = self.mock_table.put_item.call_args[1]
        assert call_args["Item"]["recordId"] == "rec-save-01"
        assert call_args["Item"]["eventType"] == "OrderPlaced"

    def test_save_review_client_error(self):
        self.mock_table.put_item.side_effect = ClientError(
            {"Error": {"Code": "InternalError", "Message": "DynamoDB error"}},
            "PutItem",
        )
        with pytest.raises(ClientError):
            self.repo.save_review(_make_sample_record())

    def test_get_review_success(self):
        item_dict = _make_sample_record("rec-get-01").to_dict()
        item_dict["recordId"] = "rec-get-01"
        item_dict["eventType"] = "OrderPlaced"
        self.mock_table.get_item.return_value = {"Item": item_dict}

        record = self.repo.get_review("rec-get-01")
        assert record.record_id == "rec-get-01"
        assert record.event_type == "OrderPlaced"
        self.mock_table.get_item.assert_called_once_with(Key={"recordId": "rec-get-01"})

    def test_get_review_not_found(self):
        self.mock_table.get_item.return_value = {}
        with pytest.raises(ReleaseRecordNotFoundError):
            self.repo.get_review("nonexistent-rec")

    def test_get_review_client_error(self):
        self.mock_table.get_item.side_effect = ClientError(
            {"Error": {"Code": "ProvisionedThroughputExceededException"}},
            "GetItem",
        )
        with pytest.raises(ClientError):
            self.repo.get_review("error-rec")

    def test_list_reviews_with_event_type(self):
        item1 = _make_sample_record("rec-1", "OrderPlaced").to_dict()
        item1["recordId"] = "rec-1"
        item1["eventType"] = "OrderPlaced"
        self.mock_table.query.return_value = {"Items": [item1]}

        results = self.repo.list_reviews(event_type="OrderPlaced", limit=10)
        assert len(results) == 1
        assert results[0].record_id == "rec-1"
        self.mock_table.query.assert_called_once()
        assert self.mock_table.query.call_args[1]["IndexName"] == "EventTypeIndex"

    def test_list_reviews_without_event_type(self):
        item1 = _make_sample_record("rec-all-1", "OrderPlaced").to_dict()
        item1["recordId"] = "rec-all-1"
        item1["eventType"] = "OrderPlaced"
        self.mock_table.query.return_value = {"Items": [item1]}

        results = self.repo.list_reviews(limit=20)
        assert len(results) >= 1
