# Post-MVP Technical Contracts

## Goal
Define stable integration contracts for post-MVP features without implementing runtime logic now.
This keeps the current MVP core (`HOME`, `FIND`, `SONGS`, `AI ASSIST` stub, `ID`) unchanged while enabling incremental rollout.

## Contract Files
- `src/contracts/in-app-requests.ts`
- `src/contracts/ai-navigation.ts`
- `src/contracts/ai-support.ts`
- `src/contracts/reviews.ts`
- `src/contracts/common.ts`

## 1) In-App Requests
Scope: artist creates request inside app to specialist/studio.

Planned endpoints:
- `POST /api/requests`
- `GET /api/requests`
- `GET /api/requests/:id`
- `PATCH /api/requests/:id/action`

Key lifecycle:
- `DRAFT -> SUBMITTED -> VIEWED -> ACCEPTED|DECLINED`
- terminal states: `CANCELLED`, `EXPIRED`, `ARCHIVED`

Compatibility with current core:
- links to existing `User` (`artist`, `specialist`)
- links to existing `Track`
- links to existing `PathStage`

## 2) AI Navigation
Scope: recommend relevant specialists and next actions from PATH context.

Planned endpoint:
- `POST /api/ai/navigation/suggest`

Input contract:
- objective
- path stage context
- budget/remote/city filters
- top K recommendations

Output contract:
- scored specialist recommendations
- rationale per recommendation
- concrete next actions (1..5)

## 3) AI Support
Scope: supportive, non-clinical assistant response based on mood and recent activity.

Planned endpoint:
- `POST /api/ai/support/respond`

Input contract:
- mood (`NORMAL|TOUGH|FLYING`)
- optional note
- optional PATH context and weekly activity

Output contract:
- response text
- suggested micro-steps
- escalation metadata (`NONE|SOFT_ALERT|URGENT_HELP`) with resources list

## 4) Reviews
Scope: post-collaboration feedback for specialists/studios with moderation.

Planned endpoints:
- `POST /api/reviews`
- `GET /api/reviews?specialistUserId=...`
- `PATCH /api/reviews/:id/moderation`

Contract highlights:
- rating 1..5
- review tags
- moderation status: `PENDING|APPROVED|REJECTED`
- list response includes summary (`averageRating`, `ratingsCount`)

## Versioning Rules
- Additive changes only in `v1` contracts (new optional fields are allowed).
- Breaking changes require `v2` endpoint namespace and schema copy.
- Persist request/response examples in API tests before implementation.

## Idempotency and Consistency
- For `POST /api/requests` and `POST /api/reviews`, use `Idempotency-Key` header in implementation phase.
- Action endpoints must be state-transition validated server-side.
- Review moderation is admin-only by role policy.
