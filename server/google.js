const { google } = require('googleapis');


// Lädt Owner-Tokens aus ENV und liefert vorautorisierte Clients
function getOAuth2Client() {
const client = new google.auth.OAuth2(
process.env.GOOGLE_OAUTH_CLIENT_ID,
process.env.GOOGLE_OAUTH_CLIENT_SECRET,
process.env.GOOGLE_OAUTH_REDIRECT_URI
);
const tokens = JSON.parse(process.env.OWNER_OAUTH_TOKENS || '{}');
if (tokens && tokens.refresh_token) client.setCredentials(tokens);
return client;
}


function sheetsClient() {
const auth = getOAuth2Client();
return google.sheets({ version: 'v4', auth });
}
;
function driveClient() {
const auth = getOAuth2Client();
return google.drive({ version: 'v3', auth });
}


function gmailClient() {
const auth = getOAuth2Client();
return google.gmail({ version: 'v1', auth });
}


module.exports = { getOAuth2Client, sheetsClient, driveClient, gmailClient }
