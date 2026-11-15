import { useCallback, useEffect, useState } from 'react'
import { supabase, isConfigured } from './lib/supabase'
import { ensureDevice, encryptMessage, decryptMessage } from './lib/crypto'

import { Search, Send, LogOut, MessageCircle, UserRound, Plus, ShieldCheck, Settings, SlidersHorizontal, X, LoaderCircle, ArrowLeft } from 'lucide-react'

const initial = (s = '?') => s.trim().slice(0, 1).toUpperCase()
const errText = e => e?.message || 'Не удалось выполнить действие.'

export default function App() {
  const [session, setSession] = useState(null), [boot, setBoot] = useState(true)
  const [mode, setMode] = useState('login'), [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [profile, setProfile] = useState(null), [username, setUsername] = useState(''), [displayName, setDisplayName] = useState(''), [bio, setBio] = useState(''), [avatarFile, setAvatarFile] = useState(null), [bannerFile, setBannerFile] = useState(null), [bannerPreview, setBannerPreview] = useState('')
  const [device, setDevice] = useState(null), [chats, setChats] = useState([]), [active, setActive] = useState(null), [messages, setMessages] = useState([])
  const [query, setQuery] = useState(''), [people, setPeople] = useState([]), [draft, setDraft] = useState('')
  const [peopleOpen, setPeopleOpen] = useState(false), [profileOpen, setProfileOpen] = useState(false), [customOpen, setCustomOpen] = useState(false)
  const [appearance, setAppearance] = useState(() => { try { return { accent: localStorage.getItem('dector-accent') || '#a9e66b', compact: localStorage.getItem('dector-compact') === 'true' } } catch { return { accent: '#a9e66b', compact: false } } })
  const accents = ['#a9e66b','#78b8ff','#c49bff','#ff91b5','#ffb86b','#55d6c2','#f2d45c']
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('')

  useEffect(() => {
    if (!supabase) { setBoot(false); return }
    let alive = true
    supabase.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); setBoot(false) } }).catch(e => { if (alive) { setNotice(errText(e)); setBoot(false) } })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => { setSession(s); setBoot(false) })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  const loadChats = useCallback(async () => {
    if (!session?.user) return
    const { data, error } = await supabase.from('conversation_members')
      .select('conversation_id, conversations(id, kind, title, updated_at)')
      .eq('user_id', session.user.id)
    if (error) throw error
    let rows = (data || []).map(x => x.conversations).filter(Boolean)
    if (rows.length) {
      const ids = rows.map(c => c.id)
      const { data: members, error: memberError } = await supabase.from('conversation_members')
        .select('conversation_id,user_id').in('conversation_id', ids).neq('user_id', session.user.id)
      if (memberError) throw memberError
      const userIds = [...new Set((members || []).map(m => m.user_id))]
      const { data: people, error: peopleError } = userIds.length
        ? await supabase.from('profiles').select('id,username,display_name,avatar_path').in('id', userIds)
        : { data: [], error: null }
      if (peopleError) throw peopleError
      rows = rows.map(c => {
        if (c.kind === 'group' || c.title) return c
        const other = (members || []).find(m => m.conversation_id === c.id)
        const person = (people || []).find(p => p.id === other?.user_id)
        return { ...c, title: person?.display_name || person?.username || 'Личный чат', avatar_path: person?.avatar_path || null }
      })
    }
    rows.sort((a,b) => new Date(b.updated_at)-new Date(a.updated_at))
    setChats(rows)
    if (!active && rows.length) setActive(rows[0].id)
  }, [session, active])

  useEffect(() => {
    if (!session?.user) { setProfile(null); setDevice(null); setChats([]); setMessages([]); return }
    let alive = true
    ;(async () => {
      const u = session.user
      const fallbackName = (u.email || 'user').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'user'
      const { data: p, error } = await supabase.from('profiles').upsert({
        id: u.id, username: fallbackName + '_' + u.id.slice(0, 5),
        display_name: u.user_metadata?.display_name || ''
      }, { onConflict: 'id', ignoreDuplicates: true }).select().maybeSingle()
      if (error) throw error
      const { data: current, error: profileError } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      if (profileError) throw profileError
      if (!alive) return
      setProfile(current); setUsername(current.username); setDisplayName(current.display_name || ''); setBio(current.bio || '')
      const d = await ensureDevice(supabase, u)
      if (alive) setDevice(d)
      await loadChats()
    })().catch(e => setNotice(errText(e)))
    return () => { alive = false }
  }, [session])

  const loadMessages = useCallback(async () => {
    if (!active || !device) { setMessages([]); return }
    const { data, error } = await supabase.from('messages').select('id,sender_id,ciphertext,nonce,encryption_version,content_type,created_at')
      .eq('conversation_id', active).is('deleted_at', null).order('created_at', { ascending: true }).limit(150)
    if (error) throw error
    const rows = data || []
    if (!rows.length) { setMessages([]); return }
    const messageIds = rows.map(message => message.id)
    const { data: envelopes, error: envelopeError } = await supabase.from('message_key_envelopes')
      .select('message_id,encrypted_key')
      .in('message_id', messageIds)
      .eq('recipient_device_id', device.deviceId)
    if (envelopeError) throw envelopeError
    const envelopeByMessage = new Map((envelopes || []).map(envelope => [envelope.message_id, envelope]))
    const decoded = await Promise.all(rows.map(async m => {
      try {
        if (m.encryption_version !== 1) return { ...m, text: '[Неподдерживаемая версия шифрования]' }
        return { ...m, text: await decryptMessage(supabase, m, device.deviceId, device.pair.privateKey, envelopeByMessage.get(m.id) || null) }
      } catch { return { ...m, text: '[Не удалось расшифровать на этом устройстве]' } }
    }))
    setMessages(decoded)
  }, [active, device])

  const upsertRealtimeMessage = useCallback(async (messageId, envelope) => {
    const { data: message, error } = await supabase.from('messages')
      .select('id,sender_id,ciphertext,nonce,encryption_version,content_type,created_at,deleted_at,conversation_id')
      .eq('id', messageId).eq('conversation_id', active).maybeSingle()
    if (error) throw error
    if (!message || message.deleted_at) {
      setMessages(current => current.filter(item => item.id !== messageId))
      return
    }
    let text
    try {
      text = message.encryption_version !== 1
        ? '[Неподдерживаемая версия шифрования]'
        : await decryptMessage(supabase, message, device.deviceId, device.pair.privateKey, envelope)
    } catch {
      text = '[Не удалось расшифровать на этом устройстве]'
    }
    const decoded = { ...message, text }
    setMessages(current => {
      const next = current.filter(item => item.id !== messageId)
      next.push(decoded)
      next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      return next
    })
  }, [active, device])

  useEffect(() => {
    if (!session || !active || !device) return
    loadMessages().catch(e => setNotice(errText(e)))
    const ch = supabase.channel('dector-' + active)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + active },
        () => loadMessages().catch(e => setNotice(errText(e))))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + active },
        () => loadMessages().catch(e => setNotice(errText(e))))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_key_envelopes', filter: 'recipient_device_id=eq.' + device.deviceId },
        payload => {
          if (payload.new?.message_id) {
            upsertRealtimeMessage(payload.new.message_id, payload.new)
              .catch(e => setNotice(errText(e)))
          }
        }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session, active, device, loadMessages, upsertRealtimeMessage])

  async function authSubmit(e) {
    e.preventDefault(); setBusy(true); setNotice('')
    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice(data.session ? 'Аккаунт создан.' : 'Проверь почту для подтверждения регистрации.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch(e) { setNotice(errText(e)) } finally { setBusy(false) }
  }

  useEffect(() => {
    const term = query.trim()
    if (!peopleOpen || term.length < 2 || !session?.user) { setPeople([]); return }
    let alive = true
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.from('profiles').select('id,username,display_name,bio,avatar_path')
        .ilike('username', '%' + term + '%').neq('id', session.user.id).limit(15)
      if (!alive) return
      if (error) setNotice(errText(error))
      else setPeople(data || [])
    }, 280)
    return () => { alive = false; clearTimeout(timer) }
  }, [query, peopleOpen, session])

  async function createChat(person) {
    setBusy(true); setNotice('')
    try {
      // Серверная RPC создаёт диалог и пару участников атомарно.
      const { data: id, error } = await supabase.rpc('create_direct_conversation', {
        p_username: person.username
      })
      if (error) throw error
      if (!id) throw new Error('Не удалось создать диалог.')
      await loadChats()
      setActive(id); setPeopleOpen(false); setQuery('')
    } catch(e) { setNotice(errText(e)) } finally { setBusy(false) }
  }

  async function send(e) {
    e.preventDefault()
    if (!draft.trim() || !active || !device) return
    setBusy(true); setNotice('')
    try {
      await encryptMessage(supabase, draft.trim(), active, session.user.id, device.deviceId)
      setDraft('')
      await loadMessages()
    } catch(e) { setNotice(errText(e)) } finally { setBusy(false) }
  }

  useEffect(() => { try { localStorage.setItem('dector-accent', appearance.accent); localStorage.setItem('dector-compact', String(appearance.compact)) } catch {} }, [appearance])

  const avatarUrl = path => path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : ''
  const bannerUrl = path => path ? supabase.storage.from('profile-banners').getPublicUrl(path).data.publicUrl : ''

  useEffect(() => {
    if (!bannerFile) { setBannerPreview(''); return }
    const url = URL.createObjectURL(bannerFile)
    setBannerPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [bannerFile])

  async function saveProfile(e) {
    e.preventDefault(); setBusy(true); setNotice('')
    const uploaded = { avatar: null, banner: null }
    try {
      const clean = username.trim().toLowerCase()
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(clean)) throw new Error('Юзернейм: 3–32 символа, латиница, цифры и _.')
      let avatar_path = profile?.avatar_path || null
      let banner_path = profile?.banner_path || null

      if (avatarFile) {
        if (!['image/jpeg','image/png','image/webp'].includes(avatarFile.type)) throw new Error('Поддерживаются JPG, PNG и WebP.')
        if (avatarFile.size > 3 * 1024 * 1024) throw new Error('Размер фотографии не должен превышать 3 МБ.')
        const extension = avatarFile.type.split('/')[1].replace('jpeg','jpg')
        const newPath = session.user.id + '/' + crypto.randomUUID() + '.' + extension
        const { error } = await supabase.storage.from('avatars').upload(newPath, avatarFile, { contentType: avatarFile.type, upsert: false })
        if (error) throw error
        uploaded.avatar = newPath
        avatar_path = newPath
      }

      if (bannerFile) {
        if (bannerFile.type !== 'image/gif' || !bannerFile.name.toLowerCase().endsWith('.gif')) throw new Error('Баннер должен быть файлом GIF.')
        if (bannerFile.size > 8 * 1024 * 1024) throw new Error('GIF-баннер не должен превышать 8 МБ.')
        const newPath = session.user.id + '/' + crypto.randomUUID() + '.gif'
        const { error } = await supabase.storage.from('profile-banners').upload(newPath, bannerFile, { contentType: 'image/gif', upsert: false })
        if (error) throw error
        uploaded.banner = newPath
        banner_path = newPath
      }

      const { data, error } = await supabase.from('profiles').update({
        username: clean, display_name: displayName.trim(), bio, avatar_path, banner_path,
        updated_at: new Date().toISOString()
      }).eq('id', session.user.id).select().single()
      if (error) throw error

      if (uploaded.avatar && profile?.avatar_path) await supabase.storage.from('avatars').remove([profile.avatar_path])
      if (uploaded.banner && profile?.banner_path) await supabase.storage.from('profile-banners').remove([profile.banner_path])
      setProfile(data); setAvatarFile(null); setBannerFile(null); setProfileOpen(false); setNotice('Профиль сохранён.')
    } catch(e) {
      if (uploaded.avatar) await supabase.storage.from('avatars').remove([uploaded.avatar])
      if (uploaded.banner) await supabase.storage.from('profile-banners').remove([uploaded.banner])
      setNotice(errText(e))
    } finally { setBusy(false) }
  }

  if (!isConfigured) return <main className="center"><div className="brand">D</div><h1>Dector</h1><p>Добавь URL и Publishable key проекта Dector2 в файл <code>.env.local</code> на основе <code>.env.example</code>.</p></main>
  if (boot) return <div className="center"><LoaderCircle className="spin"/>Загрузка Dector…</div>
  if (!session) return <main className="center"><form className="auth card" onSubmit={authSubmit}><div className="brand">D</div><h1>Dector</h1><p className="muted">Приватное общение</p><label>Почта<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Пароль<input type="password" minLength="8" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'Подождите…':mode==='login'?'Войти':'Зарегистрироваться'}</button><button type="button" className="textbtn" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Создать аккаунт':'Уже есть аккаунт? Войти'}</button>{notice&&<p className="notice">{notice}</p>}</form></main>

  const selected = chats.find(c => c.id === active)
  return <main className={'layout '+(appearance.compact?'compact':'')} style={{'--accent':appearance.accent}}>
    <nav className="rail"><div className="brand mini">D</div><button className="on" title="Чаты"><MessageCircle/></button><button title="Найти людей" onClick={()=>setPeopleOpen(true)}><Search/></button><button title="Профиль" onClick={()=>setProfileOpen(true)}><UserRound/></button><button title="Оформление" onClick={()=>setCustomOpen(true)}><SlidersHorizontal/></button><button className="logout" title="Выйти" onClick={()=>supabase.auth.signOut()}><LogOut/></button></nav>
    <aside className="chats"><header><div><h2>Сообщения</h2><small>Ваши диалоги</small></div><button className="icon" onClick={()=>setPeopleOpen(true)}><Plus/></button></header>
      {chats.map(c=><button key={c.id} className={'chatitem '+(active===c.id?'active':'')} onClick={()=>setActive(c.id)}><div className="avatar">{c.avatar_path ? <img src={avatarUrl(c.avatar_path)} alt=""/> : initial(c.title||'D')}</div><div><b>{c.title||'Личный чат'}</b><small>Открыть переписку</small></div></button>)}
      {!chats.length&&<div className="empty"><MessageCircle/><b>Пока нет чатов</b><button className="primary" onClick={()=>setPeopleOpen(true)}>Новый диалог</button></div>}
      <footer><div className="avatar">{profile?.avatar_path ? <img src={avatarUrl(profile.avatar_path)} alt=""/> : initial(profile?.display_name||profile?.username||'U')}</div><div><b>{profile?.display_name||profile?.username}</b><small>@{profile?.username}</small></div><button className="icon" onClick={()=>setProfileOpen(true)}><Settings/></button></footer>
    </aside>
    <section className="conversation">{selected?<><header className="convhead"><button type="button" className="back-to-chats" aria-label="Назад к чатам" onClick={()=>setActive(null)}><ArrowLeft/></button><div className="avatar">{selected.avatar_path ? <img src={avatarUrl(selected.avatar_path)} alt=""/> : initial(selected.title||'D')}</div><div><b>{selected.title||'Личный чат'}</b><small>Сквозное шифрование · AES‑GCM / ECDH</small></div><ShieldCheck className="shield"/></header><div className="messages">{messages.map(m=><div key={m.id} className={'line '+(m.sender_id===session.user.id?'mine':'')}><div className="bubble">{m.text}<time>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></div></div>)}{!messages.length&&<div className="empty"><MessageCircle/><b>Начните общение</b><small>Сообщения шифруются на устройстве перед отправкой.</small></div>}</div><form className="composer" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Написать сообщение…"/><button className="send" disabled={busy||!draft.trim()}><Send/></button></form></>:<div className="empty"><MessageCircle/><h2>Dector</h2><small>Выбери диалог или найди пользователя.</small></div>}</section>
    {peopleOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setPeopleOpen(false)}><section className="modal"><header><h3>Новый диалог</h3><button className="icon" onClick={()=>setPeopleOpen(false)}><X/></button></header><div className="search"><Search/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по юзернейму"/></div>{people.map(p=><button className="person" key={p.id} onClick={()=>createChat(p)}><div className="avatar">{p.avatar_path ? <img src={avatarUrl(p.avatar_path)} alt=""/> : initial(p.display_name||p.username)}</div><div><b>{p.display_name||p.username}</b><small>@{p.username}</small></div><Plus/></button>)}</section></div>}
    {customOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setCustomOpen(false)}><section className="modal custom-modal"><header><h3>Оформление</h3><button className="icon" onClick={()=>setCustomOpen(false)}><X/></button></header><label>Цвет акцента</label><div className="accent-grid">{accents.map(color=><button type="button" key={color} aria-label={'Цвет '+color} title={color} className={'swatch '+(appearance.accent===color?'selected':'')} style={{'--swatch':color}} onClick={()=>setAppearance(v=>({...v,accent:color}))}/>)}</div><div className="setting-row"><div><b>Компактный режим</b><small>Уменьшить отступы в списке чатов</small></div><button type="button" role="switch" aria-checked={appearance.compact} className={'switch '+(appearance.compact?'enabled':'')} onClick={()=>setAppearance(v=>({...v,compact:!v.compact}))}><span/></button></div><button type="button" className="textbtn" onClick={()=>setAppearance({accent:'#a9e66b',compact:false})}>Сбросить оформление</button></section></div>}
    {profileOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setProfileOpen(false)}><form className="modal" onSubmit={saveProfile}><header><h3>Профиль</h3><button type="button" className="icon" onClick={()=>setProfileOpen(false)}><X/></button></header><div className="profile-banner">{(bannerPreview || profile?.banner_path) && <img src={bannerPreview || bannerUrl(profile.banner_path)} alt="GIF-баннер профиля"/>}<span>Баннер профиля</span></div><label>GIF-баннер<input type="file" accept="image/gif,.gif" onChange={e=>setBannerFile(e.target.files?.[0] || null)}/><small>Только GIF · до 8 МБ</small></label><div className="profileicon">{profile?.avatar_path ? <img src={avatarUrl(profile.avatar_path)} alt="Аватар профиля"/> : initial(displayName||username)}</div><label>Фото профиля<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setAvatarFile(e.target.files?.[0] || null)}/></label><label>Имя<input value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><label>Юзернейм<input value={username} onChange={e=>setUsername(e.target.value)}/></label><label>О себе<textarea rows="3" value={bio} onChange={e=>setBio(e.target.value)}/></label><button className="primary" disabled={busy}>Сохранить</button></form></div>}
    {notice&&<button className="toast" onClick={()=>setNotice('')}>{notice}<X size={14}/></button>}
  </main>
}