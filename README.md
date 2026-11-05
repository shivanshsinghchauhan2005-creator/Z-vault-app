# Private Safe

- `www/` – app screens (index.html, styles.css, app.js). Currently a local prototype (data in localStorage).
- `backend/` – Node.js API (accounts, Gmail-ID codes, privacy password, encrypted files). See backend/.env.example.
- `capacitor.config.json` – wraps `www/` as an Android app.

## Build the Android app
1. Install Node 20+, Android Studio.
2. `npm install`  then  `npx cap add android`  then  `npx cap sync android`
3. `npx cap open android` -> in Android Studio set compileSdk/targetSdk to 36, then Build > Generate Signed App Bundle (.aab).

## Run the backend
`cd backend && npm install && cp .env.example .env` (fill in values) `&& npm start`
Host it on any HTTPS server (Render, Railway, a VPS). Then point app.js at its URL.
