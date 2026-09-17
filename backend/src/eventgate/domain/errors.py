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
