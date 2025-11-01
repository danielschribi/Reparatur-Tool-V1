import express from "express";
import { google } from "googleapis";

const app = express();

/** ================== Owner OAuth – einmal von dir verbinden ================== */
let OWNER_TOKENS = null;

function getOAuthClient() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!id || !secret || !redirect) {
    throw new Error("ENV fehlt: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI");
  }
  return new google.auth.OAuth2(id, secret, redirect);
}

function driveAsOwner() {
  if (!OWNER_TOKENS) throw new Error("Owner nicht verbunden. Öffne /owner/connect");
  const client = getOAuthClient();
  client.setCredentials(OWNER_TOKENS);
  return google.drive({ version: "v3", auth: client });
}

function sheetsAsOwner() {
  if (!OWNER_TOKENS) throw new Error("Owner nicht verbunden. Öffne /owner/connect");
  const client = getOAuthClient();
  client.setCredentials(OWNER_TOKENS);
  return google.sheets({ version: "v4", auth: client });
}

app.get("/owner/connect", (_req, res) => {
  try {
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/spreadsheets"
      ]
    });
    res.redirect(url);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.get("/owner/callback", async (req, res) => {
  try {
    const client = getOAuthClient();
    const { code } = req.query;
    const { tokens } = await client.getToken(code);
    OWNER_TOKENS = tokens;
    res.send(`
      <h2>✅ Owner verbunden!</h2>
      <p>Jetzt <a href="/test-create" target="_blank">/test-create</a> öffnen, um die Test-Tabelle zu erzeugen.</p>
    `);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

/** =============== Test: neue Tabelle anlegen + B3 beschreiben =============== */
app.get("/test-create", async (_req, res) => {
  try {
    const parentId = process.env.DRIVE_ROOT_FOLDER_ID || undefined;
    const drive = driveAsOwner();

    // 1) Neue Google-Sheet-Datei "name" anlegen
    const created = await drive.files.create({
      requestBody: {
        name: "name",
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: parentId ? [parentId] : undefined
      },
      fields: "id,name"
    });

    // 2) In B3 schreiben
    const spreadsheetId = created.data.id;
    const sheets = sheetsAsOwner();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!B3",
      valueInputOption: "RAW",
      requestBody: { values: [["Hallo Schriibi"]] }
    });

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    res.json({ ok: true, created: created.data, wrote: "B3=Hallo Schriibi", url });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/** ============================== Startseite ================================= */
app.get("/", (_req, res) => {
  res.send(`
    <h1>Reparatur-Tool</h1>
    <ul>
      <li><a href="/owner/connect">Owner verbinden</a></li>
      <li><a href="/test-create" target="_blank">Test: neue Tabelle erstellen & B3 schreiben</a></li>
    </ul>
  `);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on :" + port));
