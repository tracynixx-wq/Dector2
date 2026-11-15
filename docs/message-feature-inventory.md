# Message feature inventory for Dector

This inventory is based on the current Message client source and its backend contract audit. It is a porting checklist, not a claim that Dector already implements these features.

## Account and identity
- Email/password authentication and account creation.
- Persistent authenticated sessions and account switching/local account records.
- Public profile: display name, unique username, bio, status emoji, accent color, avatar and theme.
- Public-key publication and encrypted private-key backup.
- Device/session information and account/profile settings.

## Conversations and messaging
- Direct conversations and group conversations.
- Conversation list, search, folders/filters, unread counts and pinned conversation/message state.
- Message history, encrypted message payloads, replies, edits, deletion, reactions, read receipts and pagination.
- Typing/presence indicators and realtime updates.
- Attachments/media, image viewing, voice messages and message selection/actions.
- Secret conversations with expiry/TTL behavior.
- Group roles, membership changes and channel-style read-only posting rules.

## Social and communication features
- Stories, story views, expiry and visibility rules.
- Voice and video call UI/initialization flows; verify actual signaling/media reliability before claiming parity.
- Push subscription registration; delivery remains unverified until provider credentials and server function are configured.

## Profile and interface
- Profile sheet/page, avatar and cover assets, profile theme/color and status presentation.
- Chat design/group style controls, responsive navigation, animated overlays/sheets and media viewer.
- Settings, privacy information and session controls.

## Backend contract observed in Message

Tables: profiles, keybackup, convs, members, msgs, stories, story_views, push_subs. RPCs: member_flag, mark_read, react, pin_msg, purge_secret. Storage buckets: avatars and media. Realtime subscriptions: msgs, members, convs, profiles.

The old root setup.sql is explicitly obsolete. It describes a legacy messages table, omits active tables and has an unsafe profile-insert limit. Never use it as the Dector schema. Audit the current migration and live policies before designing Dector migrations.

## Security and reliability issues to fix during port

- Conversation creation should be atomic; current multi-request flow can leave orphaned/partial conversations.
- Query errors must be surfaced instead of appearing as empty chat lists.
- Use cursor-based history pagination rather than loading a fixed large batch.
- Keep encrypted media in private storage and use authorization/signed URLs rather than public object URLs.
- Review browser IndexedDB private-key storage and define secure device storage/logout behavior for each native platform.
- Enforce secret-message expiry on the server, not only in the client.
- Verify membership/role authorization for every database function and storage operation.
- Verify group-key rotation, key history, multi-device behavior, push delivery, calls and long-history loading with real test accounts.

## Porting rule

For every feature, implement the domain contract and automated tests first, then connect the desktop/mobile UI. Preserve Message's intended behavior while correcting known defects; do not reproduce insecure policies or legacy implementation bugs.
