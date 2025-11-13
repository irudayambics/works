# PRP: WebAuthn / Passkeys Authentication

## Feature Overview

Deliver passwordless authentication using FIDO2/WebAuthn credentials with a passkey-first user experience, while adhering to the conventions in `00-core-prp.md`. Provide secure registration and login flows, JWT-backed sessions, and route protection hooks for the entire Todo App.

## User Stories

### As a user

- I want to register a passkey so I can sign in securely without passwords.
- I want to authenticate using my device biometrics or security key so access is quick and safe.
- I want to manage my registered devices so I can revoke lost or compromised credentials.
- I want the app to remember my session securely across visits so I stay signed in until I choose to log out.

## User Flow

### Passkey Registration

1. UI displays a "Create Passkey" call-to-action when the user is unauthenticated.
2. User enters email (for identification) and submits the request.
3. System validates the email, generates WebAuthn registration options, and returns them to the client.
4. UI invokes `navigator.credentials.create`, sends the attestation response to the server, the system verifies and stores the credential, issues a session, and UI redirects to the app.

### Passkey Authentication

1. UI detects stored passkeys and shows a "Sign in with Passkey" button.
2. User selects a passkey; the device prompts biometric or security key verification.
3. System validates the assertion, mints a JWT, sets a secure cookie, and returns user profile data.
4. UI transitions to the authenticated state and prefetches protected data.

### Device Management

1. UI displays a list of registered passkeys on the account settings page.
2. User chooses to revoke a device.
3. System marks the credential as deleted (soft delete) and invalidates existing sessions tied to it.
4. UI removes the device entry and shows a confirmation toast.

### Session Refresh & Logout

1. UI sends a silent refresh request before the JWT expires.
2. System validates the refresh token, rotates JWTs, and updates expiry timestamps.
3. UI updates auth state seamlessly.
4. On logout, user clicks "Sign out"; system clears cookies, revokes the refresh token, and UI redirects to the public landing page.

## Technical Requirements

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  displayName TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS webauthnCredentials (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  credentialId BLOB NOT NULL UNIQUE,
  publicKey BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  deviceName TEXT,
  lastUsedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS authSessions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  refreshToken TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  userAgent TEXT,
  ipAddress TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user_active ON webauthnCredentials(userId) WHERE deletedAt IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON authSessions(userId, deletedAt) WHERE deletedAt IS NULL;
```

- Store `credentialId` and `publicKey` as binary using `BLOB`; encode/decode with Node.js Buffer helpers.
- Persist timestamps as UTC ISO strings; convert to Singapore zone for display per `00-core-prp.md`.
- Maintain soft delete columns to allow recovery/audit of credentials and sessions.

### API Endpoints

#### `POST /api/auth/webauthn/register/options`

Passkey Registration Options — server issues WebAuthn `PublicKeyCredentialCreationOptions`.

- Input:

  ```typescript
  {
    email: string;        // required, unique identifier for user
    displayName?: string; // optional friendly name shown in UI
    deviceName?: string;  // optional label for current device
  }
  ```

- Output: WebAuthn credential creation options (JSON) plus opaque `challengeId` for later binding.
- Validation:
  - `email` must be valid format and ≤ 254 chars (`E_VALIDATION`).
  - When user exists and is soft-deleted, return `E_CONFLICT` instructing support flow.
  - Rate limit per IP (e.g., 10/min); excess returns `E_RATE_LIMIT`.

#### `POST /api/auth/webauthn/register/verify`

Complete Passkey Registration — verifies attestation and stores credential.

- Input:

  ```typescript
  {
    challengeId: string;           // opaque token from options endpoint
    attestationResponse: unknown;  // raw WebAuthn attestation payload
    deviceName?: string;           // optional device label persisted with credential
  }
  ```

- Output: `{ user: UserPayload; session: { accessToken: string; expiresAt: string; } }` via shared envelope.
- Validation:
  - `challengeId` must be active and match stored email context; else `E_VALIDATION`.
  - Attestation verification failures return `E_FORBIDDEN` with generic messaging.
  - Duplicate credential IDs return `E_CONFLICT`.

#### `POST /api/auth/webauthn/login/options`

Authentication Options — produces `PublicKeyCredentialRequestOptions`.

- Input:

  ```typescript
  {
    email: string; // required to narrow credential list; MAY allow discoverable credentials later
  }
  ```

- Output: Assertion options JSON and `challengeId`.
- Validation:
  - `email` required; if user not found, respond with success but set `allowCredentials` empty to avoid account enumeration.
  - Throttle per email/IP to 5/min; otherwise `E_RATE_LIMIT`.

#### `POST /api/auth/webauthn/login/verify`

Complete Authentication — validates assertion response and issues session.

- Input:

  ```typescript
  {
    challengeId: string;
    assertionResponse: unknown;
  }
  ```

- Output: `{ user: UserPayload; session: { accessToken: string; refreshToken: string; expiresAt: string; } }`.
- Validation:
  - `challengeId` must exist and match stored credentials; else `E_FORBIDDEN`.
  - Counter regression returns `E_CONFLICT` and revokes the credential until re-registered.

#### `POST /api/auth/refresh`

Rotate Session Tokens — exchanges refresh token for a new access token.

- Input:

  ```typescript
  {
    refreshToken: string; // required, JWT or opaque token stored in DB
  }
  ```

- Output: New access token payload with expiry metadata.
- Validation:
  - Refresh token must match active session record; else `E_UNAUTHORIZED`.
  - Expired sessions return `E_UNAUTHORIZED` and trigger client logout.

#### `POST /api/auth/logout`

Invalidate Session — clears cookies and invalidates the refresh token.

- Input: `{ refreshToken?: string }` to support multi-device logout.
- Output: `{ ok: true }`.
- Validation:
  - Missing token falls back to cookie if available; otherwise idempotent success.

#### `GET /api/auth/me`

Fetch Authenticated User Profile — returns user payload with credential summaries.

- Output: `{ user: UserPayload }` with associated active credential summaries.
- Validation:
  - Requires valid access token; else `E_UNAUTHORIZED`.

#### `GET /api/auth/credentials`

List Registered Passkeys — surfaces devices for account management.

- Output: Array of credential metadata (id, deviceName, createdAt, lastUsedAt, transports).
- Validation:
  - Auth required; only active credentials returned.

#### `DELETE /api/auth/credentials/:id`

Revoke Passkey — soft deletes credential and revokes active sessions.

- Output: `{ ok: true }`.
- Validation:
  - Credential must belong to the user; else `E_FORBIDDEN`.
  - Already deleted credentials return idempotent success.

### Validation Rules

#### Email

- Required, trimmed, lowercase normalized.
- RFC 5322 compliant (use minimalist regex) and ≤ 254 chars.
- Error: "Enter a valid email address" (`E_VALIDATION`).

#### Display Name

- Optional 1-60 chars; strip excessive whitespace.
- Reject control characters to avoid XSS.

#### Device Name

- Optional 1-60 chars; sanitize to alphanumeric plus spaces and hyphen.
- Stored for user-facing labels; fallback to User Agent summary if absent.

#### Challenge ID

- Required, UUID v4.
- Must be unexpired (valid for ≤ 5 minutes); else `E_VALIDATION`.

#### Attestation Response / Assertion Response

- Required; must pass verification via `@simplewebauthn/server` helpers.
- Failure returns `E_FORBIDDEN` with generic "Passkey verification failed" message.

#### Refresh Token

- Required for refresh/logout when cookie absent.
- Validate signature (JWT) or presence in DB for opaque tokens; error `E_UNAUTHORIZED` if invalid.

### Timezone Handling

**Critical:** All date operations use Singapore timezone (`Asia/Singapore`).

```typescript
import { nowSg, toUtcIso, fromUtcIso } from '@/lib/timezone';

const issuedAt = nowSg();
const accessExpiresAt = issuedAt.plus({ minutes: 15 });
const refreshExpiresAt = issuedAt.plus({ days: 7 });

const sessionRecord = {
  createdAt: toUtcIso(issuedAt),
  expiresAt: toUtcIso(refreshExpiresAt),
};

const lastUsedDelta = nowSg().diff(fromUtcIso(credential.lastUsedAt));
if (lastUsedDelta.as('days') > 90) {
  // trigger re-auth policy or warning
}
```

- Persist session expiry and credential usage timestamps in UTC, but compute grace periods with SG helpers.
- JWT `exp` claims MUST use Unix timestamps derived from SG-based DateTime converted to UTC.

## UI Components
- **AuthLanding** detects passkey support, shows fallback messaging when unsupported, and manages email input submission to `/register/options` or `/login/options`.
- **PasskeyRegistrationForm** disables submit during pending state, invokes WebAuthn APIs with cached `challengeId`, and updates global auth context after verification.
- **PasskeyLoginButton** supports conditional UI auto-prompting, fallback manual invocation, and redirects upon successful assertion verification.
- **SessionStatusManager** schedules SG-aware refreshes two minutes before expiry, handles `E_UNAUTHORIZED`, and clears caches on logout.
- **CredentialManagementTable** lists registered devices with revoke actions, optimistic row removal, and SG-formatted `lastUsedAt` timestamps.
- **ErrorBanner / Toast** communicates validation, forbidden, or conflict responses in line with `.github/copilot-instructions.md` tone.

## Edge Cases
- Browsers without WebAuthn support must fall back to instructions without attempting credential APIs.
- Expired or mismatched `challengeId` values should return `E_VALIDATION`; UI prompts the user to retry the flow from the start.
- Counter regressions detected during login trigger `E_CONFLICT`; client notifies the user to re-register the affected credential.
- Revoking a credential currently in use must invalidate active sessions and force re-authentication; UI surfaces that the device was removed.
- Rate limits on options/verify endpoints return `E_RATE_LIMIT`; UI shows cooldown timers and prevents repeated submissions.

## Acceptance Criteria

### Passkey Registration Criteria

- [ ] Users can create a new passkey with valid email and attestation; credential stored with counter initialized to 0.
- [ ] Duplicate credential attestation prevents registration and surfaces friendly error messaging.
- [ ] Successful registration logs the user in, issues JWT/refresh token, and sets secure cookies.

### Passkey Authentication Criteria

- [ ] Login flow validates assertions, updates the credential counter, and returns session tokens.
- [ ] Counter regression detects cloned credentials and forces re-registration.
- [ ] Conditional UI (if supported) allows auto-prompting without clicks.

### Session Lifecycle Criteria

- [ ] Access token expires after 15 minutes; refresh token after 7 days (configurable) using SG-based calculations.
- [ ] Refresh endpoint rotates tokens and updates the database atomically.
- [ ] Logout clears cookies, revokes the session record, and future refresh attempts fail.

### Route Protection Criteria

- [ ] Protected API routes validate JWT and attach `req.user` context.
- [ ] Client redirects unauthenticated users to login with return URL preserved.
- [ ] Middleware prevents caching of authenticated pages on shared caches.

### Credential Management Criteria

- [ ] Users can list active credentials with device labels and last used timestamps.
- [ ] Revoking a credential marks it deleted and invalidates associated sessions.
- [ ] Attempting to revoke another user’s credential returns `E_FORBIDDEN`.

## Error Handling

### Client Errors

- `E_VALIDATION`: Highlight invalid email or device name, show inline helper text.
- `E_FORBIDDEN`: Generic "Passkey verification failed" message; prompt retry or alternate device.
- `E_CONFLICT`: For duplicate registration or counter mismatch, guide user to clear old credentials.
- `E_RATE_LIMIT`: Display cooldown countdown and disable the CTA temporarily.

### Server Errors

- Token signing failure: Log with `traceId`, return `E_INTERNAL`, show toast "Something went wrong".
- Database failure: Respond `E_INTERNAL`; UI offers retry.
- Unknown authenticator type: `E_INTERNAL` with masked message; notify observability tooling.

## Testing Requirements

### E2E Tests (Playwright)

```text
tests/11-authentication-webauthn.spec.ts
```

Test cases:

- [ ] Successful registration flow using mocked WebAuthn credentials; verify session cookie set and dashboard reachable.
- [ ] Login flow with stored credential; assertion succeeds, and protected route returns 200.
- [ ] Counter replay attempt triggers `E_CONFLICT` and requires re-registration.
- [ ] Revoking credential removes it from the list and blocks subsequent login with that credential.
- [ ] Session expiration forces refresh and, upon failure, redirects to login.

## Performance Requirements

- Challenge generation endpoints respond in < 120 ms with preloaded RPID/origin.
- Token refresh path executes in < 80 ms, including database update.
- Background cleanup (expired sessions, stale challenges) runs in < 500 ms and offloads to scheduled job.

## Out of Scope

- Fallback password or OTP authentication mechanisms.
- Organization-wide SSO (SAML/OIDC) integration.
- Cross-device passkey sync UX beyond browser-native behavior.
- Risk scoring or device fingerprinting beyond basic metadata capture.

## Success Metrics

- ≥ 95% of authentication attempts succeed without retry.
- < 0.5% of sessions result in `E_INTERNAL` errors post-launch.
- Average login completion time (options request → verify) under 3 seconds.
- ≥ 80% of active users register at least one passkey within the first week of launch.
