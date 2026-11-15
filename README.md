# Dector

Dector is a React + Vite messaging client backed by Supabase, packaged for Windows with Electron.

## Local setup

1. Install Node.js 22.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Dector2 Supabase project's API settings.
4. Run `npm install`, then `npm run dev` for the web client.
5. Run `npm run build` to create the production web bundle.
6. Run `npm run dist` on Windows to create the NSIS installer in `release/`.

## Implemented

- Supabase email/password registration and login with persistent sessions and automatic token refresh.
- Editable user profiles, public avatar uploads (JPG/PNG/WebP up to 3 MB), and username search.
- Direct conversations, encrypted message payloads and realtime updates. The required realtime publication and avatar Storage policies are documented in `supabase/setup.sql` and have been applied to Dector2.
- Per-device P-256 ECDH keys stored in IndexedDB; random AES-256-GCM key per message; encrypted message keys for each active participant device.
- Windows Electron wrapper with NSIS installer and GitHub-release update checks. Downloaded updates prompt to restart only Dector, not Windows.

## Security notes

The current E2EE implementation is an initial device-key design, not a Signal-style ratchet. It does not yet provide forward secrecy, key transparency, secure key backup/recovery, or independent cryptographic audit. Private device keys stay in browser IndexedDB and are not synchronized, so a newly added device cannot decrypt old messages. Treat this as an early implementation until those properties are completed and reviewed.

Only a Supabase publishable key belongs in the frontend. Never put a service-role or secret key in `.env.local`.

## Build and release

Pushing to `main` runs a Windows installer build and uploads the EXE as a GitHub Actions artifact. Pushing a version tag such as `v0.1.0` publishes a GitHub release with the installer and update metadata. Electron auto-update checks published releases.
