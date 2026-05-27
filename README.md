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
| `TWILIO_TWIML_APP_SID` | `APxxxxxxxxxxxxxxxx` | ✅ for voice |
| `TWILIO_CALLER_ID` | `+1xxxxxxxxxx` | optional |
| `TOKEN_TTL` | `3600` | optional |

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
2. Open your TwiML App
3. Set **Voice Configuration → Request URL** to:
   ```
   https://twilio-token-server.onrender.com/voice
   ```
4. Save

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
