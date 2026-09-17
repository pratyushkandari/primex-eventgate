"""Application ports."""

from eventgate.application.ports.repositories import (
    IConsumerContractRepository,
    IEventContractRepository,
)

__all__ = [
    "IConsumerContractRepository",
    "IEventContractRepository",
]
