-- Cover foreign-key lookups used by joins and cascades.
create index if not exists conversations_created_by_idx
  on public.conversations(created_by);
create index if not exists message_key_envelopes_recipient_device_idx
  on public.message_key_envelopes(recipient_device_id);
create index if not exists messages_reply_to_idx
  on public.messages(reply_to);
