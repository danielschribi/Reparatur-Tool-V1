// server/sheets.js
// Zugriff auf Google Sheets (db-user) über Drive-Folder-Struktur:
// DRIVE_ROOT_FOLDER_ID -> Unterordner "db" -> Spreadsheet "db-user"

const { sheetsClient, driveClient } = require('./google');
const { makeUserId, todayCH } = require('./utils');

// --- Konfiguration (statisch nach deiner Vorgabe) ---
const ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID; // "Reparatur-Tool"
const DB_SUBFOLDER_NAME = 'db';
const DB_SPREADSHEET_NAME = 'db-user';

const SHEET_USERS = 'user';
const SHEET_EMAILS = 'email';
const SHEET_ROLLEN = 'rollen';

// A..N: iduser, vorname, nachname, strasse, plz, ort, email, handy, benutzer, passwort, beruf, arbeitsort, funktion, rolle
const USER_COLUMNS = [
  'iduser','vorname','nachname','strasse','plz','ort','email','handy',
  'benutzer','passwort','beruf','arbeitsort','funktion','rolle'
];

// --- In-Memory Cache für IDs (minimiert Drive-Suchen) ---
let _cached = {
  dbFolderId: null,
  spreadsheetId: null,
};

// ---------- Drive/Suche-Helfer ----------

async function ensureEnv() {
  if (!ROOT_FOLDER_ID) {
    throw new Error('DRIVE_ROOT_FOLDER_ID ist nicht gesetzt (Render-ENV).');
  }
}

async function findSubfolderByName(parentId, name) {
  const drive = driveClient();
  const q = [
    `'${parentId}' in parents`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${name.replace(/'/g, "\\'")}'`,
    `trashed = false`,
  ].join(' and ');
  const res = await drive.files.list({ q, fields: 'files(id, name)', pageSize: 10 });
  const files = res.data.files || [];
  if (files.length === 0) return null;
  return files[0].id;
}

async function findSpreadsheetInFolder(folderId, name) {
  const drive = driveClient();
  const q = [
    `'${folderId}' in parents`,
    `mimeType = 'application/vnd.google-apps.spreadsheet'`,
    `name = '${name.replace(/'/g, "\\'")}'`,
    `trashed = false`,
  ].join(' and ');
  const res = await drive.files.list({ q, fields: 'files(id, name)', pageSize: 10 });
  const files = res.data.files || [];
  if (files.length === 0) return null;
  return files[0].id;
}

async function getDbFolderId() {
  await ensureEnv();
  if (_cached.dbFolderId) return _cached.dbFolderId;

  const id = await findSubfolderByName(ROOT_FOLDER_ID, DB_SUBFOLDER_NAME);
  if (!id) {
    throw new Error(`Unterordner "${DB_SUBFOLDER_NAME}" wurde im Root-Ordner nicht gefunden. Prüfe Freigabe & Namen.`);
  }
  _cached.dbFolderId = id;
  return id;
}

async function getSpreadsheetId() {
  if (_cached.spreadsheetId) return _cached.spreadsheetId;
  const folderId = await getDbFolderId();

  const ssId = await findSpreadsheetInFolder(folderId, DB_SPREADSHEET_NAME);
  if (!ssId) {
    throw new Error(`Spreadsheet "${DB_SPREADSHEET_NAME}" im Ordner "db" nicht gefunden. Lege die Tabelle an oder prüfe den Namen.`);
  }
  _cached.spreadsheetId = ssId;
  return ssId;
}

// ---------- Sheet-Helfer ----------

function toRow(u) {
  return USER_COLUMNS.map(k => u[k] ?? '');
}

function fromRow(row) {
  const obj = {};
  USER_COLUMNS.forEach((k, i) => obj[k] = (row[i] ?? '').toString());
  return obj;
}

function rangeUsers()  { return `${SHEET_USERS}!A:N`; }
function rangeEmails() { return `${SHEET_EMAILS}!A:B`; }
function rangeRollen() { return `${SHEET_ROLLEN}!A:A`; }

// ---------- CRUD: db-user ----------

async function readAllUsers() {
  const sheets = sheetsClient();
  const spreadsheetId = await getSpreadsheetId();
  const range = rangeUsers();

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];

  if (rows.length === 0) return []; // leeres Sheet
  const [, ...data] = rows; // erste Zeile = Header
  return data.map(fromRow);
}

async function appendUser(user) {
  const sheets = sheetsClient();
  const spreadsheetId = await getSpreadsheetId();
  const range = rangeUsers();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [toRow(user)] },
  });
}

async function updateUserById(iduser, partial) {
  const sheets = sheetsClient();
  const spreadsheetId = await getSpreadsheetId();
  const range = rangeUsers();

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];
  if (rows.length === 0) throw new Error('Sheet user ist leer.');

  let idx = -1;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '') === iduser) { idx = i; break; }
  }
  if (idx === -1) throw new Error('User nicht gefunden');

  const current = fromRow(rows[idx]);
  const updated = { ...current, ...partial };
  rows[idx] = toRow(updated);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  return updated;
}

async function getRollen() {
  const sheets = sheetsClient();
  const spreadsheetId = await getSpreadsheetId();
  const range = rangeRollen();

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = (res.data.values || []).flat().filter(Boolean);
  return rows;
}

// ---------- Emails (Zusatzblatt) ----------

async function addEmail(iduser, email) {
  const sheets = sheetsClient();
  const spreadsheetId = await getSpreadsheetId();
  const range = rangeEmails();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [[iduser, email]] },
  });
}

async function readEmails(iduser) {
  const sheets = sheetsClient();
  const spreadsheetId = await getSpreadsheetId();
  const range = rangeEmails();

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];
  if (rows.length <= 1) return [];
  const [, ...data] = rows;

  return data.filter(r => (r[0] || '') === iduser).map(r => r[1]);
}

// ---------- ID-Vergabe ----------

async function nextUserIdForToday() {
  const users = await readAllUsers();
  const { yymmdd } = todayCH();
  const todays = users.filter(u => (u.iduser || '').includes(`U-${yymmdd}-`));
  const seq = todays.length + 1;
  if (seq > 99) throw new Error('Anmeldungen für heute erschöpft');
  return { iduser: makeUserId(seq), seq };
}

module.exports = {
  readAllUsers,
  appendUser,
  updateUserById,
  getRollen,
  addEmail,
  readEmails,
  nextUserIdForToday,
};
