# PRP: Authentication & Security (WebAuthn/Passkeys)

## Feature Overview
Passwordless authentication using WebAuthn/Passkeys for secure, biometric-based user access.

## User Personas
- **Primary User**: Individual task managers who value security and convenience
- **Security-Conscious Users**: Users who want phishing-resistant authentication without password management

## User Stories

### As a new user
- I want to register with just a username and my device's biometric authentication
- So that I don't need to remember or manage passwords

### As a returning user
- I want to login quickly with my passkey (fingerprint/face ID)
- So that I can access my todos securely without typing credentials

### As any user
- I want my session to persist for 7 days
- So that I don't need to re-authenticate frequently on my trusted device

## User Flow

### Registration Flow
1. User navigates to `/login`
2. User enters desired username
3. User clicks "Register"
4. Browser prompts for biometric authentication or security key
5. User authenticates with device
6. System creates user account and session
7. User redirected to home page (`/`)

### Login Flow
1. User navigates to `/login`
2. User enters username
3. User clicks "Login"
4. Browser prompts for passkey authentication
5. User authenticates with device
6. System verifies credentials and creates session
7. User redirected to home page (`/`)

### Logout Flow
1. User clicks "Logout" button (top-right corner)
2. System clears session cookie
3. User redirected to `/login`

## Technical Requirements

### Technology Stack
- **Library**: `@simplewebauthn/server` (backend), `@simplewebauthn/browser` (frontend)
- **Session**: JWT stored in HTTP-only cookie via `jose` library
- **Middleware**: Next.js middleware for route protection

### Database Schema
```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Authenticators table (one-to-many with users)
CREATE TABLE authenticators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  credential_public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  credential_device_type TEXT,
  credential_backed_up INTEGER DEFAULT 0,
  transports TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### API Endpoints

#### `POST /api/auth/register-options`
- Input: `{ username: string }`
- Output: WebAuthn registration challenge
- Uses: `generateRegistrationOptions()` from SimpleWebAuthn

#### `POST /api/auth/register-verify`
- Input: `{ username: string, response: RegistrationResponseJSON }`
- Output: `{ success: boolean, userId: number }`
- Creates user and authenticator records
- Creates session cookie

#### `POST /api/auth/login-options`
- Input: `{ username: string }`
- Output: WebAuthn authentication challenge
- Uses: `generateAuthenticationOptions()` from SimpleWebAuthn

#### `POST /api/auth/login-verify`
- Input: `{ username: string, response: AuthenticationResponseJSON }`
- Output: `{ success: boolean }`
- Verifies credentials, updates authenticator counter
- Creates session cookie

#### `POST /api/auth/logout`
- Deletes session cookie
- Returns: `{ success: true }`

#### `GET /api/auth/me`
- Returns current session: `{ userId: number, username: string }` or `null`

### Middleware Protection
Protected routes (redirect to `/login` if unauthenticated):
- `/` (home page)
- `/calendar`

Login page behavior:
- Redirect authenticated users to `/` (prevent accessing login when logged in)

### Session Management
- **Format**: JWT with `{ userId: number, username: string }`
- **Expiry**: 7 days
- **Storage**: HTTP-only cookie named `session`
- **Security**: SameSite=Lax, Secure in production

### Critical Implementation Details

**Buffer Encoding:**
- WebAuthn credentials use base64url encoding
- Use `isoBase64URL` from `@simplewebauthn/server/helpers` for credential_id

**Counter Handling:**
- Always use null coalescing for counter field:
  ```typescript
  counter: authenticator.counter ?? 0
  ```

**RP ID (Relying Party):**
- Use hostname without port: `localhost` or `yourdomain.com`
- Must match origin domain

## Acceptance Criteria

- [ ] User can register with username and passkey (biometric/security key)
- [ ] User can login with existing passkey
- [ ] Multiple authenticators supported per user
- [ ] User can logout and session is immediately cleared
- [ ] Unauthenticated users redirected to `/login` when accessing protected routes
- [ ] Authenticated users accessing `/login` are redirected to `/`
- [ ] Session persists for 7 days without re-authentication
- [ ] Session cookie is HTTP-only and secure in production
- [ ] WebAuthn counter increments correctly on each authentication
- [ ] Invalid credentials show clear error messages

## Security Considerations

### Threats Mitigated
- **Phishing**: WebAuthn credentials tied to domain (can't be stolen via fake sites)
- **Password reuse**: No passwords exist
- **Brute force**: Biometric/hardware authentication required
- **Session hijacking**: HTTP-only cookies prevent JavaScript access
- **CSRF**: SameSite cookie attribute

### Best Practices
- Never log credential_public_key or credential_id
- Always verify WebAuthn responses server-side
- Update authenticator counter on each use (prevent replay attacks)
- Use secure flag on cookies in production

## Testing Requirements

### E2E Tests (Playwright)
- Register new user with virtual authenticator
- Login existing user with virtual authenticator
- Logout clears session
- Protected route redirects unauthenticated users
- Login page redirects authenticated users

### Test Setup
```typescript
// playwright.config.ts
use: {
  ...devices['Desktop Chrome'],
  launchOptions: {
    args: [
      '--enable-features=WebAuthenticationRemoteDesktopSupport'
    ]
  }
}
```

## Error Handling

### Client-Side Errors
- "WebAuthn not supported" - Browser doesn't support passkeys
- "Authentication cancelled" - User cancelled biometric prompt
- "Invalid username" - Username validation failed

### Server-Side Errors
- 400: Invalid request (missing username, invalid format)
- 401: Authentication failed (invalid credentials)
- 409: Username already exists (registration)
- 500: Server error (database, WebAuthn verification)

## Out of Scope
- Password-based authentication
- Social login (Google, GitHub, etc.)
- Multi-factor authentication (WebAuthn is already 2FA)
- Account recovery (future feature)
- Email verification
- Rate limiting (future enhancement)

## Success Metrics
- 100% of users successfully register on first attempt
- < 5 second authentication time
- Zero password reset requests (no passwords!)
- < 1% authentication errors
