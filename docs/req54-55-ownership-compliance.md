# Requirement 54/55 ownership and analytics compliance notes

Scope covered by this patch:

- Photo upload remains login-only. The stored photo record keeps `uploaderUserId`, while user-facing photo responses strip internal owner and identity fields.
- API applications now distinguish `ownerType: "anonymous"` from `ownerType: "user"` and store `userId` only when a valid server session bearer token is provided.
- API token records can carry `applicationId` and `userId` references, so review flows can link generated tokens without relying on email text matching.
- Optional analytics hooks are wired for `photo_upload` and `api_application_submit`; hook failures are swallowed and never block the business response.

## Feedback ownership

No server-side feedback route or feedback persistence service was found in the current repository. When feedback is added or wired to the backend, use this shape:

- Anonymous feedback: `ownerType: "anonymous"`, `userId: null`.
- Logged-in feedback: `ownerType: "user"`, `userId` from the verified server session token.
- Public/admin summaries must not expose third-party identity fields such as `openid`, `unionid`, OAuth `code`, OAuth `state`, raw token values, or raw IP.

Recommended analytics event name: `feedback_submit`.

## Platform credentials

WeChat Open Platform Web login, WeChat Mini Program AppSecret, and Google OAuth/OIDC permissions have not been applied for in this branch. Environment variables for those integrations should remain empty in local/test examples until real platform applications are approved. Do not commit real app secrets, client secrets, OAuth codes, states, or downloaded credential files.

## Storage privacy rules

Do not store plaintext API tokens, session tokens, WeChat `openid`, WeChat `unionid`, OAuth `code`, OAuth `state`, or raw IP addresses in analytics or audit datasets. Existing token storage keeps only token hashes. Existing photo upload rate limiting stores an IP hash, not raw IP.

For user deletion requests, delete or anonymize all analytics events and aggregates linked by `userId`, including business-owned event records from photo upload, API application, feedback, prediction, geocoding, map usage, agent calls, and API calls.

## Server-side analytics hook map

These event names should be emitted by the owning server code paths. Events must be non-blocking, sanitized, and safe to drop:

- `prediction_query`: prediction requests, with coarse region and status/error metadata.
- `geocoding_search`: geocoding lookups, with query sanitized or bucketed.
- `map_view`: map or layer view, with target layer/type only.
- `photo_upload`: implemented in `server/routes/photos.js`.
- `feedback_submit`: pending backend feedback route/service.
- `api_application_submit`: implemented in `server/routes/applications.js`.
- `agent_forecast`: agent forecast endpoint.
- `api_call`: external/API-token protected calls, linked by token id and application/user references when available.

Analytics payloads should use `userId` only after verified login and should strip query strings, precise lat/lon where not needed, OAuth `code/state`, token values, and raw IP before persistence.
