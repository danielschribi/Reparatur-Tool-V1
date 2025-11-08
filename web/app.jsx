// web/app.jsx – React über UMD + Babel
const { useState, useEffect, useMemo } = React;

function App() {
  const [session, setSession] = useState(null); // { iduser, role, token }
  const [view, setView] = useState('home'); // home | login | changePassword | user | meldung
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const dateStr = now.toLocaleDateString('de-CH');

  function handleLoginResult(r) {
    if (r.needChange) {
      setSession({ iduser: r.iduser, role: r.role || 'user', token: null });
      setView('changePassword');
    } else {
      setSession({
        iduser: r.iduser,
        role: r.role || 'user',
        token: r.token || null
      });
      setView('user');
    }
  }

  function handleLogout() {
    setSession(null);
    setView('home');
  }

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 text-gray-800">
      <Header
        timeStr={timeStr}
        dateStr={dateStr}
        onHome={() => setView('home')}
        onUser={() => (session ? setView('user') : setView('login'))}
        onNewMeldung={() =>
          session ? setView('meldung') : setView('login')
        }
        session={session}
      />

      <main className="flex-1 p-4">
        {view === 'home' && <StartScreen />}

        {view === 'login' && (
          <LoginForm
            onLoginResult={handleLoginResult}
          />
        )}

        {view === 'changePassword' && session && (
          <ChangePasswordForm
            session={session}
            onDone={() => setView('user')}
            onCancel={handleLogout}
          />
        )}

        {view === 'user' && session && (
          <UserForm
            session={session}
            onLogout={handleLogout}
          />
        )}

        {view === 'meldung' && session && <NewMeldung />}

        {!session && (view === 'user' || view === 'meldung') && (
          <div className="text-center text-sm text-red-600">
            Bitte zuerst anmelden.
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- Header / Menü ----------
function Header({ timeStr, dateStr, onHome, onUser, onNewMeldung, session }) {
  return (
    <div className="relative h-16 bg-yellow-300 shadow flex items-center px-3">
      {/* Avatar links – gelbes ? */}
      <Avatar />

      {/* Mitte: Uhr + Datum */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center leading-tight">
        <div className="text-3xl font-extrabold">{timeStr}</div>
        <div className="text-sm">{dateStr}</div>
      </div>

      {/* Rechts: Buttons */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onNewMeldung}
          className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow"
        >
          Neue Meldung
        </button>
        <button
          onClick={onUser}
          className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow"
        >
          User
        </button>
        <button
          onClick={onHome}
          className="w-9 h-9 rounded-full bg-yellow-200 hover:bg-yellow-400 flex items-center justify-center shadow text-lg"
        >
          ⌂
        </button>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div
      className="w-9 h-9 rounded-full bg-yellow-400 text-black font-extrabold flex items-center justify-center shadow mr-2 select-none"
      title="Avatar"
    >
      ?
    </div>
  );
}

// ---------- Start-Screen: Platzhalter-Tabelle ----------
function StartScreen() {
  const rows = useMemo(() => Array.from({ length: 15 }), []);
  const cols = useMemo(() => Array.from({ length: 6 }), []);

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="overflow-auto border border-gray-300 rounded-lg shadow-sm">
        <table className="min-w-full text-[10px]">
          <tbody>
            {rows.map((_, i) => (
              <tr key={i}>
                {cols.map((_, j) => (
                  <td
                    key={j}
                    className="h-6 border border-yellow-200 bg-yellow-50"
                  >
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

// ---------- Login ----------
function LoginForm({ onLoginResult }) {
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
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Login fehlgeschlagen');
      }
      onLoginResult(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-10 bg-white rounded-2xl shadow p-6 border border-gray-200"
    >
      <h2 className="text-xl font-bold text-center mb-4">Anmeldung</h2>
      <label className="block mb-1 text-sm">Benutzername oder E-Mail</label>
      <input
        className="w-full border rounded px-3 py-2 mb-3"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
      />
      <label className="block mb-1 text-sm">Passwort / Code</label>
      <input
        type="password"
        className="w-full border rounded px-3 py-2 mb-3"
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

// ---------- Passwort ändern ----------
function ChangePasswordForm({ session, onDone, onCancel }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (newPw1 !== newPw2) {
      setError('Neue Passwörter stimmen nicht überein.');
      return;
    }
    if (newPw1.length < 6) {
      setError('Neues Passwort ist zu kurz (min. 6 Zeichen).');
      return;
    }
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iduser: session.iduser,
          oldPw,
          newPw: newPw1
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Passwort konnte nicht geändert werden');
      }
      setInfo('Passwort erfolgreich geändert. Du wirst zum Benutzerprofil weitergeleitet.');
      setTimeout(onDone, 1000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-10 bg-white rounded-2xl shadow p-6 border border-gray-200"
    >
      <h2 className="text-xl font-bold text-center mb-4">Passwort ändern</h2>
      <p className="text-sm text-gray-600 mb-4">
        Du hast dich mit einem Start-Code angemeldet. Bitte lege jetzt ein eigenes Passwort fest.
      </p>

      <label className="block mb-1 text-sm">Alter Code / Passwort</label>
      <input
        type="password"
        className="w-full border rounded px-3 py-2 mb-3"
        value={oldPw}
        onChange={(e) => setOldPw(e.target.value)}
        required
      />

      <label className="block mb-1 text-sm">Neues Passwort</label>
      <input
        type="password"
        className="w-full border rounded px-3 py-2 mb-3"
        value={newPw1}
        onChange={(e) => setNewPw1(e.target.value)}
        required
      />

      <label className="block mb-1 text-sm">Neues Passwort (Wiederholung)</label>
      <input
        type="password"
        className="w-full border rounded px-3 py-2 mb-3"
        value={newPw2}
        onChange={(e) => setNewPw2(e.target.value)}
        required
      />

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      {info && <div className="text-green-700 text-sm mb-3">{info}</div>}

      <div className="flex gap-2 mt-2">
        <button
          type="submit"
          className="flex-1 bg-yellow-300 hover:bg-yellow-400 rounded py-2 font-semibold shadow"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 hover:bg-gray-300 rounded py-2 text-sm"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// ---------- User-Form (Profil) ----------
function UserForm({ session, onLogout }) {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('Lade Daten…');
      setError('');
      try {
        const res = await fetch('/api/user/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ iduser: session.iduser })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Fehler beim Laden');
        }
        if (!cancelled) {
          setForm(data.user);
          setStatus('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setStatus('');
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [session.iduser]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setStatus('Speichere…');
    setError('');
    try {
      const res = await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iduser: session.iduser, data: form })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Fehler beim Speichern');
      }
      setForm(data.user);
      setStatus('Gespeichert.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e) {
      setError(e.message);
      setStatus('');
    }
  }

  if (!form) {
    return (
      <div className="max-w-lg mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200">
        {error ? (
          <div className="text-red-600 text-sm">{error}</div>
        ) : (
          <div className="text-sm text-gray-600">{status || 'Lade Daten…'}</div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200">
      <h2 className="text-lg font-bold mb-4">Benutzerprofil</h2>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <LabeledInput
          label="Vorname"
          value={form.vorname || ''}
          onChange={(v) => updateField('vorname', v)}
        />
        <LabeledInput
          label="Nachname"
          value={form.nachname || ''}
          onChange={(v) => updateField('nachname', v)}
        />
        <LabeledInput
          label="Benutzername"
          value={form.benutzer || ''}
          onChange={(v) => updateField('benutzer', v)}
        />
        <LabeledInput
          label="E-Mail"
          value={form.email || ''}
          onChange={(v) => updateField('email', v)}
        />
        <LabeledInput
          label="Handy"
          value={form.handy || ''}
          onChange={(v) => updateField('handy', v)}
        />
        <LabeledInput
          label="PLZ"
          value={form.plz || ''}
          onChange={(v) => updateField('plz', v)}
        />
        <LabeledInput
          label="Ort"
          value={form.ort || ''}
          onChange={(v) => updateField('ort', v)}
        />
        <LabeledInput
          label="Strasse"
          value={form.strasse || ''}
          onChange={(v) => updateField('strasse', v)}
        />
        <LabeledInput
          label="Beruf"
          value={form.beruf || ''}
          onChange={(v) => updateField('beruf', v)}
        />
        <LabeledInput
          label="Arbeitsort"
          value={form.arbeitsort || ''}
          onChange={(v) => updateField('arbeitsort', v)}
        />
        <LabeledInput
          label="Funktion"
          value={form.funktion || ''}
          onChange={(v) => updateField('funktion', v)}
        />
        <div className="flex flex-col justify-center text-xs text-gray-600">
          <div>
            <b>ID:</b> {form.iduser}
          </div>
          <div>
            <b>Rolle:</b> {form.rolle}
          </div>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
      {status && !error && (
        <div className="text-green-700 text-sm mt-3">{status}</div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          className="flex-1 bg-yellow-300 hover:bg-yellow-400 rounded py-2 font-semibold shadow"
        >
          Speichern
        </button>
        <button
          onClick={onLogout}
          className="flex-1 bg-gray-200 hover:bg-gray-300 rounded py-2 text-sm"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block mb-1 text-xs text-gray-700">{label}</label>
      <input
        className="w-full border rounded px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ---------- Neue Meldung (Platzhalter) ----------
function NewMeldung() {
  return (
    <div className="max-w-lg mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200">
      <h2 className="text-lg font-bold mb-2">Neue Meldung</h2>
      <p className="text-sm text-gray-600">
        Hier wird später das Formular für Störungsmeldungen eingebaut.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
