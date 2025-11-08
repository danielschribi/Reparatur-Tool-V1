// server/ownerCheck.js
// Prüfroutine für Google Drive/Sheets Struktur und Schreibrechte

const { driveClient, sheetsClient } = require('./google');

async function checkAccess() {
  const drive = driveClient();
  const sheets = sheetsClient();
  const rootId = process.env.DRIVE_ROOT_FOLDER_ID;

  if (!rootId) throw new Error('DRIVE_ROOT_FOLDER_ID ist nicht gesetzt.');

  const result = { rootId, folders: {}, sheets: {}, test: {} };

  // --- 1️⃣ Root-Folder prüfen
  const rootRes = await drive.files.get({ fileId: rootId, fields: 'id, name' });
  result.folders.root = rootRes.data;

  // --- 2️⃣ Unterordner db suchen
  const qFolder = [
    `'${rootId}' in parents`,
    `mimeType='application/vnd.google-apps.folder'`,
    'trashed=false'
  ].join(' and ');

  const foldersRes = await drive.files.list({
    q: qFolder,
    fields: 'files(id, name)',
    pageSize: 20
  });

  const dbFolder = (foldersRes.data.files || []).find(
    f => f.name.trim().toLowerCase() === 'db'
  );

  if (!dbFolder) throw new Error('Unterordner "db" nicht gefunden.');
  result.folders.db = dbFolder;

  // --- 3️⃣ Tabellen in db suchen
  const qSheets = [
    `'${dbFolder.id}' in parents`,
    `mimeType='application/vnd.google-apps.spreadsheet'`,
    'trashed=false'
  ].join(' and ');

  const sheetsRes = await drive.files.list({
    q: qSheets,
    fields: 'files(id, name)',
    pageSize: 20
  });

  const allSheets = sheetsRes.data.files || [];
  result.sheets.found = allSheets.map(f => f.name);

  const expected = ['db-user', 'db-meldung', 'db-massnahme'];
  for (const name of expected) {
    const hit = allSheets.find(f => f.name.trim().toLowerCase() === name);
    result.sheets[name] = hit ? hit.id : null;
  }

  // --- 4️⃣ Test: Lesen aus db-user (nur A1)
  if (result.sheets['db-user']) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: result.sheets['db-user'],
      range: 'user!A1',
    });
    result.test.readCell = res.data.values ? res.data.values[0][0] : '(leer)';
  } else {
    result.test.readCell = '(db-user fehlt)';
  }

  // --- 5️⃣ Test: Schreiben (neue Test-Tabelle im Root)
  const testFile = await drive.files.create({
    requestBody: {
      name: 'test-write-access',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [rootId],
    },
    fields: 'id, name',
  });

  result.test.createdFile = testFile.data;

  // Schreibversuch in Zelle A1
  await sheets.spreadsheets.values.update({
    spreadsheetId: testFile.data.id,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [['✅ Schreibtest erfolgreich']] },
  });

  result.test.writeCell = '✅ Schreibtest erfolgreich';

  // Testdatei optional wieder löschen
  await drive.files.delete({ fileId: testFile.data.id });

  return result;
}

module.exports = { checkAccess };
