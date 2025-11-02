const { sheetsClient } = require('./google');
const { makeUserId, todayCH } = require('./utils');

const DB_SPREADSHEET_ID = 'db-user';  // Dateiname oder Titel in Drive
const SHEET_USERS = 'user';
const SHEET_EMAILS = 'email';
const SHEET_ROLLEN = 'rollen';

// A..N: iduser, vorname, nachname, strasse, plz, ort, email, handy, benutzer, passwort, beruf, arbeitsort, funktion, rolle
const USER_COLUMNS = ['iduser','vorname','nachname','strasse','plz','ort','email','handy','benutzer','passwort','beruf','arbeitsort','funktion','rolle'];

function toRow(u){ return USER_COLUMNS.map(k => u[k] ?? ''); }
function fromRow(row){ const o={}; USER_COLUMNS.forEach((k,i)=>o[k]=(row[i]??'')+''); return o; }

async function readAllUsers(){
  const sheets = sheetsClient();
  const range = `${SHEET_USERS}!A:N`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: DB_SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  const [, ...data] = rows; // skip header
  return data.map(fromRow);
}

async function appendUser(user){
  const sheets = sheetsClient();
  const range = `${SHEET_USERS}!A:N`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: DB_SPREADSHEET_ID, range,
    valueInputOption: 'RAW',
    requestBody: { values: [toRow(user)] }
  });
}

async function updateUserById(iduser, partial){
  const sheets = sheetsClient();
  const range = `${SHEET_USERS}!A:N`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: DB_SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  let idx = -1;
  for(let i=1;i<rows.length;i++){ if(rows[i][0]===iduser){ idx=i; break; } }
  if(idx===-1) throw new Error('User not found');
  const current = fromRow(rows[idx]);
  const updated = { ...current, ...partial };
  rows[idx] = toRow(updated);
  await sheets.spreadsheets.values.update({
    spreadsheetId: DB_SPREADSHEET_ID, range,
    valueInputOption: 'RAW',
    requestBody: { values: rows }
  });
  return updated;
}

async function getRollen(){
  const sheets = sheetsClient();
  const range = `${SHEET_ROLLEN}!A:A`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: DB_SPREADSHEET_ID, range });
  return (res.data.values || []).flat().filter(Boolean);
}

async function addEmail(iduser, email){
  const sheets = sheetsClient();
  const range = `${SHEET_EMAILS}!A:B`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: DB_SPREADSHEET_ID, range,
    valueInputOption: 'RAW',
    requestBody: { values: [[iduser,email]] }
  });
}

async function readEmails(iduser){
  const sheets = sheetsClient();
  const range = `${SHEET_EMAILS}!A:B`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: DB_SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  const [, ...data] = rows;
  return data.filter(r=>r[0]===iduser).map(r=>r[1]);
}

async function nextUserIdForToday(){
  const users = await readAllUsers();
  const { yymmdd } = todayCH();
  const todays = users.filter(u => (u.iduser||'').includes(`U-${yymmdd}-`));
  const seq = todays.length + 1;
  if(seq>99) throw new Error('Anmeldungen für heute erschöpft');
  return { iduser: makeUserId(seq), seq };
}

module.exports = {
  readAllUsers, appendUser, updateUserById,
  getRollen, addEmail, readEmails, nextUserIdForToday
};
