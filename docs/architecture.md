# Dector architecture and migration plan

## 1. Baseline findings

The target repository was initially almost empty (only a short README). The source project tracynixx-wq/message is a web/PWA application written primarily in JavaScript and CSS, with an Electron wrapper for Windows. Its desktop wrapper uses electron-updater and GitHub Releases. The current repository also contains Android build scaffolding and Supabase-related application code.

Important: the legacy setup.sql explicitly labels itself obsolete and warns that its schema/policies do not match the current app. It must not be used as Dector's database schema.

## 2. Proposed components

- apps/desktop: C++20 + Qt 6 desktop application
- apps/android: Kotlin application
- apps/ios: Swift application
- core/domain: accounts, profiles, conversations, messages
- core/networking: API client, reconnect, retries, sync
- core/crypto: audited crypto adapters and key lifecycle
- core/storage: local cache, migrations, secure storage interfaces
- core/updates: platform update abstractions
- backend/migrations: Dector-owned schema migrations
- backend/functions: server-side operations
- docs and tests

The exact layout may be adjusted after inspecting the Message app's actual modules and backend contract.

## 3. Feature parity inventory

The Message application is the behavioral source of truth for features that already exist. Before implementing a feature in Dector, record user-visible behavior and edge cases; client-side state transitions; API/database tables, policies and realtime events; attachment/storage behavior; error and offline behavior; tests and known defects.

Port behavior and data contracts deliberately; do not copy obsolete schema, unsafe policies, hard-coded secrets or fragile implementation details.

## 4. Desktop stack

Use C++20 and Qt 6 for the native desktop client. Qt Quick/QML is the preferred UI layer for fluid transitions and responsive layouts. Keep domain logic out of QML. The desktop updater will be a separate module with channel and platform validation; manifest/version comparison; download progress and resumable download where supported; signature/hash verification; explicit user consent before install/restart; preservation of local data and authenticated session; rollback/recovery behavior.

Do not reuse Message's release repository or app identifier. Dector needs its own GitHub release feed and signing identity.

## 5. Security and encryption

Use TLS for all network traffic. For end-to-end encrypted conversations, select a maintained, independently reviewed protocol/library rather than designing a custom cipher. The design must cover identity keys, signed prekeys, one-time prekeys, session establishment, ratcheting, device linking/revocation, key changes, encrypted attachments, secure local storage and recovery semantics. Server-side access policies must prevent unauthorized reads and writes even when clients are modified.

Encryption status must be described accurately: transport encryption is not the same as end-to-end encryption. Do not advertise E2EE until the implementation and threat-model review are complete.

## 6. Backend migration

Do not point Dector at Message production tables by default. First audit the live Message contract, then create a Dector-owned schema and migration set. Reuse service behavior where safe, but isolate users, storage buckets, policies, push credentials and secrets. No production credentials belong in Git.

## 7. Quality gates

Each feature slice should include unit tests, integration tests against an isolated backend, migration/policy checks, and platform build validation. Release builds should be reproducible and signed. Test update failure, interrupted downloads, stale manifests, rollback, account/session persistence and app restart without OS reboot.
