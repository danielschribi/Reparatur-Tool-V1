const bcrypt = require('bcryptjs');


const DEFAULT_ROLE = 'user';


async function login(identifier, password) {
const users = await readAllUsers();
const u = users.find(x => x.benutzer === identifier || (`${x.vorname} ${x.nachname}`).toLowerCase() === String(identifier||'').toLowerCase());
if (!u) throw new Error('Benutzer nicht gefunden');
// Klartext-Passwort => Zwangsänderung beim nächsten Login
if (isPlainPassword(u.passwort)) {
if (password !== u.passwort) throw new Error('Passwort falsch');
return { needChange: true, iduser: u.iduser, role: u.rolle, initials: initials(u) };
}
const ok = await bcrypt.compare(password, u.passwort);
if (!ok) throw new Error('Passwort falsch');
const token = makeToken(u);
return { token, role: u.rolle, iduser: u.iduser, initials: initials(u) };
}


function makeToken(u) {
return jwt.sign({ iduser: u.iduser, role: u.rolle, initials: initials(u) }, process.env.JWT_SECRET, { expiresIn: '12h' });
}


function initials(u) { return `${(u.vorname||'').charAt(0)}${(u.nachname||'').charAt(0)}`.toUpperCase(); }


async function changePassword(iduser, oldPw, newPw) {
const users = await readAllUsers();
const u = users.find(x => x.iduser === iduser);
if (!u) throw new Error('User nicht gefunden');
if (isPlainPassword(u.passwort)) {
if (oldPw !== u.passwort) throw new Error('Altes Passwort falsch');
} else {
const ok = await bcrypt.compare(oldPw, u.passwort);
if (!ok) throw new Error('Altes Passwort falsch');
}
if (String(newPw||'').length < 6) throw new Error('Passwort zu kurz (min 6 Zeichen)');
const hash = await bcrypt.hash(newPw, 10);
const updated = await updateUserById(iduser, { passwort: hash });
return { ok: true, iduser: updated.iduser };
}


async function registerUser(payload) {
// Pflichtfelder prüfen und Maskenfarben (Frontend) abbilden
const v = requireAllFields(payload);
if (!v.ok) {
const list = v.missing.join(', ');
throw new Error(`Fehlende Felder: ${list}`);
}
if (!validEmail(payload.email)) throw new Error('E-Mail ungültig');
if (!validPhone(payload.handy)) throw new Error('Telefon ungültig');


const { iduser } = await nextUserIdForToday();
const code = fourDigitCode();
const userRow = {
iduser,
vorname: payload.vorname,
nachname: payload.nachname,
strasse: payload.strasse,
plz: payload.plz,
ort: payload.ort,
email: payload.email,
handy: payload.handy,
benutzer: payload.benutzer,
passwort: code, // Klartext → erzwingt PW-Änderung beim ersten Login
beruf: payload.beruf,
arbeitsort: payload.arbeitsort,
funktion: payload.funktion,
rolle: DEFAULT_ROLE
};
await appendUser(userRow);
await addEmail(iduser, payload.email);
return { iduser, code };
}


module.exports = { login, changePassword, registerUser };
