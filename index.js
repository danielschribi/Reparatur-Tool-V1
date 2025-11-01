import express from "express";
import { google } from "googleapis";

const app = express();

/** ===================== Persistente Owner-Tokens ===================== */
let OWNER_TOKENS = null;

// 1) Beim Start: Tokens aus ENV laden (falls vorhanden)
try {
  if (process.env.OWNER_OAUTH_TOKENS) {
    OWNER_TOKENS = JSON.parse(process.env.OWNER_OAUTH_TOKENS);
    // kleine Validierung
    if (!OWNER_TOKENS.refresh_token) {
      console.warn("OWNER_OAUTH_TOKENS ohne refresh_token – bitte neu verbinden & ENV aktualisieren.");
    }
  }
} catch (e) {
  console.error("OWNER_OAUTH_TOKENS konnte nicht geparst werden:", e);
}

/** ====================== OAuth Client Helpers ======================= */
function getOAuthClient() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!id || !secret || !redirect) {
    throw new Error("ENV fehlt: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI");
  }
  return new google.auth.OAuth2(id, secret, redirect);
}

function requireOwnerTokens() {
  if (!OWNER_TOKENS) throw new Error("Owner nicht verbunden. Öffne /owner/connect");
}

function driveAsOwner() {
  requireOwnerTokens();
  const client = getOAuthClient();
  client.setCredentials(OWNER_TOKENS);
  return google.drive({ version: "v3", auth: client });
}

function sheetsAsOwner() {
  requireOwnerTokens();
  const client = getOAuthClient();
  client.setCredentials(OWNER_TOKENS);
  return google.sheets({ version: "v4", auth: client });
}

/** ========================== OAuth Flows ============================ */
// Start: Consent-Seite
app.get("/owner/connect", (_req, res) => {
  try {
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // erzwingt refresh_token bei erstmaligem Consent
      scope: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/spreadsheets",
        "openid", "email", "profile",
      ],
    });
    res.redirect(url);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

// Callback: Tokens entgegennehmen + anzeigen zum Speichern
app.get("/owner/callback", async (req, res) => {
  try {
    const client = getOAuthClient();
    const { code } = req.query;
    const { tokens } = await client.getToken(code);
    OWNER_TOKENS = tokens;

    // Wichtig: Wir zeigen dir die Tokens, damit du sie in Render als ENV hinterlegen kannst.
    const pretty = JSON.stringify(OWNER_TOKENS, null, 2)
      // kleine Maskierung im Browser (Access Token ist kurzlebig)
      .replace(/"access_token":\s*".*?"/, '"access_token": "***"');

    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    res.end(`
      <h2>✅ Owner verbunden!</h2>
      <p>Bitte kopiere dieses JSON in Render als <code>OWNER_OAUTH_TOKENS</code> (Environment Variable):</p>
      <textarea style="width:100%;height:280px;font-family:monospace;">${JSON.stringify(OWNER_TOKENS, null, 2)}</textarea>
      <ol>
        <li>Öffne Render → <b>Environment</b> deines Services</li>
        <li>Füge <b>OWNER_OAUTH_TOKENS</b> mit dem <i>vollen JSON</i> ein (ganzer Inhalt oben)</li>
        <li>Speichern → Redeploy</li>
      </ol>
      <p>Danach bleibt der Zugriff auch nach Neustarts erhalten.</p>
      <p><a href="/health" target="_blank">/health</a> · <a href="/test-create" target="_blank">/test-create</a></p>
    `);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

/** ========================= Health & Status ========================= */
app.get("/health", async (_req, res) => {
  const hasTokens = !!OWNER_TOKENS;
  res.json({
    ok: true,
    ownerLoaded: hasTokens,
    hasRefreshToken: hasTokens && !!OWNER_TOKENS.refresh_token,
  });
});

/** === Test: neue Tabelle → Blatt "guguseli" → B3="Hallo Schriibi" === */
app.get("/test-create", async (_req, res) => {
  try {
    const parentId = process.env.DRIVE_ROOT_FOLDER_ID || undefined;
    const drive = driveAsOwner();
    const sheets = sheetsAsOwner();

    // 1) Datei "name" erstellen
    const created = await drive.files.create({
      requestBody: {
        name: "name",
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id,name",
    });
    const spreadsheetId = created.data.id;

    // 2) Erstes Blatt zu "guguseli" umbenennen
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    const sheetId = meta.data.sheets[0].properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, title: "guguseli" },
              fields: "title",
            },
          },
        ],
      },
    });

    // 3) B3 schreiben
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "guguseli!B3",
      valueInputOption: "RAW",
      requestBody: { values: [["Hallo Schriibi"]] },
    });

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    res.json({ ok: true, fileName: "name", sheetName: "guguseli", wrote: "B3=Hallo Schriibi", url });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/** ============================== Root =============================== */
app.get("/", (_req, res) => {
  res.send(`
    <h1>Reparatur-Tool</h1>
    <ul>
      <li><a href="/owner/connect">Owner verbinden</a></li>
      <li><a href="/health" target="_blank">Status</a></li>
      <li><a href="/test-create" target="_blank">Test: neue Tabelle & B3 schreiben</a></li>
    </ul>
  `);
});

/** ============================ Start Server ========================= */
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on :" + port));
