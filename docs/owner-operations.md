# Project You+ Owner Operations

The Owner area is the administrative control plane for Project You+.

## Production routes

- `/owner` — command center overview
- `/owner/users` — user directory
- `/owner/analytics` — product telemetry
- `/owner/agents` — AI Operations
- `/owner/approvals` — owner decision and agent-fix approval center
- `/owner/controls` — feature controls and rollout
- `/owner/content` — notification/content activity
- `/owner/integrations` — integration status
- `/owner/audit` — administrative audit trail
- `/owner/settings` — application settings

## Agent safety gates

Builder may prepare draft pull requests only. A Builder proposal must pass the independent safety-review stage before GitHub write access is used. Owner approval is recorded separately from QA. Owner approval does not merge a pull request or bypass automated testing.

Blocked runs remain visible in AI Operations until the underlying blocker or owner decision is addressed. Findings requiring a business, privacy, or architecture decision are routed to the Approval Center instead of being repeatedly retried by Builder.
