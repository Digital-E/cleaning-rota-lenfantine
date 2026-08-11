# Cleaning Rota — L'Enfantine

This is a standalone copy of the cleaning rota app, set up so it runs entirely
on its own accounts and data — nothing here is connected to any other
deployment of this app.

## Stack

- React + Vite frontend
- Vercel serverless function (`api/state.js`) for the backend
- Upstash Redis for storing the rota state
- Optional: Google Calendar sync via a Google service account

## First-time setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create your own Upstash Redis database**
   - In your Vercel dashboard: Storage → Create Database → Redis (this
     auto-creates a linked Upstash DB), or go directly to
     https://console.upstash.com
   - Copy the REST URL and REST token into `.env.local` (see
     `.env.local.example`)

3. **(Optional) Set up Google Calendar sync**
   - Create a Google Cloud project: https://console.cloud.google.com
   - Enable the "Google Calendar API"
   - Create a Service Account → generate a JSON key
   - Share the target Google Calendar with the service account's email
     (grant "Make changes to events")
   - Fill in `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
     `GOOGLE_PRIVATE_KEY` in `.env.local`
   - If you skip this, the app still works — it just won't sync to a calendar

4. **Copy the example env file and fill in your values**
   ```
   cp .env.local.example .env.local
   ```

5. **Run locally**
   ```
   npm run dev
   ```

## Deploying

1. Push this repo to your own GitHub account.
2. Import it into your own Vercel account (https://vercel.com/new).
3. Add the same environment variables from `.env.local` in the Vercel
   project's Settings → Environment Variables.
4. Deploy.

Every account involved (GitHub, Vercel, Upstash, Google Cloud) should be
yours — that's what keeps this copy fully independent of the original app.
