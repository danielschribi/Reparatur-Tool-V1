// web/app.jsx – React über UMD + Babel
const { useState, useEffect, useMemo } = React;

function App() {
  const [session, setSession] = useState(null); // { iduser, role, token, initials }
  const [view, setView] = useState('home'); // home | login | changePassword | user | userdb | roles | register | meldung
  const [now, setNow] = useState(new Date());
  const [loginKey, setLoginKey] = useState(0); // sorgt für leeres Login-Form

  // für Abbrechen im Login: ursprüngliche Session & View merken
  const [sessionBeforeLogin, setSessionBeforeLogin] = useState(null);
  const [viewBeforeLogin, setViewBeforeLogin] = useState('home');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const dateStr = now.toLocaleDateString('de-CH');

  function openLoginBlank() {
    // aktuellen Zustand merken, User vorübergehend ausloggen
    setSessionBeforeLogin(session);
    setViewBeforeLogin(view);
    setSession(null);
    setView('login');
    setLoginKey((k) => k + 1); // sorgt dafür, dass Felder immer leer sind
  }

  function handleLoginResult(r) {
    const initials = (r.initials || '').toUpperCase();

    if (r.needChange) {
      // 4-stelliger Code → Zwang Passwort ändern
      setSession({
        iduser: r.iduser,
        role: r.role || 'user',
        token: null,
        initials
      });
      setView('changePassword');
    } else {
      // normales Login mit Passwort
      setSession({
        iduser: r.iduser,
        role: r.role || 'user',
        token: r.token || null,
        initials
      });
      setView('user');
    }

    // Login abgeschlossen → Zwischenspeicher zurücksetzen
    setSessionBeforeLogin(null);
    setViewBeforeLogin('home');
  }

  function handleAvatarClick() {
    // egal ob eingeloggt oder nicht → Loginfenster mit leeren Feldern
    // Abbrechen stellt ggf. ursprüngliche Session wieder her
    openLoginBlank();
  }

  function handleLogoutToHome() {
    setSession(null);
    setView('home');
  }

  function handleLoginFailed() {
    // ungültige Daten → Login schliessen, kein User angemeldet
    setSessionBeforeLogin(null);
    setSession(null);
    setView('home');
  }

  function handleLoginCancel() {
    // Abbrechen: ursprüngliche Session (falls vorhanden) wiederherstellen
    if (sessionBeforeLogin) {
      setSession(sessionBeforeLogin);
      setView(viewBeforeLogin || 'home');
    } else {
      setSession(null);
      setView('home');
    }
    setSessionBeforeLogin(null);
    setViewBeforeLogin('home');
  }

  function openRegister() {
    // User-Erfassungsmaske
    setSession(null);
    setView('register');
  }

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 text-gray-800">
      <Header
        timeStr={timeStr}
        dateStr={dateStr}
        onHome={() => setView('home')}
        onNewMeldung={() =>
          session ? setView('meldung') : openLoginBlank()
        }
        session={session}
        onAvatarClick={handleAvatarClick}
        onAdminUsers={() =>
          session && session.role === 'admin'
            ? setView('userdb')
            : openLoginBlank()
        }
        onAdminRoles={() =>
          session && session.role === 'admin'
            ? setView('roles')
            : openLoginBlank()
        }
        onRegister={openRegister}
      />

      <main className="flex-1 p-4">
        {view === 'home' && <StartScreen />}

        {view === 'login' && (
          <LoginForm
            key={loginKey}
            onLoginResult={handleLoginResult}
            onLoginFailed={handleLoginFailed}
            onCancel={handleLoginCancel}
          />
        )}

        {view === 'changePassword' && session && (
          <ChangePasswordForm
            session={session}
            onDone={() => setView('user')}
            onCancel={handleLogoutToHome}
          />
        )}

        {view === 'user' && session && (
          <UserForm
            session={session}
            onLogout={handleLogoutToHome}
          />
        )}

        {view === 'userdb' && session && session.role === 'admin' && (
          <AdminUserDb />
        )}

        {view === 'roles' && session && session.role === 'admin' && (
          <AdminRoles />
        )}

        {view === 'register' && <RegisterForm onDone={() => setView('home')} />}

        {view === 'meldung' && session && <NewMeldung />}

        {!session &&
          (view === 'user' ||
            view === 'userdb' ||
            view === 'roles' ||
            view === 'meldung') && (
            <div className="text-center text-sm text-red-600">
              Bitte zuerst anmelden.
            </div>
          )}
      </main>
    </div>
  );
}

// ---------- Header / Menü ----------
function Header({
  timeStr,
  dateStr,
  onHome,
  onNewMeldung,
  session,
  onAvatarClick,
  onAdminUsers,
  onAdminRoles,
  onRegister
}) {
  const isAdmin = !!session && session.role === 'admin';

  return (
    <div className="relative h-16 bg-yellow-300 shadow flex items-center px-3">
      {/* Links: Avatar + Menüs */}
      <div className="flex items-center gap-2">
        <Avatar session={session} onClick={onAvatarClick} />
        {isAdmin ? (
          <>
            <button
              onClick={onAdminUsers}
              className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow text-sm"
            >
              User
            </button>
            <button
              onClick={onAdminRoles}
              className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow text-sm"
            >
              Rolle
            </button>
          </>
        ) : (
          // ausgeloggt → "Ich will mitmachen"
          !session && (
            <button
              onClick={onRegister}
              className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow text-sm"
            >
              Ich will mitmachen
            </button>
          )
        )}
      </div>

      {/* Mitte: Uhr + Datum */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center leading-tight">
        <div className="text-3xl font-extrabold">{timeStr}</div>
        <div className="text-sm">{dateStr}</div>
      </div>

      {/* Rechts: Neue Meldung + Home */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onNewMeldung}
          className="px-3 py-1 bg-yellow-200 hover:bg-yellow-400 rounded-2xl shadow text-sm"
        >
          Neue Meldung
        </button>
        <button
          onClick={onHome}
          className="w-9 h-9 rounded-full bg-yellow-200 hover:bg-yellow-400 flex items-center justify-center shadow text-xl"
          title="Home"
        >
          🏠
        </button>
      </div>
    </div>
  );
}

// ---------- Avatar ----------
function Avatar({ session, onClick }) {
  const loggedIn = !!session;
  const initials = (session && session.initials) || '';

  const base =
    'w-9 h-9 rounded-full flex items-center justify-center shadow mr-2 select-none cursor-pointer';

  let classes, content, title;
  if (loggedIn) {
    // angemeldet → grüner Punkt mit weissen Initialen
    classes = base + ' bg-green-500 text-white font-bold';
    content = initials || '??';
    title = `Eingeloggt${initials ? ' (' + initials + ')' : ''} – Klick um neu anzumelden`;
  } else {
    // nicht angemeldet → roter, blinkender Punkt mit gelbem ?
    classes =
      base + ' bg-red-500 text-yellow-300 font-extrabold blink-avatar';
    content = '?';
    title = 'Nicht eingeloggt – Klick zum Anmelden';
  }

  return (
    <div className={classes} onClick={onClick} title={title}>
      {content}
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
function LoginForm({ onLoginResult, onLoginFailed, onCancel }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        onLoginFailed && onLoginFailed();
        return;
      }
      onLoginResult(data);
    } catch {
      onLoginFailed && onLoginFailed();
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

      <div className="flex gap-2 mt-2">
        <button
          type="submit"
          className="flex-1 bg-yellow-300 hover:bg-yellow-400 rounded py-2 font-semibold shadow"
        >
          Login
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
      setInfo(
        'Passwort erfolgreich geändert. Du wirst zum Benutzerprofil weitergeleitet.'
      );
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

// ---------- User-Form (Profil – eigener User) ----------
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
          <div className="text-sm text-gray-600">
            {status || 'Lade Daten…'}
          </div>
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

// ---------- Admin-User-Datenbank (inkl. Passwort) ----------
function AdminUserDb() {
  const [users, setUsers] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('Lade Benutzer…');
      setError('');
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Fehler beim Laden');
        }
        if (!cancelled) {
          setUsers(data.users);
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
  }, []);

  function updateField(iduser, field, value) {
    setUsers((prev) =>
      prev.map((u) => (u.iduser === iduser ? { ...u, [field]: value } : u))
    );
  }

  async function handleSaveRow(u) {
    setStatus('Speichere ' + u.iduser + ' …');
    setError('');
    try {
      const res = await fetch('/api/admin/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iduser: u.iduser, data: u })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Fehler beim Speichern');
      }
      setStatus('Gespeichert.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e) {
      setError(e.message);
      setStatus('');
    }
  }

  if (!users) {
    return (
      <div className="max-w-5xl mx-auto mt-6 bg-white rounded-xl shadow p-4 border border-gray-200 text-sm">
        {error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="text-gray-600">{status || 'Lade Benutzer…'}</div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-6 bg-white rounded-xl shadow p-4 border border-gray-200 text-xs">
      <h2 className="text-lg font-bold mb-3">Userdatenbank (Admin)</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {status && !error && (
        <div className="text-green-700 mb-2">{status}</div>
      )}

      <div className="overflow-auto max-h-[420px] border border-gray-200 rounded">
        <table className="min-w-full border-collapse">
          <thead className="bg-yellow-100">
            <tr>
              <Th>ID</Th>
              <Th>Vorname</Th>
              <Th>Nachname</Th>
              <Th>Benutzer</Th>
              <Th>E-Mail</Th>
              <Th>Passwort</Th>
              <Th>Rolle</Th>
              <Th>Ort</Th>
              <Th>Funktion</Th>
              <Th>Aktion</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.iduser} className="odd:bg-yellow-50 even:bg-white">
                <Td>{u.iduser}</Td>
                <TdInput
                  value={u.vorname || ''}
                  onChange={(v) => updateField(u.iduser, 'vorname', v)}
                />
                <TdInput
                  value={u.nachname || ''}
                  onChange={(v) => updateField(u.iduser, 'nachname', v)}
                />
                <TdInput
                  value={u.benutzer || ''}
                  onChange={(v) => updateField(u.iduser, 'benutzer', v)}
                />
                <TdInput
                  value={u.email || ''}
                  onChange={(v) => updateField(u.iduser, 'email', v)}
                />
                <TdInput
                  value={u.passwort || ''}
                  onChange={(v) => updateField(u.iduser, 'passwort', v)}
                />
                <TdInput
                  value={u.rolle || ''}
                  onChange={(v) => updateField(u.iduser, 'rolle', v)}
                />
                <TdInput
                  value={u.ort || ''}
                  onChange={(v) => updateField(u.iduser, 'ort', v)}
                />
                <TdInput
                  value={u.funktion || ''}
                  onChange={(v) => updateField(u.iduser, 'funktion', v)}
                />
                <Td>
                  <button
                    onClick={() => handleSaveRow(u)}
                    className="px-2 py-1 bg-yellow-300 hover:bg-yellow-400 rounded shadow"
                  >
                    Speichern
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Admin: Rollen-Ansicht ----------
function AdminRoles() {
  const [users, setUsers] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('Lade Rollen…'),
      setError('');
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Fehler beim Laden');
        }
        if (!cancelled) {
          setUsers(data.users);
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
  }, []);

  function updateRole(iduser, value) {
    setUsers((prev) =>
      prev.map((u) => (u.iduser === iduser ? { ...u, rolle: value } : u))
    );
  }

  async function handleSaveUser(u) {
    setStatus('Speichere Rolle für ' + u.iduser + ' …');
    setError('');
    try {
      const res = await fetch('/api/admin/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iduser: u.iduser,
          data: { rolle: u.rolle }
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Fehler beim Speichern');
      }
      setStatus('Gespeichert.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e) {
      setError(e.message);
      setStatus('');
    }
  }

  if (!users) {
    return (
      <div className="max-w-3xl mx-auto mt-6 bg-white rounded-xl shadow p-4 border border-gray-200 text-sm">
        {error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="text-gray-600">{status || 'Lade Rollen…'}</div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-6 bg-white rounded-xl shadow p-4 border border-gray-200 text-xs">
      <h2 className="text-lg font-bold mb-3">Rollen (Admin)</h2>
      <p className="text-[11px] text-gray-600 mb-2">
        Rollen können hier pro Benutzer bearbeitet werden. Neue Rollen einfach als Text eintragen – sie stehen dann im System zur Verfügung.
      </p>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {status && !error && (
        <div className="text-green-700 mb-2">{status}</div>
      )}

      <div className="overflow-auto max-h-[420px] border border-gray-200 rounded">
        <table className="min-w-full border-collapse">
          <thead className="bg-yellow-100">
            <tr>
              <Th>ID</Th>
              <Th>Benutzer</Th>
              <Th>Vorname</Th>
              <Th>Nachname</Th>
              <Th>Rolle</Th>
              <Th>Aktion</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.iduser} className="odd:bg-yellow-50 even:bg-white">
                <Td>{u.iduser}</Td>
                <Td>{u.benutzer}</Td>
                <Td>{u.vorname}</Td>
                <Td>{u.nachname}</Td>
                <TdInput
                  value={u.rolle || ''}
                  onChange={(v) => updateRole(u.iduser, v)}
                />
                <Td>
                  <button
                    onClick={() => handleSaveUser(u)}
                    className="px-2 py-1 bg-yellow-300 hover:bg-yellow-400 rounded shadow"
                  >
                    Speichern
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Register-Form: „Ich will mitmachen“ ----------
function RegisterForm({ onDone }) {
  const [form, setForm] = useState({
    vorname: '',
    nachname: '',
    benutzer: '',
    email: '',
    handy: '',
    strasse: '',
    plz: '',
    ort: '',
    beruf: '',
    arbeitsort: '',
    funktion: ''
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const [fieldState, setFieldState] = useState({});
  const [usernameError, setUsernameError] = useState('');
  const [idUser, setIdUser] = useState('');

  const requiredFields = [
    'vorname',
    'nachname',
    'benutzer',
    'email',
    'handy',
    'strasse',
    'plz',
    'ort'
  ];

  const canSubmit = requiredFields.every(
    (f) => (form[f] || '').trim().length > 0
  );

  function validateField(field, value) {
    const v = (value || '').trim();
    if (!v) return false;
    switch (field) {
      case 'email':
        return v.includes('@');
      case 'plz':
        return /^\d{4}$/.test(v);
      default:
        return v.length > 1;
    }
  }

  function inputClass(field) {
    const base = 'w-full border rounded px-2 py-1 text-sm ';
    const st = fieldState[field];
    if (!st || st === 'invalid') {
      return base + 'bg-orange-100';
    }
    return base + 'bg-green-100';
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    const valid = validateField(field, value);
    setFieldState((prev) => ({
      ...prev,
      [field]: valid ? 'valid' : 'invalid'
    }));
  }

  async function handleBenutzerBlur() {
    const name = (form.benutzer || '').trim();
    if (!name) return;
    try {
      const res = await fetch('/api/user/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benutzer: name })
      });
      if (!res.ok) return; // Endpoint evtl. noch nicht vorhanden → stiller Rückfall
      const data = await res.json();
      if (data && data.exists) {
        setUsernameError('Benutzername ist bereits vergeben.');
        setForm((prev) => ({ ...prev, benutzer: '' }));
        setFieldState((prev) => ({ ...prev, benutzer: 'invalid' }));
        setTimeout(() => setUsernameError(''), 2000);
      }
    } catch {
      // Fehler ignorieren, endgültige Prüfung erfolgt beim Absenden
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('Sende Daten…');
    setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Fehler bei der Anmeldung');
      }
      if (data.iduser) {
        setIdUser(data.iduser); // vom Backend generierte ID anzeigen
      }
      setSent(true);
      setStatus('');
    } catch (e) {
      setError(e.message);
      setStatus('');
    }
  }

  if (sent) {
    return (
      <div className="max-w-lg mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200 text-sm">
        <h2 className="text-lg font-bold mb-2">Vielen Dank!</h2>
        <p>
          Deine Daten wurden übermittelt. Die verantwortliche Person erhält eine
          E-Mail mit deinem Zugangscode.
        </p>
        {idUser && (
          <p className="mt-3">
            <b>Deine User-ID:</b> {idUser}
          </p>
        )}
        <div className="mt-4 text-right">
          <button
            onClick={onDone}
            className="px-4 py-2 rounded shadow font-semibold bg-yellow-300 hover:bg-yellow-400"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg mx-auto mt-6 bg-white rounded-xl shadow p-6 border border-gray-200 text-sm"
    >
      <h2 className="text-lg font-bold mb-4">User erfassen</h2>

      <div className="grid grid-cols-2 gap-3">
        {/* ID-User (sichtbar, nicht änderbar) */}
        <div>
          <label className="block mb-1 text-xs text-gray-700">ID-User</label>
          <input
            className="w-full border rounded px-2 py-1 text-xs bg-gray-100 text-gray-700"
            value={idUser ? idUser : 'wird automatisch vergeben'}
            disabled
          />
        </div>

        {/* Rolle = user, nicht änderbar */}
        <div>
          <label className="block mb-1 text-xs text-gray-700">Rolle</label>
          <input
            className="w-full border rounded px-2 py-1 text-xs bg-gray-100"
            value="user"
            disabled
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <label className="block mb-1 text-xs text-gray-700">Vorname</label>
          <input
            className={inputClass('vorname')}
            value={form.vorname}
            onChange={(e) => updateField('vorname', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">Nachname</label>
          <input
            className={inputClass('nachname')}
            value={form.nachname}
            onChange={(e) => updateField('nachname', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">Benutzername</label>
          <input
            className={inputClass('benutzer')}
            value={form.benutzer}
            onChange={(e) => updateField('benutzer', e.target.value)}
            onBlur={handleBenutzerBlur}
          />
          {usernameError && (
            <div className="text-red-600 text-[11px] mt-1">
              {usernameError}
            </div>
          )}
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">E-Mail</label>
          <input
            className={inputClass('email')}
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">Handy</label>
          <input
            className={inputClass('handy')}
            value={form.handy}
            onChange={(e) => updateField('handy', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">Strasse</label>
          <input
            className={inputClass('strasse')}
            value={form.strasse}
            onChange={(e) => updateField('strasse', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">PLZ</label>
          <input
            className={inputClass('plz')}
            value={form.plz}
            onChange={(e) => updateField('plz', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">Ort</label>
          <input
            className={inputClass('ort')}
            value={form.ort}
            onChange={(e) => updateField('ort', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">Beruf</label>
          <input
            className={inputClass('beruf')}
            value={form.beruf}
            onChange={(e) => updateField('beruf', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">Arbeitsort</label>
          <input
            className={inputClass('arbeitsort')}
            value={form.arbeitsort}
            onChange={(e) => updateField('arbeitsort', e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-700">Funktion</label>
          <input
            className={inputClass('funktion')}
            value={form.funktion}
            onChange={(e) => updateField('funktion', e.target.value)}
          />
        </div>
      </div>

      {error && <div className="text-red-600 text-xs mt-3">{error}</div>}
      {status && !error && (
        <div className="text-gray-700 text-xs mt-3">{status}</div>
      )}

      <div className="mt-4 text-right">
        <button
          type="submit"
          disabled={!canSubmit}
          className={
            'px-4 py-2 rounded shadow font-semibold ' +
            (canSubmit
              ? 'bg-yellow-300 hover:bg-yellow-400'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed')
          }
        >
          Absenden
        </button>
      </div>
    </form>
  );
}

// ---------- Tabellen-Helper ----------
function Th({ children }) {
  return (
    <th className="px-2 py-1 border border-gray-200 text-left font-semibold">
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td className="px-2 py-1 border border-gray-200 align-middle">
      {children}
    </td>
  );
}

function TdInput({ value, onChange }) {
  return (
    <td className="px-1 py-1 border border-gray-200">
      <input
        className="w-full border rounded px-1 py-[2px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
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
