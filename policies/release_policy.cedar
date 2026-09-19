// PrimeX EventGate Authoritative Release Policy Definition (Cedar Language)
// Evaluates environment-scoped compatibility, risk, and publication boundaries.

// Rule 1: Strictly block breaking changes in any environment
@id("PROD_BLOCK_BREAK")
forbid (
    principal,
    action == Action::"Release",
    resource
)
when {
    context.severity == "HIGH"
};

// Rule 2: Require manual review for medium-risk changes in production or staging
@id("PROD_REVIEW_MEDIUM")
forbid (
    principal,
    action == Action::"Release",
    resource
)
when {
    (principal == Environment::"production" || principal == Environment::"staging") &&
    context.severity == "MEDIUM"
};

// Rule 3: Allow safe backward-compatible changes across all environments
@id("ALLOW_SAFE")
permit (
    principal,
    action == Action::"Release",
    resource
)
when {
    context.severity == "LOW"
};

// Rule 4: Permit medium-risk changes in development environment (with non-blocking warnings)
@id("DEV_ALLOW_WARNING")
permit (
    principal == Environment::"development",
    action == Action::"Release",
    resource
)
when {
    context.severity == "MEDIUM"
};
