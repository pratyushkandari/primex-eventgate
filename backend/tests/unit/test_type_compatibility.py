"""Tests for the type compatibility matrix."""

import pytest

from eventgate.domain.compatibility import is_type_compatible


class TestTypeCompatibility:
    """Verify the explicit type compatibility rules."""

    @pytest.mark.parametrize(
        "from_type,to_type",
        [
            ("string", "string"),
            ("number", "number"),
            ("integer", "integer"),
            ("boolean", "boolean"),
            ("object", "object"),
            ("array", "array"),
            ("null", "null"),
        ],
    )
    def test_same_type_is_compatible(self, from_type, to_type):
        assert is_type_compatible(from_type, to_type) is True

    def test_integer_to_number_is_compatible(self):
        """integer → number is explicitly allowed (widening)."""
        assert is_type_compatible("integer", "number") is True

    @pytest.mark.parametrize(
        "from_type,to_type",
        [
            ("number", "string"),
            ("string", "number"),
            ("boolean", "string"),
            ("object", "string"),
            ("array", "object"),
            ("object", "array"),
            ("number", "integer"),
            ("string", "boolean"),
            ("null", "string"),
            ("string", "null"),
        ],
    )
    def test_incompatible_type_transitions(self, from_type, to_type):
        assert is_type_compatible(from_type, to_type) is False

    def test_unknown_types_are_incompatible(self):
        assert is_type_compatible("date", "string") is False
        assert is_type_compatible("string", "date") is False
