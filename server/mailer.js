const { gmailClient } = require('./google');


async function sendWelcomeEmail({ to, subject, html, attachments = [] }) {
const gmail = gmailClient();
const boundary = 'mixed-' + Date.now();


function base64url(str) { return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }


let body = `Content-Type: multipart/mixed; boundary=${boundary}\nMIME-Version: 1.0\n\n`;
body += `--${boundary}\nContent-Type: text/html; charset=UTF-8\nMIME-Version: 1.0\n\n${html}\n\n`;


for (const a of attachments) {
body += `--${boundary}\nContent-Type: ${a.mimeType}; name=${a.filename}\nMIME-Version: 1.0\nContent-Transfer-Encoding: base64\nContent-Disposition: attachment; filename=${a.filename}\n\n${a.data}\n\n`;
}


body += `--${boundary}--`;


const raw = base64url(
`To: ${to}\nSubject: ${subject}\n${body}`
);


await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}


module.exports = { sendWelcomeEmail };
