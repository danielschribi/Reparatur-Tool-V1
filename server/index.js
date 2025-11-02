const express = require('express');


// --- SESSION ---
app.post('/api/login', async (req, res) => {
try {
const { identifier, password } = req.body;
const out = await login(identifier, password);
res.json(out);
} catch (e) { res.status(400).json({ error: e.message }); }
});


app.post('/api/change-password', async (req, res) => {
try {
const { iduser, oldPw, newPw } = req.body;
const out = await changePassword(iduser, oldPw, newPw);
res.json(out);
} catch (e) { res.status(400).json({ error: e.message }); }
});


// --- REGISTRATION FLOW (Avatar → Anmeldung) ---
app.post('/api/register', async (req, res) => {
try {
const result = await registerUser(req.body);
// JPG der Maske erzeugen
const html = renderWelcomeHTML(req.body, result.iduser, result.code);
const jpeg = await htmlToJpeg({ html });
const attach = [{ filename: `Anmeldung-${result.iduser}.jpg`, mimeType: 'image/jpeg', data: jpeg.toString('base64') }];
const subject = `${req.body.vorname} ${req.body.nachname} – Herzlich Willkommen dein Code ist ${result.code}`;
await sendWelcomeEmail({
to: 'daniel.schreiber@hispeed.ch',
subject,
html: `<p>Neue Anmeldung ${result.iduser}</p>`,
attachments: attach
});
res.json({ ok: true, iduser: result.iduser });
} catch (e) { res.status(400).json({ error: e.message }); }
});


function renderWelcomeHTML(u, iduser, code) {
return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,Helvetica,sans-serif;padding:24px}
h1{margin:0 0 8px 0}
table{border-collapse:collapse;width:100%}
td{border:1px solid #ddd;padding:6px;font-size:14px}
.code{font-size:24px;font-weight:bold}
</style></head><body>
<h1>Neue Anmeldung</h1>
<p><b>ID:</b> ${iduser}</p>
<table>
<tr><td>Vorname</td><td>${u.vorname}</td></tr>
<tr><td>Nachname</td><td>${u.nachname}</td></tr>
<tr><td>Benutzername</td><td>${u.benutzer}</td></tr>
<tr><td>Strasse</td><td>${u.strasse}</td></tr>
<tr><td>PLZ</td><td>${u.plz}</td></tr>
<tr><td>Ort</td><td>${u.ort}</td></tr>
<tr><td>E-Mail</td><td>${u.email}</td></tr>
<tr><td>Handy</td><td>${u.handy}</td></tr>
<tr><td>Beruf</td><td>${u.beruf}</td></tr>
<tr><td>Arbeitsort</td><td>${u.arbeitsort}</td></tr>
<tr><td>Funktion</td><td>${u.funktion}</td></tr>
<tr><td>Start-Rolle</td><td>user</td></tr>
</table>
<p class="code">Willkommens-Code: ${code}</p>
</body></html>`;
}


// --- HEALTH ---
app.get('/health', (req, res) => res.json({ ok: true }));


// Start
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on :' + port));
