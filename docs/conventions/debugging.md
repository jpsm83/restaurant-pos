# Debugging (fixing bugs)

- **Root cause only — no workarounds.** Never paper over a symptom with an error cover-up, band-aid, or partial patch that fixes one path. Diagnose the real problem and fix it at the source using the project's architecture. If a fix does not hold for every equivalent flow (all login methods, all clients, all locales), it is incomplete.
- **Verify real use cases.** Unit tests are required but not sufficient. Exercise the actual user flow that motivated the change — and its close variants — end-to-end before calling it done.
- **Unexpected errors → Sentry Issues.** Production (and any environment with a DSN) reports unexpected failures to Sentry for later triage — not to a product database and not as ad-hoc `catch` logging. Backend: global problem-details handler for ≥500. Frontend: shared `ErrorBoundary` plus unhandled browser errors. Expected 4xx / validation / ordinary API failures stay out of Sentry. See ADR-0007.
