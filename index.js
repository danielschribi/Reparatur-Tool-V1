import express from "express";
import { google } from "googleapis";

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing");
  const key = JSON.parse(json);
  const scopes = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ];
  return new google.auth.JWT(key.client_email, undefined, key.private_key, scopes);
}

async function createSpreadsheetInFolder(title, parentFolderId, auth) {
  const drive = google.drive({ version: "v3", auth });
  const fileRes = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: parentFolderId ? [parentFolderId] : undefined
    },
    fields: "id, name"
  });
  return fileRes.data; // { id, name }
}

async function writeCell(spreadsheetId, a1Range, value, auth) {
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Sheet1!${a1Range}`, // schreibt in die Standard-Tabelle "Sheet1"
    valueInputOption: "RAW",
    requestBody: { values: [[value]] }
  });
}

const app = express();
app.get("/test", async (_req, res) => {
  try {
    const auth = getAuth();
    const parentId = process.env.DRIVE_ROOT_FOLDER_ID || undefined;

    // 1) Spreadsheet mit Titel "name" im Zielordner erzeugen
    const file = await createSpreadsheetInFolder("name", parentId, auth);

    // 2) In Zelle B3 den Text setzen
    await writeCell(file.id, "B3", "Hallo Schriibi", auth);

    const url = `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
    res.json({ ok: true, spreadsheetId: file.id, title: "name", url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Test server running on :${port}`));
