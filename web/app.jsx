// web/app.jsx
// Reparatur-Tool – Frontend mit Menü, Login, Userverwaltung & Platzhalter-Tabelle
// Läuft direkt im Browser mit React über UMD + Babel (kein Bundler nötig)

const { useState, useEffect, useMemo } = React;

// -----------------------------------------------------------
// 🧱 Komponenten
// -----------------------------------------------------------

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('de-CH');

  const handleLogout = () => setUser(null);

  // Render
  return (
    <div className="flex flex-col h-screen w-full bg-neutral-50 text-gray-800">
      <Header
        user={user}
        timeStr={timeStr}
        dateStr={dateStr}
        onChangeView={setView}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-auto p-4">
        {view === 'home' && <StartScreen />}
        {view === 'login' && <LoginForm onLogin={setUser} />}
        {view === 'user' && user && <UserMask user={user} />}
        {view === 'meldung' && user && <NewMeldung />}
        {view === 'db' && user?.rolle === 'admin' && <DbView />}
      </main>
    </div>
  );
}

// -----------------------------------------------------------
// 🧭 Header mit Menü
// -----------------------------------------------------------
function Header({ user, timeStr, dateStr, onChangeView, onLogout }) {
  return (
    <div className="flex items-center justify-between bg-yellow-300 px-4 py-2 shadow-md text-sm font-medium">
      <div className="flex items-center space-x-3">
        <Avatar user={user} onClick={() => onChangeView('login')} />
        <button
          onClick={() => onChangeView('user')}
          className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow"
        >
          User
        </button>
        <button
          onClick={() => onChangeView('meldung')}
          className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow"
        >
          Neue Meldung
        </button>
        {user?.rolle === 'admin' && (
          <button
            onClick={() => onChangeView('db')}
            className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow"
          >
            Datenbank
          </button>
        )}
      </div>

      <div className="flex items-center space-x-3">
        <div>{dateStr}</div>
        <div>{timeStr}</div>
        <button
          onClick={() => onChangeView('home')}
          className="bg-yellow-200 hover:bg-yellow-400 rounded-full w-8 h-8 flex items-center justify-center shadow text-lg"
        >
          ⌂
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// 🧍 Avatar
// -----------------------------------------------------------
function Avatar({ user, onClick }) {
  const color = user
    ? 'bg-green-500'
    : 'bg-red-500 animate-pulse';

  const label = user ? user.vorname[0]?.toUpperCase() : '!';

  return (
    <div
      onClick={onClick}
      className={`w-8 h-8 rounded-full text-white font-bold flex items-center justify-center cursor-pointer shadow ${color}`}
      title={user ? `${user.vorname} ${user.nachname}` : 'Nicht eingeloggt'}
    >
      {label}
    </div>
  );
}

// -----------------------------------------------------------
// 🏠 Startseite (Platzhalter-Tabelle)
// -----------------------------------------------------------
function StartScreen() {
  const rows = useMemo(() => Array.from({ length: 15 }, (_, i) => i + 1), []);
  const cols = useMemo(() => Array.from({ length: 6 }, (_, i) => i + 1), []);

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <h1 className="text-xl font-bold mb-3">Willkommen im Reparatur-Tool</h1>
      <div className="overflow-auto border border-gray-300 rounded-lg shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-yellow-100 text-gray-700">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-2 py-1 border-b border-gray-300">
                  Spalte {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className="odd:bg-yellow-50 even:bg-white">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1 border-b border-gray-200 text-center">
                    &nbsp;
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// 🔐 Login-Formular
// -----------------------------------------------------------
function LoginForm({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!data || data.error) throw new Error(data.error || 'Login fehlgeschlagen');
      onLogin(data.user || { vorname: 'Demo', nachname: 'User', rolle: 'user' });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-sm mx-auto mt-10 bg-white rounded-xl shadow p-6 border border-gray-200"
    >
      <h2 className="text-lg font-bold mb-3 text-center">Anmeldung</h2>
      <label className="block mb-2 text-sm">Benutzername oder E-Mail</label>
      <input
        className="w-full border rounded px-2 py-1 mb-3"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
      />
      <label className="block mb-2 text-sm">Passwort</label>
      <input
        type="password"
        className="w-full border rounded px-2 py-1 mb-3"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      <button
        type="submit"
        className="w-full bg-yellow-300 hover:bg-yellow-400 rounded py-2 font-semibold shadow"
      >
        Login
      </button>
    </form>
  );
}

// -----------------------------------------------------------
// 👤 User-Maske (Platzhalter)
// -----------------------------------------------------------
function UserMask({ user }) {
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

// -----------------------------------------------------------
// 📝 Neue Meldung (Platzhalter)
// -----------------------------------------------------------
function NewMeldung() {
  return (
    <div className="max-w-lg mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200">
      <h2 className="text-lg font-bold mb-4">Neue Meldung</h2>
      <p className="text-sm text-gray-600">Hier wird später das Formular für Störungsmeldungen eingebaut.</p>
    </div>
  );
}

// -----------------------------------------------------------
// 📊 Datenbankansicht (Admin-Platzhalter)
// -----------------------------------------------------------
function DbView() {
  return (
    <div className="max-w-3xl mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200">
      <h2 className="text-lg font-bold mb-4">Datenbankübersicht</h2>
      <p className="text-sm text-gray-600">Admin-Ansicht für db-user / db-meldung / db-massnahme (coming soon)</p>
    </div>
  );
}

// -----------------------------------------------------------
// 🚀 Render starten
// -----------------------------------------------------------
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
