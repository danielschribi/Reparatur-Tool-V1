// server/index.js
// Reparatur-Tool – Server (Userverwaltung, OAuth, Drive/Sheets-Check)

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

const { login, changePassword, registerUser } = require('./logic.user');
const { sendWelcomeEmail } = require('./mailer');
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
    // out ist entweder { needChange, iduser, role, initials }
    // oder { token, role, iduser, initials }
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

// ---------- API: User-Daten holen (für eigenes Profil) ----------
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

// ---------- API: User-Daten speichern (eigenes Profil) ----------
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

// ---------- API: Admin – alle User lesen (inkl. Passwort & Rolle) ----------
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await readAllUsers();
    // Admin sieht auch das Passwort
    res.json({ users });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || 'Fehler beim Laden der Userliste' });
  }
});

// ---------- API: Admin – User speichern (inkl. Rolle & Passwort) ----------
app.post('/api/admin/user/save', async (req, res) => {
  try {
    const { iduser, data } = req.body || {};
    if (!iduser || !data) {
      return res.status(400).json({ error: 'iduser und data erforderlich' });
    }

    // Felder, die Admin bearbeiten darf (inkl. rolle & passwort)
    const allowed = [
      'vorname',
      'nachname',
      'benutzer',
      'email',
      'rolle',
      'ort',
      'funktion',
      'passwort'
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

// ---------- API: Registrierung (ohne JPG, mit Mail an alle Admins) ----------
app.post('/api/register', async (req, res) => {
  try {
    const payload = req.body || {};

    // 1) User in Sheets anlegen (ID & 4-stelliger Code / Passwort)
    const result = await registerUser(payload); // { iduser, code }

    // 2) Alle Admins aus der db-user lesen
    const users = await readAllUsers();
    const admins = users.filter(
      (u) =>
        (u.rolle || '').toString().toLowerCase() === 'admin' &&
        u.email &&
        String(u.email).includes('@')
    );

    // 3) Betreff & Mail-Text aufbauen
    const subject =
      `Ok du ${payload.vorname} ${payload.nachname} ` +
      `mit der Handynummer ${payload.handy} ` +
      `bist dabei als ${payload.benutzer} ` +
      `und dein erstes Passwort ist ${result.code} ` +
      `logge dich bitte ein und erstelle ein neues Passwort.`;

    const html = buildAdminRegistrationMailHtml(payload, result);

    // 4) Mail an alle Admins senden (oder Fallback an dich selbst)
    if (admins.length === 0) {
      await sendWelcomeEmail({
        to: 'daniel.schreiber@hispeed.ch',
        subject,
        html
      });
    } else {
      for (const admin of admins) {
        await sendWelcomeEmail({
          to: admin.email,
          subject,
          html
        });
      }
    }

    // 5) Antwort an Frontend
    res.json({ ok: true, iduser: result.iduser });
  } catch (e) {
    console.error('Fehler bei /api/register:', e);
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

// ---------- Helper: Mail-HTML für Admin-Benachrichtigung ----------
function buildAdminRegistrationMailHtml(u, result) {
  const rows = [
    ['ID-User', result.iduser],
    ['Vorname', u.vorname],
    ['Nachname', u.nachname],
    ['Benutzername', u.benutzer],
    ['E-Mail', u.email],
    ['Handy', u.handy],
    ['Strasse', u.strasse],
    ['PLZ', u.plz],
    ['Ort', u.ort],
    ['Beruf', u.beruf],
    ['Arbeitsort', u.arbeitsort],
    ['Funktion', u.funktion],
    ['Rolle', 'user'],
    ['Erstes Passwort', result.code]
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;"><b>${escapeHtml(
          label
        )}</b></td><td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(
          value
        )}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;">
    <p>Hallo Admin ich melde mich bei dir an zum mitmachen.</p>
    <p>Hier meine Angaben:</p>
    <table style="border-collapse:collapse;border:1px solid #ddd;">
      ${rowsHtml}
    </table>
    <p style="margin-top:16px;">
      mit freundlichen Grüssen<br/>
      der Anmeldebot ;-)
    </p>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- SERVER START ----------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('✅ Server running on :' + port);
});
