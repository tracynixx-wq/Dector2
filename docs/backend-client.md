# Supabase desktop client integration

## Project

The desktop application talks only to the dedicated Dector2 Supabase project. The client uses the project URL and a publishable key. A publishable key is expected to be visible in a distributed client; it is not an admin credential. Database authorization is enforced by RLS.

## Implemented API calls

- `POST /auth/v1/signup`: create an email/password account with display-name metadata.
- `POST /auth/v1/token?grant_type=password`: sign in.
- `POST /auth/v1/token?grant_type=refresh_token`: refresh the access token; Windows restores the refresh token from Credential Manager at startup.
- `POST /auth/v1/recover`: request a password-recovery email.
- `POST /auth/v1/logout`: revoke the current session.
- `GET/PATCH /rest/v1/profiles`: read and update the current profile.
- `GET /rest/v1/conversation_members`: list conversations for the current user.
- `POST /rest/v1/rpc/create_direct_conversation`: atomically create or return the direct chat for a username.
- `POST /rest/v1/rpc/create_group_conversation`: atomically create a group and add the owner plus resolved usernames.
- `GET /rest/v1/messages`: load the latest 100 encrypted message records.

## Session storage

The access token remains in process memory. On Windows, the refresh token is stored in Windows Credential Manager and restored at startup; it is deleted on explicit sign-out. Temporary network failures preserve the stored token and retry after 30 seconds. Temporary network failures do not erase the saved session. On macOS and Linux, the current build keeps tokens in memory only and requires signing in again after closing the app. macOS Keychain and Linux Secret Service integration remain future work.

## Message encryption boundary

The database stores ciphertext and nonce fields. The current client does not yet implement message encryption/decryption or key provisioning, and therefore intentionally does not expose a plaintext send action. Do not insert plaintext into `messages.ciphertext`. A proper E2EE slice must select a maintained protocol/library and implement identity keys, signed/one-time prekeys, session establishment, ratcheting, device linking/revocation, encrypted key envelopes, attachment encryption, key-change verification and security tests.

## Known limitations

- Conversation and history loads currently use REST polling (15 seconds for chats, 8 seconds for the selected chat), not realtime websocket subscriptions.
- Conversation history is capped at 100 records; cursor pagination is still required.
- The current UI shows encrypted placeholders because decryption is not implemented.
- A private `avatars` Storage bucket is provisioned with a 5 MB limit and JPEG/PNG/WebP MIME allowlist; authenticated users can read avatars and only write to their own uid-prefixed folder. The desktop upload and signed-URL UI is not yet implemented.
- Email confirmation behavior depends on the Supabase Auth project settings.
