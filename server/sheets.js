const { sheetsClient } = require('./google');
for (let i = 1; i < rows.length; i++) {
if (rows[i][0] === iduser) { targetRowIndex = i; break; }
}
if (targetRowIndex === -1) throw new Error('User not found');
const current = fromRow(rows[targetRowIndex]);
const updated = { ...current, ...partial };
rows[targetRowIndex] = toRow(updated);
await sheets.spreadsheets.values.update({
spreadsheetId,
range,
valueInputOption: 'RAW',
requestBody: { values: rows }
});
return updated;
}


async function getRollen() {
const sheets = sheetsClient();
const spreadsheetId = await findSpreadsheetIdByName(DB_SPREADSHEET_NAME);
const range = await getRollenSheetRange();
const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
const rows = (res.data.values || []).flat().filter(Boolean);
return rows;
}


async function addEmail(iduser, email) {
const sheets = sheetsClient();
const spreadsheetId = await findSpreadsheetIdByName(DB_SPREADSHEET_NAME);
const range = await getEmailsSheetRange();
await sheets.spreadsheets.values.append({
spreadsheetId, range,
valueInputOption: 'RAW',
requestBody: { values: [[iduser, email]] }
});
}


async function readEmails(iduser) {
const sheets = sheetsClient();
const spreadsheetId = await findSpreadsheetIdByName(DB_SPREADSHEET_NAME);
const range = await getEmailsSheetRange();
const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
const rows = res.data.values || [];
const [, ...data] = rows;
return data.filter(r => r[0] === iduser).map(r => r[1]);
}


async function nextUserIdForToday() {
const users = await readAllUsers();
const { yymmdd } = todayCH();
const todays = users.filter(u => (u.iduser || '').includes(`U-${yymmdd}-`));
const seq = todays.length + 1;
if (seq > 99) throw new Error('Anmeldungen für heute erschöpft');
return { iduser: makeUserId(seq), seq };
}


module.exports = {
readAllUsers, appendUser, updateUserById, getRollen, addEmail, readEmails, nextUserIdForToday
};
