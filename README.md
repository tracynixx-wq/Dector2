# Dector

Dector is an independent cross-platform messenger. Its product behavior is informed by the existing Message project and Telegram interaction patterns, while its implementation is a clean native codebase.

## Current implementation status

### Backend foundation
- Dedicated Supabase project: `Dector2` (separate from Message).
- PostgreSQL schema for profiles, conversations, members, messages, devices and per-device encrypted message-key envelopes.
- Row Level Security enabled on every application table.
- Atomic RPC for creating one direct conversation per user pair.
- Realtime publication for messages and conversation membership.
- Security Advisor currently reports no findings.

### Desktop client
- C++20 and Qt 6 Quick application.
- Supabase email sign-up and password sign-in.
- In-memory access/refresh token handling with refresh while the app remains open.
- Profile loading and editing.
- Direct-chat creation by username and conversation list/history loading.
- Message payloads are displayed as encrypted placeholders; the UI intentionally does not send plaintext.

### Not yet implemented
- End-to-end encryption protocol, identity verification, key rotation and secure device storage.
- Decryption and sending of encrypted messages.
- Secure persistent login across app restarts.
- Realtime websocket subscriptions (current conversation loading is request-based).
- Avatar/media upload, push notifications, calls, stories, groups and advanced message actions.
- Signed auto-update and production release signing.

Do not describe Dector as end-to-end encrypted until a reviewed protocol and its full key lifecycle are implemented and tested. TLS protects transport; it is not E2EE.

## Technology direction

- **Desktop:** C++20 + Qt 6 (Qt Quick/QML, Qt Network).
- **Shared core:** C++20 libraries for domain models, protocol/client logic, cryptographic adapters and synchronization.
- **Android:** Kotlin UI with shared C++ core through JNI where justified.
- **iOS:** Swift/SwiftUI UI with shared C++ core through a narrow, audited bridge where justified.
- **Backend:** Dector-owned Supabase project and migrations.

## Configuration

The desktop client currently uses the Dector2 Supabase project URL and its public publishable API key. These are client-side identifiers, not service-role secrets. They can be overridden with:

- `DECTOR_SUPABASE_URL`
- `DECTOR_SUPABASE_PUBLISHABLE_KEY`

Never put a Supabase service-role key, database password, signing key or private encryption key in the client or Git.

## Build

Requires Qt 6.8.3 with Qt Quick/QML and CMake 3.24+.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
```

Windows CI builds a native installer using Inno Setup and publishes it as a workflow artifact after a successful build.

## Engineering rules

1. Audit Message's current implementation and backend contract before porting each feature.
2. Keep Dector independent: separate app identifiers, signing keys, release channels, database namespace and update feed.
3. Never commit credentials, signing keys, private tokens or production secrets.
4. Use established cryptographic protocols and libraries; do not invent encryption primitives.
5. Do not claim E2EE until key verification, device lifecycle, backups, multi-device behavior and security tests are implemented and reviewed.
6. Add automated tests and CI checks for each vertical slice.
7. Updates must be app-only. Never ask ordinary users to reboot the entire PC as a routine update step.

See `docs/architecture.md` and `docs/backend-client.md`.
