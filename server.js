'use strict';

/**
 * Twilio Access Token Server
 * ─────────────────────────
 * Express server for generating Twilio Access Tokens.
 * Deploy to Render.com for a permanent fixed HTTPS URL.
 *
 * Endpoints:
 *   GET  /health                                      → { "status": "ok" }
 *   GET  /token?type=video&room=<room>&identity=<id>  → { "token": "<jwt>" }
 *   GET  /token?type=voice&identity=<id>              → { "token": "<jwt>" }
 *   POST /voice  (TwiML webhook — called by Twilio)   → TwiML XML
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const twilio  = require('twilio');

const AccessToken = twilio.jwt.AccessToken;
const VideoGrant  = AccessToken.VideoGrant;
const VoiceGrant  = AccessToken.VoiceGrant;

// ── Validate environment ─────────────────────────────────────────────────────

const REQUIRED_ENV = ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('\n❌  Missing required environment variables:');
  missing.forEach((k) => console.error(`   - ${k}`));
  console.error('\n   Set them in Render Dashboard → Environment → Add Environment Variable\n');
  process.exit(1);
}

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  TWILIO_TWIML_APP_SID,
  TWILIO_CALLER_ID,
  PORT = 3000,
  TOKEN_TTL = 3600,
} = process.env;

// ── App ──────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', accountSid: TWILIO_ACCOUNT_SID, time: new Date().toISOString() });
});

// ── Token endpoint ────────────────────────────────────────────────────────────
//
// Query params (GET) or body params (POST):
//   type      "video" | "voice"       (default: "video")
//   identity  participant identity    (default: "flutter-user")
//   room      video room name         (required for video)

app.all('/token', (req, res) => {
  const params   = { ...req.query, ...req.body };
  const type     = (params.type     || 'video').toLowerCase();
  const identity = (params.identity || 'flutter-user').trim();
  const room     = (params.room     || '').trim();

  if (!identity) return res.status(400).json({ error: 'identity is required' });

  try {
    const token = new AccessToken(
      TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET,
      { identity, ttl: Number(TOKEN_TTL) }
    );

    if (type === 'video') {
      if (!room) return res.status(400).json({ error: 'room is required for type=video' });
      token.addGrant(new VideoGrant({ room }));
      console.log(`[${new Date().toISOString()}] VIDEO | identity=${identity} room=${room}`);

    } else if (type === 'voice') {
      token.addGrant(new VoiceGrant({
        outgoingApplicationSid: TWILIO_TWIML_APP_SID || undefined,
        incomingAllow: true,
      }));
      console.log(`[${new Date().toISOString()}] VOICE | identity=${identity}`);

    } else {
      return res.status(400).json({ error: `Unknown type "${type}". Use "video" or "voice".` });
    }

    return res.json({ token: token.toJwt() });
  } catch (err) {
    console.error('Token error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Voice TwiML handler ───────────────────────────────────────────────────────
// Called by Twilio when an outgoing call is placed.
// Set TwiML App → Voice URL to: https://<your-render-app>.onrender.com/voice

app.post('/voice', (req, res) => {
  const to   = req.body.To   || '';
  const from = req.body.From || 'unknown';

  console.log(`[${new Date().toISOString()}] TWIML | from=${from} to=${to}`);
  res.set('Content-Type', 'text/xml');

  if (!to) return res.send('<Response><Hangup/></Response>');

  // Phone number → dial directly
  if (to.startsWith('+') || to.startsWith('00')) {
    return res.send(`<Response><Dial callerId="${TWILIO_CALLER_ID || to}"><Number>${to}</Number></Dial></Response>`);
  }

  // Twilio Client identity → dial client
  return res.send(`<Response><Dial><Client>${to}</Client></Dial></Response>`);
});

// ── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀  Twilio Token Server running on port ${PORT}`);
  console.log(`   Health:      http://localhost:${PORT}/health`);
  console.log(`   Video token: http://localhost:${PORT}/token?type=video&room=test&identity=user1`);
  console.log(`   Voice token: http://localhost:${PORT}/token?type=voice&identity=user1`);
  console.log(`   Voice TwiML: http://localhost:${PORT}/voice`);
  console.log(`\n   Render URL:  https://<your-app-name>.onrender.com`);
  console.log(`   Account SID: ${TWILIO_ACCOUNT_SID}`);
  console.log(`   TwiML App:   ${TWILIO_TWIML_APP_SID || '(not set)'}\n`);
});

