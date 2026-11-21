# Setup: accounts, keys and deployment

The app runs locally with **no accounts** (embedded database, Gemini off). Each step below turns on a real service. They need your own accounts, so you do them; I wire up the code.

Put secrets in `server/.env` (copy `server/.env.example`). `.env` files are git-ignored. Avoid pasting keys into chat.

Check each sponsor's full prize rules on the MLH prizes page ("Read more") before you commit.

---

## 1. Gemini API key → photo check-ins + quest tips

1. Go to **aistudio.google.com**, sign in, click **Get API key → Create API key**.
2. In `server/.env`:
   ```
   GEMINI_API_KEY=your-key
   GEMINI_MODEL=gemini-flash-lite-latest
   ```
3. Restart the server. Profile should say "Gemini photo check: on", quests get a **+ Photo** button, and the Passport's next-up card says "local tip by Gemini".
4. Optional: set a budget alert in Google Cloud billing.

Why the Lite model: new accounts can't use `gemini-2.5-flash` anymore, and `gemini-flash-latest` took ~30 s per reply (it "thinks" first). `gemini-flash-lite-latest` answers in under a second and handles photos. If a model name is ever rejected, check the model list in AI Studio and change `GEMINI_MODEL`.

## 2. Tiger Data → shared database

1. Open the MLH Tiger Data link, create an account, redeem any MLH credit.
2. Create a **service** (Postgres) in a US East region.
3. Copy the connection string from the service's connection info.
4. In `server/.env`:
   ```
   DATABASE_URL=postgres://...your connection string...
   ```
5. Restart the server. It connects with encryption the way Tiger's `sslmode=require` intends: encrypted, certificate not checked, same as `psql`. Set `DB_SSL_VERIFY=true` to require full certificate checks. It creates the tables itself. If TimescaleDB is available (it is on Tiger), `checkins` becomes a **hypertable** partitioned by check-in time; the log says `[db] checkins is a TimescaleDB hypertable`. Profile shows "Database: Tiger Data / Postgres".

## 3. Domain → GoDaddy Registry

1. MLH prizes page → GoDaddy Registry → **Log In To Claim Code**.
2. Register a name (ideas: `outofbounds`, `popthebubble`, `outofboundsbos`) on an ending the code covers.
3. After step 4 you'll add one DNS **A record**: host `@` (or `app`) → your Vultr server's IP.

## 4. Deploy to Vultr (one small server runs everything)

Real GPS and the camera only work on **https** sites, so deploy before testing on phones outside demo mode.

1. Vultr account → redeem the MLH credit → **Deploy new server**: Cloud Compute, smallest plan, **Ubuntu 24.04**, a US East location. Add your SSH key.
2. SSH in (`ssh root@YOUR_IP`) and install Node 24 and Caddy:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs git
   apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
   apt-get update && apt-get install -y caddy
   ```
3. Copy the project up (from your PC, in this folder; skips node_modules):
   ```powershell
   scp -r shared server web root@YOUR_IP:/opt/oob/
   ```
   (Or push to GitHub and `git clone` on the server.)
4. On the server, build and configure:
   ```bash
   cd /opt/oob/web && rm -rf node_modules && npm ci && npm run build
   cd /opt/oob/server && rm -rf node_modules && npm ci
   cp .env.example .env && nano .env     # DATABASE_URL, GEMINI_API_KEY, ALLOW_DEMO
   ```
5. Run it as a service:
   ```bash
   cat > /etc/systemd/system/oob.service <<'EOF'
   [Unit]
   Description=Out of Bounds
   After=network.target
   [Service]
   WorkingDirectory=/opt/oob/server
   ExecStart=/usr/bin/npm start
   Restart=always
   Environment=NODE_ENV=production
   [Install]
   WantedBy=multi-user.target
   EOF
   systemctl daemon-reload && systemctl enable --now oob
   ```
6. HTTPS with your domain (Caddy gets the certificate automatically):
   ```bash
   echo 'yourdomain.example {
     reverse_proxy localhost:8787
   }' > /etc/caddy/Caddyfile && systemctl reload caddy
   ```
7. Open `https://yourdomain.example` on your phone → **Add to Home Screen**.

Updating later: copy the changed files up again, rebuild `web` if it changed, then `systemctl restart oob`.

## 5. Optional: MBTA API key

Only needed if we add live "next train" times. Free key at api-v3.mbta.com.

---

## Notes

- **ALLOW_DEMO:** keep `true` for the stage demo (check in without GPS, simulate rivals, reset turf). Set `false` for real play.
- **Phones on your Wi-Fi (before deploying):** run both dev servers, open `http://<your-PC's-IP>:5173`, keep demo mode on.
- **OneDrive:** the project folder syncs `node_modules`. If OneDrive slows down, pause syncing or move the project outside OneDrive. The local dev database is already kept outside it.
- **Local dev database:** `~/.out-of-bounds/pglite`. Delete that folder to start fresh.
