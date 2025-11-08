// server/index.js

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { google } from 'googleapis';
import { driveClient, sheetsClient } from './google.js';
import { checkAccess } from './ownerCheck.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// --- OAuth Setup ---
function createOAuthClientForConnect() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

// --- Owner Connect Route ---
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

// --- Owner Callback Route ---
app.get('/owner/callback', async (req, res) => {
  try {
    const client = createOAuthClientForConnect();
    const { code } = req.query;
    const { tokens } = await client.getToken(code);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      `<h1>Tokens</h1><pre>${JSON.stringify(tokens, null, 2)}</pre>
       <p>Kopiere den gesamten JSON-Text in Render als <b>OWNER_OAUTH_TOKENS</b> (ohne Anführungszeichen).</p>`
    );
  } catch (e) {
    res.status(500).send('Fehler beim Callback: ' + e.message);
  }
});

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ ok: true, ownerLoaded: !!process.env.OWNER_OAUTH_TOKENS });
});

// --- Google Drive/Sheets Check ---
app.get('/owner/check-access', async (req, res) => {
  try {
    const result = await checkAccess();
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Beispielroute: API Test ---
app.post('/api/login', async (req, res) => {
  res.json({ message: 'Login-Test erfolgreich' });
});

// --- Startseite ---
app.get('/', (req, res) => {
  res.send(`
    <h1>Reparatur-Tool API</h1>
    <ul>
      <li><a href="/owner/connect">Owner verbinden</a></li>
      <li><a href="/owner/check-access">Drive/Sheets prüfen</a></li>
      <li><a href="/health">Health Check</a></li>
    </ul>
  `);
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

