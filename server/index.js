// server/index.js
// Express-Server für Reparatur-Tool: Userverwaltung + Menü + Registrations-Flow

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');

const { login, changePassword, registerUser } = require('./logic.user');
const { sendWelcomeEmail } = require('./mailer');
const { htmlToJpeg } = require('./imagegen');

const app = express(); // <-- WICHTIG: app anlegen, bevor Routen definiert werden!

// --- Middleware / Static ---
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, '..', 'web')));

// --- (Optional) JWT-Auth-Middleware für geschützte Routen ---
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

// --- SESSION / LOGIN ---
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) return res.status(400).json({ error: 'identifier_and_password_required' });
    const out = await login(identifier, password);
    return res.json(out);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'login_failed' });
  }
});

app.post('/api/change-password', async (req, res) => {
  try {
    const { iduser, oldPw, newPw } = req.body || {};
    if (!iduser || !oldPw || !newPw) return res.status(400).json({ error: 'missing_fields' });
    const out = await changePassword(iduser, oldPw, newPw);
    return res.json(out);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'change_password_failed' });
  }
});

// --- REGISTRATION: Formular absenden -> User-Zeile + E-Mail mit JPG ---
app.post('/api/register', async (req, res) => {
  try {
    const payload = req.body || {};
    // 1) In Sheets speichern, Code generieren (Klartext), ID vergeben
    const result = await registerUser(payload); // -> { iduser, code }

    // 2) HTML -> JPEG erzeugen (Puppeteer)
    const html = renderWelcomeHTML(payload, result.iduser, result.code);
    const jpeg = await htmlToJpeg({ html });

    // 3) Per Gmail senden (An: Owner)
    const attach = [{
      filename: `Anmeldung-${result.iduser}.jpg`,
      mimeType: 'image/jpeg',
      data: jpeg.toString('base64')
    }];

    const subject = `${payload.vorname} ${payload.nachname} – Herzlich Willkommen dein Code ist ${result.code}`;
    await sendWelcomeEmail({
      to: 'daniel.schreiber@hispeed.ch',
      subject,
      html: `<p>Neue Anmeldung ${result.iduser}</p>`,
      attachments: attach
    });

    return res.json({ ok: true, iduser: result.iduser });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'registration_failed' });
  }
});

// --- HEALTH ---
app.get('/health', (req, res) => res.json({ ok: true }));

// --- Helper: HTML für JPG-Export ---
function renderWelcomeHTML(u, iduser, code) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{font-family:Arial,Helvetica,sans-serif;padding:24px}
  h1{margin:0 0 8px 0}
  table{border-collapse:collapse;width:100%}
  td{border:1px solid #ddd;padding:6px;font-size:14px}
  .code{font-size:24px;font-weight:bold}
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

// --- Start Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on :' + port));
