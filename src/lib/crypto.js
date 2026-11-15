const DB_NAME = 'dector-crypto'
const STORE = 'keys'

function openKeyDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function readLocal(key) {
  const db = await openKeyDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}
async function writeLocal(key, value) {
  const db = await openKeyDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}
const encode = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
const decode = (value) => Uint8Array.from(atob(value), c => c.charCodeAt(0))
const exportPublic = (key) => crypto.subtle.exportKey('jwk', key)

export async function ensureDevice(supabase, user) {
  const identitySlot = 'identity:' + user.id
  const deviceSlot = 'deviceId:' + user.id
  let pair = await readLocal(identitySlot)
  let deviceId = await readLocal(deviceSlot)
  if (!pair) {
    if (deviceId) {
      await supabase.from('user_devices').update({ revoked_at: new Date().toISOString() }).eq('id', deviceId)
    }
    pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
    await writeLocal(identitySlot, pair)
    deviceId = null
  }
  if (!deviceId) {
    const publicJwk = await exportPublic(pair.publicKey)
    const { data, error } = await supabase.from('user_devices').insert({
      user_id: user.id,
      device_name: navigator.userAgent.includes('Windows') ? 'Windows device' : 'Browser device',
      identity_key_public: JSON.stringify(publicJwk)
    }).select('id').single()
    if (error) throw error
    deviceId = data.id
    await writeLocal(deviceSlot, deviceId)
  }
  return { pair, deviceId }
}

export async function encryptMessage(supabase, text, conversationId, senderId, deviceId) {
  const { data: members, error: membersError } = await supabase.from('conversation_members')
    .select('user_id').eq('conversation_id', conversationId)
  if (membersError) throw membersError
  const memberIds = [...new Set((members || []).map(m => m.user_id))]
  const { data: devices, error: devicesError } = await supabase.from('user_devices')
    .select('id,user_id,identity_key_public').in('user_id', memberIds).is('revoked_at', null)
  if (devicesError) throw devicesError
  if (!devices?.length || memberIds.some(id => !devices.some(device => device.user_id === id))) {
    throw new Error('Каждый участник должен хотя бы один раз войти в Dector с устройства, чтобы получить ключ шифрования.')
  }

  const messageKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(text)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, messageKey, plaintext)
  const rawMessageKey = await crypto.subtle.exportKey('raw', messageKey)
  const clientMessageId = crypto.randomUUID()

  const envelopes = []
  for (const device of devices) {
    const recipientPublic = await crypto.subtle.importKey(
      'jwk', JSON.parse(device.identity_key_public),
      { name: 'ECDH', namedCurve: 'P-256' }, false, []
    )
    const ephemeral = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
    )
    const wrappingKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: recipientPublic }, ephemeral.privateKey,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt']
    )
    const wrapNonce = crypto.getRandomValues(new Uint8Array(12))
    const wrappedKey = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: wrapNonce }, wrappingKey, rawMessageKey
    )
    const ephemeralPublic = await exportPublic(ephemeral.publicKey)
    envelopes.push({
      recipient_device_id: device.id,
      encrypted_key: JSON.stringify({ ephemeral_public: ephemeralPublic, nonce: encode(wrapNonce), wrapped_key: encode(wrappedKey) })
    })
  }

  const { data: message, error: messageError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    client_message_id: clientMessageId,
    ciphertext: encode(ciphertext),
    nonce: encode(nonce),
    encryption_version: 1,
    content_type: 'text'
  }).select('id').single()
  if (messageError) throw messageError
  const { error: envelopeError } = await supabase.from('message_key_envelopes').insert(
    envelopes.map(e => ({ ...e, message_id: message.id }))
  )
  if (envelopeError) {
    await supabase.from('messages').delete().eq('id', message.id)
    throw envelopeError
  }
  return message
}

export async function decryptMessage(supabase, message, deviceId, privateKey) {
  const { data: envelope, error } = await supabase.from('message_key_envelopes')
    .select('encrypted_key').eq('message_id', message.id)
    .eq('recipient_device_id', deviceId).maybeSingle()
  if (error) throw error
  if (!envelope) return '[Это сообщение отправлено с другого устройства]'
  const packet = JSON.parse(envelope.encrypted_key)
  const ephemeralPublic = await crypto.subtle.importKey(
    'jwk', packet.ephemeral_public, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: ephemeralPublic }, privateKey,
    { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  )
  const rawKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(packet.nonce) }, wrappingKey, decode(packet.wrapped_key)
  )
  const messageKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(message.nonce) }, messageKey, decode(message.ciphertext)
  )
  return new TextDecoder().decode(plaintext)
}
