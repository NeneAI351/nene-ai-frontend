# NENE AI frontend authentication setup

The sign-in UI is prepared but intentionally inactive until the real NENE AI identity project is configured. Empty credentials are deliberate; this repository must not contain private credentials.

## Configure the identity provider

1. Create a dedicated Supabase project for NENE AI.
2. Configure an asymmetric JWT signing key supported by the backend verifier (RS256 or ES256), and confirm the project's JWKS endpoint is available.
3. Configure the production website URL and exact redirect allowlist for the deployed NENE AI frontend.
4. Configure email verification and password recovery. Use a custom transactional email provider before a public launch, and set CAPTCHA/rate limits based on expected traffic.
5. Copy the project's public Project URL and public publishable/anon key into `auth-config.js`. Those two values are public browser configuration, not secrets.
6. Never copy a database password, service_role key, or other privileged secret into this repository or frontend.
7. Configure the backend environment using the exact issuer and JWKS URL from the same project, plus the private PostgreSQL connection string, TLS Redis URL, rate-limit HMAC secret, exact CORS origin, and approved media-host allowlist.
8. Test sign-up, email confirmation, sign-in, sign-out, password recovery, expired sessions, and backend 401/403/503 behavior in a staging environment before production.

The backend currently requires a UUID user subject and an active internal account record. Confirm the chosen project's token subject is the Supabase Auth user UUID. The backend intentionally refuses production video generation and job polling until server-side credit enforcement and job ownership are implemented.

## Current session handling limitation

The current static frontend stores the SDK session in `sessionStorage`, rather than long-lived localStorage. This reduces persistence after a browser session but is not an HttpOnly-cookie architecture; JavaScript running in the page can still access a session. Before a high-value production launch, complete a DOM-XSS audit and consider moving browser sessions behind a backend-for-frontend using Secure, HttpOnly, SameSite cookies.

## Important

Authentication alone does not provide authorization. Every project, asset, generation, wallet and billing operation must verify ownership server-side. Never use a browser-side user ID or localStorage credit count as proof of identity or payment.
