import { useCallback, useEffect, useState } from 'react'
import { supabase, isConfigured } from './lib/supabase'
import { ensureDevice, encryptMessage, decryptMessage } from './lib/crypto'

const iconPaths = {
  Search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></>,
  Send: <><path d="m21 3-7.2 18-3.8-7.8L2 9.4 21 3Z"/><path d="M10 13.2 21 3"/></>,
  LogOut: <><path d="M10 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20H10"/><path d="M14 8l4 4-4 4M18 12H9"/></>,
  MessageCircle: <><path d="M20 11.2a7.8 7.8 0 0 1-8.1 7.8 8.7 8.7 0 0 1-3.5-.8L4 20l1.4-4A7.4 7.4 0 0 1 4 11.2 7.8 7.8 0 0 1 12 3.5a7.8 7.8 0 0 1 8 7.7Z"/><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01"/></>,
  UserRound: <><circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
  Plus: <><path d="M12 5v14M5 12h14"/></>,
  ShieldCheck: <><path d="M12 3 19 6v5.2c0 4.4-2.8 7.8-7 9.8-4.2-2-7-5.4-7-9.8V6l7-3Z"/><path d="m8.7 12 2.2 2.2 4.5-4.6"/></>,
  Settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 13.5 1.1.9-1.8 3.1-1.4-.5a7.7 7.7 0 0 1-1.7 1l-.2 1.5h-3.6l-.2-1.5a7.7 7.7 0 0 1-1.7-1l-1.4.5-1.8-3.1 1.1-.9a7.2 7.2 0 0 1 0-2l-1.1-.9 1.8-3.1 1.4.5a7.7 7.7 0 0 1 1.7-1l.2-1.5h3.6l.2 1.5a7.7 7.7 0 0 1 1.7 1l1.4-.5 1.8 3.1-1.1.9a7.2 7.2 0 0 1 0 2Z"/></>,
  X: <><path d="m6 6 12 12M18 6 6 18"/></>,
  LoaderCircle: <><path d="M20 12a8 8 0 1 1-8-8"/></>
};
function Glyph({ name, size = 20, className }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}
const Search = props => <Glyph name="Search" {...props}/>;
const Send = props => <Glyph name="Send" {...props}/>;
const LogOut = props => <Glyph name="LogOut" {...props}/>;
const MessageCircle = props => <Glyph name="MessageCircle" {...props}/>;
const UserRound = props => <Glyph name="UserRound" {...props}/>;
const Plus = props => <Glyph name="Plus" {...props}/>;
const ShieldCheck = props => <Glyph name="ShieldCheck" {...props}/>;
const Settings = props => <Glyph name="Settings" {...props}/>;
const X = props => <Glyph name="X" {...props}/>;
const LoaderCircle = props => <Glyph name="LoaderCircle" {...props}/>;


const initial = (s = '?') => s.trim().slice(0, 1).toUpperCase()
const errText = e => e?.message || 'Не удалось выполнить действие.'

export default function App() {
  const [session, setSession] = useState(null), [boot, setBoot] = useState(true)
  const [mode, setMode] = useState('login'), [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [profile, setProfile] = useState(null), [username, setUsername] = useState(''), [displayName, setDisplayName] = useState(''), [bio, setBio] = useState(''), [avatarFile, setAvatarFile] = useState(null)
  const [device, setDevice] = useState(null), [chats, setChats] = useState([]), [active, setActive] = useState(null), [messages, setMessages] = useState([])
  const [query, setQuery] = useState(''), [people, setPeople] = useState([]), [draft, setDraft] = useState('')
  const [peopleOpen, setPeopleOpen] = useState(false), [profileOpen, setProfileOpen] = useState(false)
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('')

  useEffect(() => {
    if (!supabase) { setBoot(false); return }
    let alive = true
    supabase.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); setBoot(false) } })
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
    const decoded = await Promise.all((data || []).map(async m => {
      try {
        if (m.encryption_version !== 1) return { ...m, text: '[Неподдерживаемая версия шифрования]' }
        return { ...m, text: await decryptMessage(supabase, m, device.deviceId, device.pair.privateKey) }
      } catch { return { ...m, text: '[Не удалось расшифровать на этом устройстве]' } }
    }))
    setMessages(decoded)
  }, [active, device])

  useEffect(() => {
    if (!session || !active || !device) return
    loadMessages().catch(e => setNotice(errText(e)))
    const ch = supabase.channel('dector-' + active)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + active },
        () => loadMessages().catch(e => setNotice(errText(e))))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_key_envelopes', filter: 'recipient_device_id=eq.' + device.deviceId },
        () => loadMessages().catch(e => setNotice(errText(e)))).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session, active, device, loadMessages])

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

  async function searchPeople(value) {
    setQuery(value)
    if (value.trim().length < 2) { setPeople([]); return }
    const { data, error } = await supabase.from('profiles').select('id,username,display_name,bio,avatar_path')
      .ilike('username', '%' + value.trim() + '%').neq('id', session.user.id).limit(15)
    if (error) setNotice(errText(error)); else setPeople(data || [])
  }

  async function createChat(person) {
    setBusy(true); setNotice('')
    try {
      const ids = [session.user.id, person.id].sort()
      const { data: found, error: findError } = await supabase.from('direct_conversation_pairs')
        .select('conversation_id').eq('user_low', ids[0]).eq('user_high', ids[1]).maybeSingle()
      if (findError) throw findError
      let id = found?.conversation_id
      if (!id) {
        const { data: c, error } = await supabase.from('conversations').insert({ kind: 'direct', created_by: session.user.id }).select().single()
        if (error) throw error
        id = c.id
        const { error: memberError } = await supabase.from('conversation_members').insert(ids.map(user_id => ({
          conversation_id: id, user_id, role: user_id === session.user.id ? 'owner' : 'member'
        })))
        if (memberError) throw memberError
        const { error: pairError } = await supabase.from('direct_conversation_pairs').insert({ user_low: ids[0], user_high: ids[1], conversation_id: id })
        if (pairError) throw pairError
      }
      await loadChats(); setActive(id); setPeopleOpen(false); setQuery('')
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

  const avatarUrl = path => path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : ''

  async function saveProfile(e) {
    e.preventDefault(); setBusy(true); setNotice('')
    try {
      const clean = username.trim().toLowerCase()
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(clean)) throw new Error('Юзернейм: 3–32 символа, латиница, цифры и _.')
      let avatar_path = profile?.avatar_path || null
      if (avatarFile) {
        if (!['image/jpeg','image/png','image/webp'].includes(avatarFile.type)) throw new Error('Поддерживаются JPG, PNG и WebP.')
        if (avatarFile.size > 3 * 1024 * 1024) throw new Error('Размер фотографии не должен превышать 3 МБ.')
        const extension = avatarFile.type.split('/')[1].replace('jpeg','jpg')
        const newPath = session.user.id + '/' + crypto.randomUUID() + '.' + extension
        const { error: uploadError } = await supabase.storage.from('avatars').upload(newPath, avatarFile, { contentType: avatarFile.type, upsert: false })
        if (uploadError) throw uploadError
        avatar_path = newPath
      }
      const { data, error } = await supabase.from('profiles').update({
        username: clean, display_name: displayName.trim(), bio, avatar_path, updated_at: new Date().toISOString()
      }).eq('id', session.user.id).select().single()
      if (error) throw error
      if (avatarFile && profile?.avatar_path) await supabase.storage.from('avatars').remove([profile.avatar_path])
      setProfile(data); setAvatarFile(null); setProfileOpen(false); setNotice('Профиль сохранён.')
    } catch(e) { setNotice(errText(e)) } finally { setBusy(false) }
  }

  if (!isConfigured) return <main className="center"><div className="brand">D</div><h1>Dector</h1><p>Добавь URL и Publishable key проекта Dector2 в файл <code>.env.local</code> на основе <code>.env.example</code>.</p></main>
  if (boot) return <div className="center"><LoaderCircle className="spin"/>Загрузка Dector…</div>
  if (!session) return <main className="center"><form className="auth card" onSubmit={authSubmit}><div className="brand">D</div><h1>Dector</h1><p className="muted">Приватное общение</p><label>Почта<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Пароль<input type="password" minLength="8" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'Подождите…':mode==='login'?'Войти':'Зарегистрироваться'}</button><button type="button" className="textbtn" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Создать аккаунт':'Уже есть аккаунт? Войти'}</button>{notice&&<p className="notice">{notice}</p>}</form></main>

  const selected = chats.find(c => c.id === active)
  return <main className="layout">
    <nav className="rail"><div className="brand mini">D</div><button className="on" title="Чаты"><MessageCircle/></button><button title="Найти людей" onClick={()=>setPeopleOpen(true)}><Search/></button><button title="Профиль" onClick={()=>setProfileOpen(true)}><UserRound/></button><button className="logout" title="Выйти" onClick={()=>supabase.auth.signOut()}><LogOut/></button></nav>
    <aside className="chats"><header><div><h2>Сообщения</h2><small>Ваши диалоги</small></div><button className="icon" onClick={()=>setPeopleOpen(true)}><Plus/></button></header>
      {chats.map(c=><button key={c.id} className={'chatitem '+(active===c.id?'active':'')} onClick={()=>setActive(c.id)}><div className="avatar">{c.avatar_path ? <img src={avatarUrl(c.avatar_path)} alt=""/> : initial(c.title||'D')}</div><div><b>{c.title||'Личный чат'}</b><small>Открыть переписку</small></div></button>)}
      {!chats.length&&<div className="empty"><MessageCircle/><b>Пока нет чатов</b><button className="primary" onClick={()=>setPeopleOpen(true)}>Новый диалог</button></div>}
      <footer><div className="avatar">{profile?.avatar_path ? <img src={avatarUrl(profile.avatar_path)} alt=""/> : initial(profile?.display_name||profile?.username||'U')}</div><div><b>{profile?.display_name||profile?.username}</b><small>@{profile?.username}</small></div><button className="icon" onClick={()=>setProfileOpen(true)}><Settings/></button></footer>
    </aside>
    <section className="conversation">{selected?<><header className="convhead"><div className="avatar">{selected.avatar_path ? <img src={avatarUrl(selected.avatar_path)} alt=""/> : initial(selected.title||'D')}</div><div><b>{selected.title||'Личный чат'}</b><small>Сквозное шифрование · AES‑GCM / ECDH</small></div><ShieldCheck className="shield"/></header><div className="messages">{messages.map(m=><div key={m.id} className={'line '+(m.sender_id===session.user.id?'mine':'')}><div className="bubble">{m.text}<time>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></div></div>)}{!messages.length&&<div className="empty"><MessageCircle/><b>Начните общение</b><small>Сообщения шифруются на устройстве перед отправкой.</small></div>}</div><form className="composer" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Написать сообщение…"/><button className="send" disabled={busy||!draft.trim()}><Send/></button></form></>:<div className="empty"><MessageCircle/><h2>Dector</h2><small>Выбери диалог или найди пользователя.</small></div>}</section>
    {peopleOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setPeopleOpen(false)}><section className="modal"><header><h3>Новый диалог</h3><button className="icon" onClick={()=>setPeopleOpen(false)}><X/></button></header><div className="search"><Search/><input autoFocus value={query} onChange={e=>searchPeople(e.target.value)} placeholder="Поиск по юзернейму"/></div>{people.map(p=><button className="person" key={p.id} onClick={()=>createChat(p)}><div className="avatar">{p.avatar_path ? <img src={avatarUrl(p.avatar_path)} alt=""/> : initial(p.display_name||p.username)}</div><div><b>{p.display_name||p.username}</b><small>@{p.username}</small></div><Plus/></button>)}</section></div>}
    {profileOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setProfileOpen(false)}><form className="modal" onSubmit={saveProfile}><header><h3>Профиль</h3><button type="button" className="icon" onClick={()=>setProfileOpen(false)}><X/></button></header><div className="profileicon">{profile?.avatar_path ? <img src={avatarUrl(profile.avatar_path)} alt="Аватар профиля"/> : initial(displayName||username)}</div><label>Фото профиля<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setAvatarFile(e.target.files?.[0] || null)}/></label><label>Имя<input value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><label>Юзернейм<input value={username} onChange={e=>setUsername(e.target.value)}/></label><label>О себе<textarea rows="3" value={bio} onChange={e=>setBio(e.target.value)}/></label><button className="primary" disabled={busy}>Сохранить</button></form></div>}
    {notice&&<button className="toast" onClick={()=>setNotice('')}>{notice}<X size={14}/></button>}
  </main>
}