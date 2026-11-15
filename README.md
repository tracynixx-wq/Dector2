# Dector

Dector is a new, independent cross-platform messenger. Its product behavior is informed by the existing Message project and Telegram interaction patterns, while its implementation is designed as a clean native codebase.

## Product goals

- Account registration, sign-in, persistent sessions, profile editing and avatars.
- One-to-one and group conversations, contacts/user search, message history, replies, edits, deletes, reactions, read states and typing/presence.
- Attachments, media previews, notifications, privacy controls and settings.
- Consistent profile presentation and smooth, accessible UI.
- Secure transport, safe credential/session storage, and a documented end-to-end encryption design.
- Reliable platform-specific updates with staged rollout, integrity verification, rollback strategy and no forced operating-system restart.

## Technology direction

- **Desktop:** C++20 and Qt 6 (Qt Quick/QML for UI; Qt Network/SQL and platform-native integrations where appropriate).
- **Shared core:** C++20 libraries for domain models, protocol/client logic, cryptographic interfaces and synchronization.
- **Android:** Kotlin UI with shared C++ core through JNI where justified.
- **iOS:** Swift/SwiftUI UI with shared C++ core through a narrow, audited bridge where justified.
- **Backend:** preserve proven Message data model and service behavior only after auditing its current schema, access policies and client contracts. Do not blindly reuse legacy SQL or secrets.

Telegram is a reference for product behavior and the broad C++/Qt desktop technology direction; Dector will not copy Telegram branding, assets, or source code.

## Engineering rules

1. Audit Message's current implementation and backend contract before porting each feature.
2. Keep Dector independent: separate app identifiers, signing keys, release channels, database namespace and update feed.
3. Never commit credentials, signing keys, private tokens or production secrets.
4. Use established cryptographic protocols and libraries; do not invent encryption primitives.
5. Do not claim end-to-end encryption until key verification, device lifecycle, backups, multi-device behavior and security tests are implemented and reviewed.
6. Add automated tests and CI checks for each vertical slice.
7. Updates must be app-only. Never ask ordinary users to reboot the entire PC as a routine update step.

## Initial delivery sequence

1. Repository and architecture foundation.
2. Authentication, session persistence and profile.
3. Messaging, synchronization and reliable offline behavior.
4. Encryption and key lifecycle.
5. Desktop updater and signed release pipeline.
6. Android and iOS clients.
7. Feature parity, accessibility, performance and security review.

See docs/architecture.md for the initial architecture and migration plan.
