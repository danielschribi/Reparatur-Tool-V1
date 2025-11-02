const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[0-9+()\-\s]{6,}$/;


function requireAllFields(u) {
const required = ['vorname','nachname','strasse','plz','ort','email','handy','benutzer','beruf','arbeitsort','funktion'];
const missing = required.filter(k => !String(u[k]||'').trim());
return { ok: missing.length === 0, missing };
}


function validEmail(s) { return emailRegex.test(String(s||'').trim()); }
function validPhone(s) { return phoneRegex.test(String(s||'').trim()); }


module.exports = { requireAllFields, validEmail, validPhone };
