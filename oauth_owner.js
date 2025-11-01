import { google } from "googleapis";

let OWNER_TOKENS = null;

export function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  return client;
}

export function driveAsOwner() {
  if (!OWNER_TOKENS) throw new Error("Owner nicht verbunden. Besuche /owner/connect zuerst.");
  const client = getOAuthClient();
  client.setCredentials(OWNER_TOKENS);
  return google.drive({ version: "v3", auth: client });
}

export function ownerRoutes(app) {
  // Schritt 1: Benutzer klickt "Verbinden"
  app.get("/owner/connect", (_req, res) => {
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
  });

  // Schritt 2: Callback nach erfolgreicher Anmeldung
  app.get("/owner/callback", async (req, res) => {
    const client = getOAuthClient();
    const { code } = req.query;
    const { tokens } = await client.getToken(code);
    OWNER_TOKENS = tokens;
    res.send(`
      <h2>✅ Owner verbunden!</h2>
      <p>Du kannst jetzt <a href="/test-create" target="_blank">/test-create</a> öffnen, 
      um die Test-Tabelle zu erzeugen.</p>
    `);
  });
}
