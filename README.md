# Twilio Token Server — Render.com Deployment Guide

Express server that generates Twilio Access Tokens.
Deploy once to **Render.com** and get a permanent fixed HTTPS URL — free tier, no credit card needed.

---

## Step 1 — Push to GitHub

The token server must be in a Git repository for Render to deploy it.

**Option A — Use your existing project repo**
The `docs/token_server/` folder is already part of the SDK repo.
Push your project to GitHub if not already done.

**Option B — Create a dedicated repo (recommended)**
```bash
cd docs/token_server
git init
git add .
git commit -m "Twilio token server"
gh repo create twilio-token-server --public --push --source=.
```

---

## Step 2 — Deploy on Render

1. Go to https://render.com → **Sign up** (free, no credit card)
2. Click **New +** → **Web Service**
3. Connect your GitHub account → select your repo
4. Configure:

| Field | Value |
|-------|-------|
| Name | `twilio-token-server` (or any name) |
| Root Directory | `docs/token_server` (if using SDK repo) |
| Runtime | **Node** |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | **Free** |

5. Click **Create Web Service**

Your server URL will be:
```
https://twilio-token-server.onrender.com
```

---

## Step 3 — Set Environment Variables in Render

In Render Dashboard → your service → **Environment** → Add:

| Key | Value | Required |
|-----|-------|----------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxx` | ✅ |
| `TWILIO_API_KEY_SID` | `SKxxxxxxxxxxxxxxxx` | ✅ |
| `TWILIO_API_KEY_SECRET` | `your_secret` | ✅ |
| `TWILIO_TWIML_APP_SID` | `APxxxxxxxxxxxxxxxx` | ✅ for voice outgoing |
| `TWILIO_PUSH_CREDENTIAL_SID` | `CRxxxxxxxxxxxxxxxx` | ✅ for voice incoming |
| `TWILIO_CALLER_ID` | `+1xxxxxxxxxx` | optional |
| `TOKEN_TTL` | `3600` | optional |

> ⚠️ `TWILIO_PUSH_CREDENTIAL_SID` is **required for incoming calls**.
> Without it Twilio cannot send FCM push notifications to the receiver.
>
> **Where to find it:**
> Twilio Console → Voice → Push Credentials → copy the SID starting with `CR...`
>
> **How to create one (if you haven't):**
> 1. Console → Voice → Push Credentials → Create new credential
> 2. Type: FCM, paste your Firebase Server Key (from Firebase Console → Project Settings → Cloud Messaging)
> 3. Copy the generated `CR...` SID → paste as `TWILIO_PUSH_CREDENTIAL_SID`

> ⚠️ **Never** put secrets in `.env` files committed to Git.
> Always use Render's Environment dashboard for production values.

---

## Step 4 — Update Flutter App Config

Edit `lib/config/twilio_app_config.dart`:

```dart
static const String tokenServerBaseUrl = 'https://twilio-token-server.onrender.com';
```

Replace `twilio-token-server` with your actual Render service name.

---

## Step 5 — Set TwiML App Voice URL in Twilio Console

1. Go to [Twilio Console → Voice → TwiML Apps](https://console.twilio.com/us1/develop/voice/manage/twiml-apps)
2. Open your TwiML App (the one whose SID is in `TWILIO_TWIML_APP_SID`)
3. Set **Voice Configuration → Request URL** to:
   ```
   https://twilio-token-v0ej.onrender.com/voice
   ```
   *(Replace with your actual Render URL)*
4. Set **HTTP Method** to **HTTP POST** (recommended, but the server now handles both GET and POST)
5. Click **Save**

> ⚠️ **Common cause of HTTP 404 error on `/voice`:**
> The TwiML App Voice URL was pointing to an old or wrong URL (e.g., a tunnel URL like `loca.lt`).
> Always point it to your current Render URL + `/voice`.

---

## Troubleshooting — "Got HTTP 404 response to .../voice"

This Twilio console error means Twilio called your server's `/voice` webhook but got a 404.

**Checklist:**

| # | Check | How to fix |
|---|-------|-----------|
| 1 | TwiML App Voice URL is set? | Console → Voice → TwiML Apps → open your app → set Voice URL |
| 2 | URL ends with `/voice`? | Must be `https://yourapp.onrender.com/voice` |
| 3 | Render deployed latest code? | Render Dashboard → Manual Deploy → Deploy latest commit |
| 4 | Server is running? | Visit `https://yourapp.onrender.com/health` in browser |
| 5 | `TWILIO_TWIML_APP_SID` set in Render env? | Render → Environment → check `TWILIO_TWIML_APP_SID=AP...` |

**Quick test — call `/voice` manually:**
```bash
curl -X POST "https://twilio-token-v0ej.onrender.com/voice" \
  -d "To=flutter-tester-2&From=flutter-tester-1"
```
Expected response (TwiML XML):
```xml
<Response><Dial><Client>flutter-tester-2</Client></Dial></Response>
```

---

## Verify Deployment

```bash
# Health check
curl https://twilio-token-server.onrender.com/health

# Video token test
curl "https://twilio-token-server.onrender.com/token?type=video&room=test&identity=user1"

# Voice token test
curl "https://twilio-token-server.onrender.com/token?type=voice&identity=user1"
```

Expected response:
```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

---

## Local Development

```bash
cd docs/token_server
cp .env.example .env   # fill in your credentials
npm install
npm start
# → http://localhost:3000
```

For Android emulator use: `http://10.0.2.2:3000`  
For iOS simulator use: `http://localhost:3000`

---

## Free Tier Notes

Render free tier **spins down** after 15 minutes of inactivity.
The first request after spin-down takes ~30 seconds to respond.

To avoid cold starts, use **Render Starter** plan ($7/mo) or ping the `/health`
endpoint periodically with a cron job / UptimeRobot.
