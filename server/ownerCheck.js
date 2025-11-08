// server/ownerCheck.js
// Prüfroutine für Google Drive/Sheets Struktur und Schreibrechte

const { driveClient, sheetsClient } = require('./google');

async function checkAccess() {
  const drive = driveClient();
  const sheets = sheetsClient();
  const rootId = process.env.DRIVE_ROOT_FOLDER_ID;

  if (!rootId) {
    throw new Error('DRIVE_ROOT_FOLDER_ID ist nicht gesetzt.');
  }

  const result = {
    rootId,
    folders: {},
    sheets: {},
    test: {}
  };

  // 1️⃣ Root-Ordner prüfen
  const rootRes = await drive.files.get({
    fileId: rootId,
    fields: 'id, name'
  });
  result.folders.root = rootRes.data;

  // 2️⃣ Unterordner „db“ suchen
  const qFolder = [
    `'${rootId}' in parents`,
    `mimeType='application/vnd.google-apps.folder'`,
    'trashed=false'
  ].join(' and ');

  const foldersRes = await drive.files.list({
    q: qFolder,
    fields: 'files(id, name)',
    pageSize: 50
  });

  const folders = foldersRes.data.files || [];
  const dbFolder = folders.find(
    f => (f.name || '').trim().toLowerCase() === 'db'
  );

  if (!dbFolder) {
    throw new Error('Unterordner "db" nicht gefunden.');
  }
  result.folders.db = dbFolder;

  // 3️⃣ Tabellen (Spreadsheets) in „db“ suchen
  const qSheets = [
    `'${dbFolder.id}' in parents`,
    `mimeType='application/vnd.google-apps.spreadsheet'`,
    'trashed=false'
  ].join(' and ');

  const sheetsRes = await drive.files.list({
    q: qSheets,
    fields: 'files(id, name)',
    pageSize: 50
  });

  const allSheets = sheetsRes.data.files || [];
  result.sheets.found = allSheets.map(f => f.name);

  const expected = ['db-user', 'db-meldung', 'db-massnahme'];
  for (const name of expected) {
    const hit = allSheets.find(
      f => (f.name || '').trim().toLowerCase() === name
    );
    result.sheets[name] = hit ? hit.id : null;
  }

  // 4️⃣ Test: Lesen aus db-user (Zelle A1 des Standardblatts)
  if (result.sheets['db-user']) {
    try {
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: result.sheets['db-user'],
        range: 'A1' // Kein Blattname -> erstes Blatt, egal wie es heißt
      });
      const v =
        readRes.data.values &&
        readRes.data.values[0] &&
        readRes.data.values[0][0];
      result.test.readCell = v || '(leer)';
    } catch (e) {
      result.test.readCell =
        'Fehler beim Lesen von A1 in db-user: ' + e.message;
    }
  } else {
    result.test.readCell = 'db-user nicht gefunden';
  }

  // 5️⃣ Test: Schreiben in neue Test-Tabelle im Root (A1)
  let testFileId = null;
  try {
    const createRes = await drive.files.create({
      requestBody: {
        name: 'test-write-access',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [rootId]
      },
      fields: 'id, name'
    });

    testFileId = createRes.data.id;
    result.test.createdFile = createRes.data;

    await sheets.spreadsheets.values.update({
      spreadsheetId: testFileId,
      range: 'A1', // ohne Blattname
      valueInputOption: 'RAW',
      requestBody: { values: [['✅ Schreibtest erfolgreich']] }
    });

    result.test.writeCell = '✅ Schreibtest erfolgreich';
  } catch (e) {
    result.test.writeCell =
      'Fehler beim Schreiben von A1 in Test-Spreadsheet: ' + e.message;
  } finally {
    // Testdatei wieder löschen, damit Drive sauber bleibt
    if (testFileId) {
      try {
        await drive.files.delete({ fileId: testFileId });
      } catch (e) {
        // Ignorieren – ist nur Aufräumaktion
      }
    }
  }

  return result;
}

module.exports = { checkAccess };
