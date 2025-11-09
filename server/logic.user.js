// server/logic.user.js
// Zentrale User-Logik für Reparatur-Tool (Login, Passwort, Registrierung, User-CRUD)

const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

// Welches Spreadsheet & Tab?
// Du kannst einen dieser ENV-Variablen setzen:
//  - DB_USER_SPREADSHEET_ID
//  - DB_SPREADSHEET_ID
//  - GOOGLE_SHEETS_SPREADSHEET_ID
const SPREADSHEET_ID =
  process.env.DB_USER_SPREADSHEET_ID ||
  process.env.DB_SPREADSHEET_ID ||
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

const SHEET_NAME = process.env.DB_USER_SHEET_NAME || 'db-user';

// ---------- Google Auth (OWNER_OAUTH_TOKENS) ----------

function getAuthClient() {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID ||
      !process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
      !process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error('OAuth-Clientdaten (GOOGLE_OAUTH_CLIENT_*) fehlen');
  }
  if (!process.env.OWNER_OAUTH_TOKENS) {
    throw new Error('OWNER_OAUTH_TOKENS ist nicht gesetzt.');
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  let tokens;
  try {
    tokens = JSON.parse(process.env.OWNER_OAUTH_TOKENS);
  } catch (e) {
    throw new Error('OWNER_OAUTH_TOKENS ist kein gültiges JSON: ' + e.message);
  }

  client.setCredentials(tokens);
  return client;
}

async function getSheetsClient() {
  if (!SPREADSHEET_ID) {
    throw new Error(
      'Kein Spreadsheet für db-user konfiguriert. Setze z.B. DB_SPREADSHEET_ID.'
    );
  }
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, spreadsheetId: SPREADSHEET_ID };
}

// ---------- Helfer: User-Liste laden / speichern ----------

function rowToUser(row, header) {
  const obj = {};
  header.forEach((h, idx) => {
    if (!h) return;
    obj[h] = row[idx] != null ? row[idx] : '';
  });
  return obj;
}

async function loadUsersAndHeader() {
  const { sheets, spreadsheetId } = await getSheetsClient();
  const range = `${SHEET_NAME}!A1:Z1000`;
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });

  const rows = resp.data.values || [];
  if (rows.length === 0) {
    // Leeres Sheet
    return { header: [], users: [] };
  }

  const header = rows[0];
  const users = rows.slice(1).map((row) => rowToUser(row, header));
  return { header, users };
}

async function saveUsers(users, header) {
  const { sheets, spreadsheetId } = await getSheetsClient();
  const values = [
    header,
    ...users.map((u) =>
      header.map((h) =>
        u[h] != null && u[h] !== undefined ? String(u[h]) : ''
      )
    )
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

// ---------- Helfer: IDs, Initialen, 4-stellige Codes ----------

function buildInitials(vorname, nachname) {
  const v = (vorname || '').trim();
  const n = (nachname || '').trim();
  const i1 = v ? v[0] : '';
  const i2 = n ? n[0] : '';
  const initials = (i1 + i2).toUpperCase();
  return initials || '??';
}

function generateFourDigitCode() {
  const num = Math.floor(Math.random() * 10000);
  return String(num).padStart(4, '0');
}

function generateUserId(allUsers) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  // Format: U-jjmmddxx → z.B. U-25110901
  const base = `U-${yy}${mm}${dd}`;

  const todays = allUsers
    .map((u) => String(u.iduser || ''))
    .filter((id) => id.startsWith(base));

  let maxSuffix = 0;
  for (const id of todays) {
    const suffix = id.slice(base.length); // die letzten 2 Stellen
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n) && n > maxSuffix) {
      maxSuffix = n;
    }
  }

  const next = (maxSuffix + 1).toString().padStart(2, '0');
  return base + next; // z.B. U-25110901
}

// ---------- Export-Funktion: alle User ----------

async function getAllUsers() {
  const { users } = await loadUsersAndHeader();
  return users;
}

async function getUserById(iduser) {
  const { users } = await loadUsersAndHeader();
  const id = String(iduser).trim();
  return users.find((u) => String(u.iduser || '').trim() === id) || null;
}

async function updateUserPartial(iduser, partial) {
  const { header, users } = await loadUsersAndHeader();
  const id = String(iduser).trim();
  const idx = users.findIndex(
    (u) => String(u.iduser || '').trim() === id
  );
  if (idx === -1) {
    throw new Error('User nicht gefunden');
  }

  const updated = { ...users[idx], ...partial };
  users[idx] = updated;
  await saveUsers(users, header);
  return updated;
}

// ---------- Export-Funktion: Benutzername prüfen ----------

async function usernameExists(benutzerRaw) {
  const benutzer = (benutzerRaw || '').trim().toLowerCase();
  if (!benutzer) return false;
  const users = await getAllUsers();
  return users.some(
    (u) =>
      (u.benutzer || '').trim().toLowerCase() === benutzer
  );
}

// ---------- Login ----------

async function login(identifierRaw, passwordRaw) {
  const identifier = (identifierRaw || '').trim();
  const pw = String(passwordRaw || '').trim();

  if (!identifier || !pw) {
    throw new Error('Benutzername und Passwort erforderlich');
  }

  const users = await getAllUsers();
  const identLower = identifier.toLowerCase();

  const user =
    users.find(
      (u) =>
        String(u.iduser || '').trim() === identifier ||
        (u.benutzer || '').trim().toLowerCase() === identLower ||
        (u.email || '').trim().toLowerCase() === identLower
    ) || null;

  if (!user) {
    throw new Error('Benutzer oder Passwort falsch');
  }

  const storedPw = String(user.passwort || '').trim();
  if (!storedPw || storedPw !== pw) {
    throw new Error('Benutzer oder Passwort falsch');
  }

  const initials = buildInitials(user.vorname, user.nachname);
  const role = user.rolle || 'user';

  const needChange = /^[0-9]{4}$/.test(storedPw);

  if (needChange) {
    // 4-stelliger Code → Passwort muss geändert werden
    return {
      needChange: true,
      iduser: user.iduser,
      role: role,
      initials
    };
  }

  // Normales Login mit JWT
  const secret = process.env.JWT_SECRET || 'insecure-dev-secret';
  const token = jwt.sign(
    { iduser: user.iduser, role },
    secret,
    { expiresIn: '12h' }
  );

  return {
    token,
    iduser: user.iduser,
    role,
    initials
  };
}

// ---------- Passwort ändern ----------

async function changePassword(iduser, oldPwRaw, newPwRaw) {
  const oldPw = String(oldPwRaw || '').trim();
  const newPw = String(newPwRaw || '').trim();

  if (!iduser || !oldPw || !newPw) {
    throw new Error('Felder unvollständig');
  }
  if (newPw.length < 6) {
    throw new Error('Neues Passwort ist zu kurz (min. 6 Zeichen).');
  }

  const { header, users } = await loadUsersAndHeader();
  const id = String(iduser).trim();

  const idx = users.findIndex(
    (u) => String(u.iduser || '').trim() === id
  );
  if (idx === -1) {
    throw new Error('User nicht gefunden');
  }

  const storedPw = String(users[idx].passwort || '').trim();
  if (storedPw !== oldPw) {
    throw new Error('Alter Code / Passwort stimmt nicht.');
  }

  users[idx].passwort = newPw;
  await saveUsers(users, header);

  return { ok: true };
}

// ---------- Registrierung ----------

async function registerUser(payload) {
  const {
    vorname = '',
    nachname = '',
    benutzer = '',
    email = '',
    handy = '',
    strasse = '',
    plz = '',
    ort = '',
    beruf = '',
    arbeitsort = '',
    funktion = ''
  } = payload || {};

  const benutzerTrimmed = benutzer.trim();
  if (!benutzerTrimmed) {
    throw new Error('Benutzername ist erforderlich');
  }

  // User & Header laden
  const { header, users } = await loadUsersAndHeader();

  // Benutzername eindeutig?
  const existsAlready = users.some(
    (u) =>
      (u.benutzer || '').trim().toLowerCase() ===
      benutzerTrimmed.toLowerCase()
  );
  if (existsAlready) {
    throw new Error('Benutzername ist bereits vergeben');
  }

  // ID und 4-stelliger Code erzeugen
  const iduser = generateUserId(users);
  const code = generateFourDigitCode();

  // Neuen User auf Basis der Header-Zeile bauen
  const user = {};
  header.forEach((h) => {
    if (!h) return;
    user[h] = '';
  });

  user.iduser = iduser;
  user.vorname = vorname;
  user.nachname = nachname;
  user.benutzer = benutzerTrimmed;
  user.email = email;
  user.handy = handy;
  user.strasse = strasse;
  user.plz = plz;
  user.ort = ort;
  user.beruf = beruf;
  user.arbeitsort = arbeitsort;
  user.funktion = funktion;
  user.rolle = 'user';
  user.passwort = code;

  users.push(user);
  await saveUsers(users, header);

  return { iduser, code };
}

module.exports = {
  login,
  changePassword,
  registerUser,
  getAllUsers,
  getUserById,
  updateUserPartial,
  usernameExists
};
