# EventGate Architectural Decision Model & Release Policy

EventGate enforces a strict three-tier separation between structural compatibility, organizational release policy, and publication gating.

---

## 1. Architectural Decision Model

```
   [ Proposed Contract Evolution ]
                 │
                 ▼
      COMPATIBILITY ANALYSIS
      "How does this change affect consumers?"
                 │
                 ├──► Findings: Deterministic per-consumer rule evaluations
                 ├──► Status:   SAFE | RISK | BREAK
                 └──► Severity: LOW | MEDIUM | HIGH
                 │
                 ▼
          RELEASE POLICY
      "Given compatibility, severity, environment, and policy, may this release proceed?"
                 │
                 ├──► Evaluated Rules & Reason
                 ├──► Applied Policy Name & Engine Provider
                 └──► Warnings (e.g. non-blocking development notices)
                 │
                 ▼
       FINAL RELEASE DECISION
          ALLOW | REVIEW | BLOCK
                 │
                 ├──► ALLOW   ──► Approved for Amazon EventBridge publication
                 ├──► REVIEW  ──► Publication PREVENTED (Manual approval required)
                 └──► BLOCK   ──► Publication PREVENTED (Breaking changes strictly blocked)
```

### Critical Separation Principle

Compatibility and Policy are never collapsed into an ambiguous single field:

* **Compatibility Analysis** is an objective, mathematical analysis of schema deltas against downstream consumer dependencies (e.g. `shippingMethod` changed from `string` to `object` is a `BREAK` with `HIGH` severity).
* **Release Policy** is an environment-aware governance decision (e.g. in `production`, `HIGH` severity always yields `BLOCK`; in `development`, `MEDIUM` risk yields `ALLOW with warning`).
* **Final Decision** dictates publication gate behavior.

---

## 2. Environment Policy Matrix

The platform strictly enforces the following matrix across all interfaces:

| Environment | LOW Severity (Safe) | MEDIUM Severity (Risk) | HIGH Severity (Break) |
| :--- | :---: | :---: | :---: |
| **`production`** | **`ALLOW`** | **`REVIEW`** | **`BLOCK`** |
| **`staging`** | **`ALLOW`** | **`REVIEW`** | **`BLOCK`** |
| **`development`** | **`ALLOW`** | **`ALLOW with warning`** | **`BLOCK`** |

### Environment Context Flow

The environment is an authoritative parameter passed across the entire backend:

```text
API Request / CLI Parameter
        ↓
EventAnalysisService / EventPublishService
        ↓
CompatibilityEngine (Derives findings & severity)
        ↓
IPolicyEngine (Applies environment matrix)
        ↓
PolicyEvaluationResult (ALLOW / REVIEW / BLOCK)
        ↓
Persistent ReleaseRecord (Correlated audit evidence)
        ↓
Publication Gate (Publish to EventBridge or Prevent)
```

---

## 3. Policy Provider Architecture (`IPolicyEngine`)

EventGate defines an extensible policy engine port:

```python
class IPolicyEngine(ABC):
    @abstractmethod
    def evaluate(
        self,
        compatibility_result: str,
        severity: Severity,
        environment: str,
        findings: list[Finding],
        context: dict[str, Any] | None = None,
    ) -> PolicyEvaluationResult:
        pass
```

### Configured Providers:

1. **`standard` (`StandardReleasePolicyEngine`)**:
   * Pure, deterministic Python implementation.
   * Zero external cloud or binary dependencies.
   * Portable, ultra-fast local and CI execution.

2. **`cedar` (`CedarReleasePolicyEngine`)**:
   * Evaluates formal AWS Cedar policy specifications via `cedarpy`.
   * Directly parses and executes `policies/release_policy.cedar`.
   * Enforces principal environment scopes, actions, and severity contexts.

### Zero Silent Fallback Guarantee

If `EVENTGATE_POLICY_ENGINE=cedar` is configured and Cedar cannot be parsed or executed, EventGate raises an explicit `ConfigurationError`. It **never** silently falls back to standard mode, ensuring deterministic audit integrity.

### Conformance Verification

The backend includes a comprehensive conformance suite (`backend/tests/unit/test_policy_engine.py`) proving that `standard` and `cedar` engines produce identical decisions across all supported combinations of environments and severities.
