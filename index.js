import express from "express";
import { google } from "googleapis";

const app = express();

// ----------------- Owner OAuth (einmalig von dir) -----------------
let OWNER_TOKENS = null; // Für den Test reicht In-Memory (später speichern wir das dauerhaft)

function getOAuthClient() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!id || !secret || !redirect) {
    throw new Error("OAuth ENV fehlt: GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI");
  }
  return new google.auth.OAuth2(id, secret, redirect);
}

function driveAsOwner() {
  if (!OWNER_TOKENS) throw new Error("Owner nicht verbunden. Öffne /owner/connect");
  const client = getOAuthClient();
  client.setCredentials(OWNER_TOKENS);
  return google.drive({ version: "v3", auth: client });
}

function sheetsAsOwner() {
  if (!OWNER_TOKENS) throw new Error("Owner nicht verbunden. Öffne /owner/connect");
  const client = getOAuthClient();
