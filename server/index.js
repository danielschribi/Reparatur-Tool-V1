// server/index.js
// Reparatur-Tool – Userverwaltung, Registrierung & Menü
// Läuft auf Render mit Google Drive/Sheets-Integration (OAuth-Owner)

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');

// interne Module
const { login, changePassword, registerUser } = require('./logic.user');
const { sendWelcomeEmail } = require('./mailer');
const { htmlToJpeg } = require('./imagegen');

// ⬇️ WICHTIG: Express-App muss hier definiert werden!
const app = express();

// Middleware & statische Dateien
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, '..', 'web')));

// --- JWT Auth Middleware (optional für geschützte Bereiche) ---
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

// ==========================================================
// 🧩 LOGIN
// ==========================================================
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }
    const out = await login(identifier, password);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Login fehlgeschlagen' });
  }
});

// ==========================================================
// 🔐 PASSWORT ÄNDERN
// ==========================================================
app.post('/api/change-password', async (req, res) => {
  try {
    const { iduser, oldPw, newPw } = req.body || {};
    if (!iduser || !oldPw || !newPw) {
      return res.status(400).json({ error: 'Felder unvollständig' });
    }
    const out = await changePassword(iduser, oldPw, newPw);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Fehler beim Passwortwechsel' });
  }
});

// ==========================================================
// 📝 REGISTRIERUNG
// ==========================================================
app.post('/api/register', async (req, res) => {
  try {
    const payload = req.body || {};

    // 1️⃣ User in Google Sheets anlegen
    const result = await registerUser(payload); // { iduser, code }

    // 2️⃣ HTML-Ansicht in JPEG konvertieren (Puppeteer)
    const html = renderWelcomeHTML(payload, result.iduser, result.code);
    const jpeg = await htmlToJpeg({ html });

    // 3️⃣ Per Gmail an den Owner senden
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

    res.json({ ok: true, iduser: result.iduser });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Fehler bei der Registrierung' });
  }
});

// ==========================================================
// ❤️ HEALTH-CHECK
// ==========================================================
app.get('/health', (req, res) => res.json({ ok: true }));

// ==========================================================
// 🧾 HTML-Vorlage für JPEG-Erzeugung
// ==========================================================
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

// ==========================================================
// 🚀 START SERVER
// ==========================================================
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('✅ Server running on :' + port));
