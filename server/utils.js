const crypto = require('crypto');


function todayCH() {
const now = new Date();
const dd = String(now.getDate()).padStart(2, '0');
const mm = String(now.getMonth() + 1).padStart(2, '0');
const yyyy = now.getFullYear();
const hh = String(now.getHours()).padStart(2, '0');
const min = String(now.getMinutes()).padStart(2, '0');
return { hhmm: `${hh}:${min}`, dmy: `${dd}.${mm}.${yyyy}`, yymmdd: `${String(yyyy).slice(2)}${mm}${dd}` };
}


function makeUserId(sequence) {
const { yymmdd } = todayCH();
return `U-${yymmdd}-${String(sequence).padStart(2, '0')}`;
}


function fourDigitCode() {
return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}


function isPlainPassword(pw) {
// Dedizierter Marker: Klartext (nicht gehasht) → zB 4-stelliger Code
return !!pw && pw.length <= 8 && !pw.startsWith('$2a$');
}


module.exports = { todayCH, makeUserId, fourDigitCode, isPlainPassword };
