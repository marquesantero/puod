# PUOD Cookie Bridge (Chrome Extension)

This extension reads browser cookies for a chosen domain and sends them to a PUOD integration using the authenticated API.

## Why this exists

Reading Chromium cookie databases directly is fragile in production because the browser keeps the SQLite file locked. The extension avoids that by using the browser Cookie API with explicit user consent.

## Load in Chrome / Edge / Vivaldi

1) Open `chrome://extensions`.
2) Enable **Developer mode**.
3) Click **Load unpacked**.
4) Select `D:\trabalho\pessoal\puod\tools\puod-cookie-extension`.

## Usage (dev)

1) Open the PUOD app in a tab (localhost).
2) Open the extension popup.
3) Set:
   - **API Base URL** (default `http://localhost:5278`)
   - **Integration ID**
   - **Cookie Domain** (auto-filled from current tab)
4) Click **Use token from tab** (reads `localStorage.accessToken`).
5) Click **Send cookies**.

## Notes

- The extension only stores basic settings (API base URL, integration ID, domain).
- The access token stays in memory only.
- You can point the base URL to production API hosts as needed.
- The content script currently runs on `http://localhost:*` and `http://127.0.0.1:*`. Update `manifest.json` for production domains.
