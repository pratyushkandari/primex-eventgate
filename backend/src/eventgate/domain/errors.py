"""Domain errors for EventGate."""


class EventGateError(Exception):
    """Base error for all EventGate domain/application errors."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class ContractNotFoundError(EventGateError):
    """Raised when a requested event or consumer contract does not exist."""

    def __init__(self, message: str):
        super().__init__(message, code="CONTRACT_NOT_FOUND")


class InvalidContractError(EventGateError):
    """Raised when a contract fails validation."""

    def __init__(self, message: str):
        super().__init__(message, code="INVALID_CONTRACT")


class UnsupportedEventTypeError(EventGateError):
    """Raised when the requested event type is not registered."""

    def __init__(self, event_type: str):
        super().__init__(
            f"Event type '{event_type}' is not registered.",
            code="UNSUPPORTED_EVENT_TYPE",
        )


class UnsupportedEventVersionError(EventGateError):
    """Raised when the requested event version does not exist."""

    def __init__(self, event_type: str, version: int):
        super().__init__(
            f"{event_type} version {version} was not found.",
            code="UNSUPPORTED_EVENT_VERSION",
        )


class InvalidAnalysisRequestError(EventGateError):
    """Raised when an analysis request is malformed or incomplete."""

    def __init__(self, message: str):
        super().__init__(message, code="INVALID_ANALYSIS_REQUEST")


class InvalidEventPayloadError(EventGateError):
    """Raised when an event payload violates its proposed event contract."""

    def __init__(self, message: str):
        super().__init__(message, code="INVALID_EVENT_PAYLOAD")


class EventPublishFailedError(EventGateError):
    """Raised when an event cannot be published to the downstream transport."""

    def __init__(self, message: str = "The event could not be published."):
        super().__init__(message, code="EVENT_PUBLISH_FAILED")


class ReleaseRecordNotFoundError(EventGateError):
    """Raised when a requested release review record does not exist."""

    def __init__(self, record_id: str):
        super().__init__(
            f"Release record '{record_id}' was not found.",
            code="RELEASE_RECORD_NOT_FOUND",
        )


class ConfigurationError(EventGateError):
    """Raised when a system or policy engine configuration is invalid."""

    def __init__(self, message: str):
        super().__init__(message, code="CONFIGURATION_ERROR")
