// server/index.js
// Reparatur-Tool – Server (Userverwaltung, OAuth, Drive/Sheets-Check)

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

const { login, changePassword, registerUser } = require('./logic.user');
const { sendWelcomeEmail } = require('./mailer');
const { htmlToJpeg } = require('./imagegen');
const { checkAccess } = require('./ownerCheck');
const { readAllUsers, updateUserById } = require('./sheets');

const app = express();

// ---------- Middleware & Static ----------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, '..', 'web')));

// ---------- (optional) JWT-Middleware ----------
function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// ---------- OWNER OAUTH: neuen Token holen ----------

function createOAuthClientForConnect() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI // z.B. https://reparatur-tool-v1.onrender.com/owner/callback
  );
}

// Startet Google Login
app.get('/owner/connect', (req, res) => {
  const client = createOAuthClientForConnect();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.send'
    ]
  });
  res.redirect(url);
});

// Google ruft diese URL nach Login auf
app.get('/owner/callback', async (req, res) => {
  try {
    const client = createOAuthClientForConnect();
    const { code } = req.query;
    const { tokens } = await client.getToken(code);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      `<h1>Tokens</h1><pre>${JSON.stringify(tokens, null, 2)}</pre>
       <p>Kopiere den gesamten JSON-Text in Render als <b>OWNER_OAUTH_TOKENS</b> (ohne zusätzliche Anführungszeichen).</p>`
    );
  } catch (e) {
    res.status(500).send('Fehler beim Callback: ' + e.message);
  }
});

// ---------- API: Login ----------
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ error: 'Benutzername und Passwort erforderlich' });
    }
    const out = await login(identifier, password);
    // out ist entweder { needChange, iduser, role, initials } oder { token, role, iduser, initials }
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Login fehlgeschlagen' });
  }
});

// ---------- API: Passwort ändern ----------
app.post('/api/change-password', async (req, res) => {
  try {
    const { iduser, oldPw, newPw } = req.body || {};
    if (!iduser || !oldPw || !newPw) {
      return res.status(400).json({ error: 'Felder unvollständig' });
    }
    const out = await changePassword(iduser, oldPw, newPw);
    res.json(out);
  } catch (e) {
    res
      .status(400)
      .json({ error: e.message || 'Fehler beim Passwortwechsel' });
  }
});

// ---------- API: User-Daten holen ----------
app.post('/api/user/get', async (req, res) => {
  try {
    const { iduser } = req.body || {};
    if (!iduser) return res.status(400).json({ error: 'iduser erforderlich' });

    const users = await readAllUsers();
    const u = users.find((x) => x.iduser === iduser);
    if (!u) return res.status(404).json({ error: 'User nicht gefunden' });

    const { passwort, ...safe } = u;
    res.json({ user: safe });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Fehler beim Laden des Users' });
  }
});

// ---------- API: User-Daten speichern ----------
app.post('/api/user/save', async (req, res) => {
  try {
    const { iduser, data } = req.body || {};
    if (!iduser || !data) {
      return res.status(400).json({ error: 'iduser und data erforderlich' });
    }

    const allowed = [
      'vorname',
      'nachname',
      'strasse',
      'plz',
      'ort',
      'email',
      'handy',
      'benutzer',
      'beruf',
      'arbeitsort',
      'funktion'
    ];

    const partial = {};
    allowed.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        partial[k] = data[k];
      }
    });

    const updated = await updateUserById(iduser, partial);
    const { passwort, ...safe } = updated;
    res.json({ user: safe });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || 'Fehler beim Speichern des Users' });
  }
});

// ---------- API: Admin – alle User lesen ----------
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await readAllUsers();
    const safe = users.map((u) => {
      const { passwort, ...rest } = u;
      return rest;
    });
    res.json({ users: safe });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || 'Fehler beim Laden der Userliste' });
  }
});

// ---------- API: Admin – User speichern ----------
app.post('/api/admin/user/save', async (req, res) => {
  try {
    const { iduser, data } = req.body || {};
    if (!iduser || !data) {
      return res.status(400).json({ error: 'iduser und data erforderlich' });
    }

    // Felder, die Admin bearbeiten darf (inkl. rolle)
    const allowed = [
      'vorname',
      'nachname',
      'benutzer',
      'email',
      'rolle',
      'ort',
      'funktion'
    ];
    const partial = {};
    allowed.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        partial[k] = data[k];
      }
    });

    const updated = await updateUserById(iduser, partial);
    const { passwort, ...safe } = updated;
    res.json({ user: safe });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || 'Fehler beim Speichern des Users' });
  }
});

// ---------- API: Registrierung ----------
app.post('/api/register', async (req, res) => {
  try {
    const payload = req.body || {};

    // 1) User in Sheets anlegen
    const result = await registerUser(payload); // { iduser, code }

    // 2) HTML -> JPEG (Maske)
    const html = renderWelcomeHTML(payload, result.iduser, result.code);
    const jpeg = await htmlToJpeg({ html });
    const attach = [
      {
        filename: `Anmeldung-${result.iduser}.jpg`,
        mimeType: 'image/jpeg',
        data: jpeg.toString('base64')
      }
    ];

    // 3) E-Mail an dich
    const subject = `${payload.vorname} ${payload.nachname} – Herzlich Willkommen dein Code ist ${result.code}`;
    await sendWelcomeEmail({
      to: 'daniel.schreiber@hispeed.ch',
      subject,
      html: `<p>Neue Anmeldung ${result.iduser}</p>`,
      attachments: attach
    });

    res.json({ ok: true, iduser: result.iduser });
  } catch (e) {
    res
      .status(400)
      .json({ error: e.message || 'Fehler bei der Registrierung' });
  }
});

// ---------- HEALTH ----------
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// ---------- OWNER: Drive/Sheets-Zugriff prüfen ----------
app.get('/owner/check-access', async (req, res) => {
  try {
    const result = await checkAccess();
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- Startseite (kleines Menü) ----------
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`
    <h1>Reparatur-Tool</h1>
    <ul>
      <li><a href="/owner/connect">Owner verbinden</a></li>
      <li><a href="/owner/check-access">Drive/Sheets prüfen</a></li>
      <li><a href="/health">Health Check</a></li>
    </ul>
  `);
});

// ---------- Helper: HTML für das Registrations-JPG ----------
function renderWelcomeHTML(u, iduser, code) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{font-family:Arial,Helvetica,sans-serif;padding:24px}
  h1{margin:0 0 8px 0}
  table{border-collapse:collapse;width:100%}
  td{border:1px solid #ddd;padding:6px;font-size:14px}
  .code{font-size:24px;font-weight:bold;color:#222}
</style></head><body>
  <h1>Neue Anmeldung</h1>
  <p><b>ID:</b> ${iduser}</p>
  <table>
    <tr><td>Vorname</td><td>${escapeHtml(u.vorname)}</td></tr>
    <tr><td>Nachname</td><td>${escapeHtml(u.nachname)}</td></tr>
    <tr><td>Benutzername</td><td>${escapeHtml(u.benutzer)}</td></tr>
    <tr><td>Strasse</td><td>${escapeHtml(u.strasse)}</td></tr>
    <tr><td>PLZ</td><td>${escapeHtml(u.plz)}</td></tr>
    <tr><td>Ort</td><td>${escapeHtml(u.ort)}</td></tr>
    <tr><td>E-Mail</td><td>${escapeHtml(u.email)}</td></tr>
    <tr><td>Handy</td><td>${escapeHtml(u.handy)}</td></tr>
    <tr><td>Beruf</td><td>${escapeHtml(u.beruf)}</td></tr>
    <tr><td>Arbeitsort</td><td>${escapeHtml(u.arbeitsort)}</td></tr>
    <tr><td>Funktion</td><td>${escapeHtml(u.funktion)}</td></tr>
    <tr><td>Start-Rolle</td><td>user</td></tr>
  </table>
  <p class="code">Willkommens-Code: ${escapeHtml(code)}</p>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- SERVER START ----------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('✅ Server running on :' + port);
});
