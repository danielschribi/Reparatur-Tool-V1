// web/app.jsx — UMD + Babel Variante
const { useState, useEffect, useMemo } = React;

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [now, setNow] = useState(new Date());

  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);
  const timeStr = now.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'});
  const dateStr = now.toLocaleDateString('de-CH');

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 text-gray-800">
      <Header
        timeStr={timeStr}
        dateStr={dateStr}
        onHome={()=>setView('home')}
        onUser={()=>user ? setView('user') : setView('login')}
        onNewMeldung={()=>setView('meldung')}
        user={user}
      />
      <main className="flex-1 p-4">
        {view==='home' && <StartScreen/>}
        {view==='login' && <LoginForm onLogin={setUser} />}
        {view==='user' && user && <UserMask user={user} />}
        {view==='meldung' && user && <NewMeldung />}
      </main>
    </div>
  );
}

function Header({ timeStr, dateStr, onHome, onUser, onNewMeldung, user }) {
  return (
    <div className="relative h-16 bg-yellow-300 shadow flex items-center px-3">
      {/* Links: Avatar (gelbes ?) */}
      <Avatar/>

      {/* Mitte: Uhr groß + Datum darunter */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center leading-tight">
        <div className="text-3xl font-extrabold">{timeStr}</div>
        <div className="text-sm">{dateStr}</div>
      </div>

      {/* Rechts: Neue Meldung | User | Home */}
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onNewMeldung} className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow">Neue Meldung</button>
        <button onClick={onUser} className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow">User</button>
        <button onClick={onHome} className="w-9 h-9 rounded-full bg-yellow-200 hover:bg-yellow-400 flex items-center justify-center shadow text-lg">⌂</button>
      </div>
    </div>
  );
}

function Avatar(){
  return (
    <div
      className="w-9 h-9 rounded-full bg-yellow-400 text-black font-extrabold flex items-center justify-center shadow mr-2 select-none"
      title="Avatar"
    >?</div>
  );
}

function StartScreen(){
  const rows = useMemo(()=>Array.from({length:15}),[]);
  const cols = useMemo(()=>Array.from({length:6}),[]);
  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="overflow-auto border border-gray-300 rounded-lg shadow-sm">
        <table className="min-w-full text-[10px]">
          <tbody>
          {rows.map((_,i)=>(
            <tr key={i}>
              {cols.map((_,j)=>(<td key={j} className="h-6 border border-yellow-200 bg-yellow-50">&nbsp;</td>))}
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoginForm({ onLogin }){
  const [identifier,setIdentifier]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');

  async function submit(e){
    e.preventDefault(); setError('');
    try{
      const r = await fetch('/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ identifier, password })
      });
      const data = await r.json();
      if(data.error){
        // Freundliche Meldung + Hinweis auf Backend
        throw new Error(data.error);
      }
      // Wenn Backend ein Token liefert, legen wir eine Minimal-Session an
      onLogin({ vorname:'Demo', nachname:'User', rolle: data.role || 'user', token: data.token });
    }catch(e){ setError(e.message); }
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto mt-10 bg-white rounded-2xl shadow p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-center mb-4">Anmeldung</h2>
      <label className="block mb-1 text-sm">Benutzername oder E-Mail</label>
      <input className="w-full border rounded px-3 py-2 mb-3" value={identifier} onChange={e=>setIdentifier(e.target.value)} required />
      <label className="block mb-1 text-sm">Passwort</label>
      <input type="password" className="w-full border rounded px-3 py-2 mb-3" value={password} onChange={e=>setPassword(e.target.value)} required />
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      <button type="submit" className="w-full bg-yellow-300 hover:bg-yellow-400 rounded py-2 font-semibold shadow">Login</button>
    </form>
  );
}

function UserMask({ user }){
  return (
    <div className="max-w-lg mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200">
      <h2 className="text-lg font-bold mb-4">Benutzerprofil</h2>
      <div className="space-y-2 text-sm">
        <div><b>Vorname:</b> {user.vorname}</div>
        <div><b>Nachname:</b> {user.nachname}</div>
        <div><b>Rolle:</b> {user.rolle}</div>
        <div><b>Status:</b> Eingeloggt ✅</div>
      </div>
    </div>
  );
}

function NewMeldung(){
  return (
    <div className="max-w-lg mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200">
      <h2 className="text-lg font-bold mb-2">Neue Meldung</h2>
      <p className="text-sm text-gray-600">Formular folgt…</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
