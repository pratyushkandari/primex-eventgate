"""Load profile for the EventGate API.

Models CI pipelines and a few people using the console: mostly analyses, some
history and catalog reads, and occasional publishes. Every publish is ALLOW in
development, so each one does a full analyze + publish + history write.

    locust -f perf/locustfile.py --host http://127.0.0.1:8000 \
        --headless -u 20 -r 5 -t 60s --csv perf-results/run

Point it only at a local or test deployment: publishes reach the configured bus.
"""

from __future__ import annotations

import random

from locust import HttpUser, between, task

CHANGES = [
    ("OrderPlaced", 1, 2),
    ("OrderPlaced", 1, 3),
    ("OrderPlaced", 1, 4),
    ("PaymentCompleted", 1, 2),
    ("UserCreated", 1, 2),
]
ENVIRONMENTS = ["production", "staging", "development"]
ORDER_PAYLOAD = {"orderId": "o-1", "amount": 10.5, "items": ["a"], "shippingMethod": "std"}


class EventGateUser(HttpUser):
    wait_time = between(0.2, 1.0)

    @task(12)
    def analyze(self) -> None:
        event_type, current, proposed = random.choice(CHANGES)
        self.client.post(
            "/api/v1/analyze",
            json={
                "eventType": event_type,
                "currentVersion": current,
                "proposedVersion": proposed,
                "environment": random.choice(ENVIRONMENTS),
            },
            name="POST /api/v1/analyze",
        )

    @task(3)
    def publish(self) -> None:
        self.client.post(
            "/api/v1/events/publish",
            json={
                "eventType": "OrderPlaced",
                "currentVersion": 1,
                "proposedVersion": 2,
                "environment": "development",
                "payload": ORDER_PAYLOAD,
            },
            name="POST /api/v1/events/publish",
        )

    @task(3)
    def history(self) -> None:
        self.client.get("/api/v1/history?limit=50", name="GET /api/v1/history")

    @task(2)
    def catalog(self) -> None:
        self.client.get("/api/v1/contracts/events", name="GET /api/v1/contracts/events")
