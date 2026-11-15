-- The current device-key implementation uses the P-256 ECDH identity key.
-- Signed prekeys are reserved for a future protocol and are not generated yet.
-- Keeping these unused columns nullable allows first-time device registration.
alter table public.user_devices
  alter column signed_prekey_public drop not null,
  alter column signed_prekey_signature drop not null;
