# Scope Lens — Netlify deployment (v2 — background job version)

This package is ready to deploy as-is. It includes:
- `index.html` — the tool
- `netlify/functions/estimate-background.js` — calls Claude's API in the background, no 10-second limit
- `netlify/functions/estimate-status.js` — small function the browser checks in with every 2.5s to ask "is it ready yet?"
- `netlify.toml` — tells Netlify where the functions live
- `package.json` / `package-lock.json` — declares the `@netlify/blobs` library the functions need (Netlify installs this automatically during deploy, you don't need to do anything)

**What changed from the previous version:** the old setup made one request and waited for Claude to
finish before Netlify's 10-second function timeout cut it off — which is why big wireframe + PRD
uploads were failing with "Unexpected token '<'" even though credits still got charged. This version
kicks off the job, immediately hands control back to the browser, and the browser politely checks
back every couple seconds until the answer's ready (up to 4 minutes). No more timeout wall.

Why a server-side function exists at all: Scope Lens calls Claude's API to read the wireframe + PRD.
You can never put a real API key directly in browser JavaScript, since anyone could open dev tools
and steal it. The Netlify function keeps the key on the server side and the browser only ever talks
to your own functions.

## 1. Get an Anthropic API key

This is separate from a Claude Pro subscription — Pro is for chat usage on claude.ai and doesn't
unlock API access.

1. Go to https://console.anthropic.com and create an account (or sign in).
2. Add a payment method under **Billing** — API usage is pay-as-you-go, no separate "API plan."
3. Go to **API Keys** and create a new key. Copy it somewhere safe — you'll paste it into Netlify,
   not into the code.

## 2. Push this folder to GitHub

1. Create a new empty repo on GitHub (e.g. `scope-lens`).
2. From this folder:
   ```
   git init
   git add .
   git commit -m "Scope Lens"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/scope-lens.git
   git push -u origin main
   ```

## 3. Connect the repo to Netlify

1. Go to https://app.netlify.com and sign in (GitHub login is easiest).
2. Click **Add new site → Import an existing project**.
3. Choose GitHub, authorize Netlify, and pick your `scope-lens` repo.
4. Build settings: leave **Build command** empty and **Publish directory** as `.` — Netlify will
   read the rest from `netlify.toml`.
5. Click **Deploy site**.

## 4. Add your API key as an environment variable

1. In your new site's dashboard, go to **Site configuration → Environment variables**.
2. Add a variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: the key you copied in step 1
3. Go to **Deploys** and trigger **Trigger deploy → Clear cache and deploy site** so the function
   picks up the new variable.

## 5. Test it

Open the site URL Netlify gives you (something like `scope-lens-xyz.netlify.app`), upload a
wireframe + PRD, and run an estimate. It'll now show "still working" messages while it polls in
the background — that's expected, even for 30–60+ seconds on bigger uploads.

To confirm the functions actually deployed, visit these two URLs directly (replace with your site name):
- `https://your-site.netlify.app/.netlify/functions/estimate-background` → should say "Method Not Allowed" (that's correct — it only accepts POST)
- `https://your-site.netlify.app/.netlify/functions/estimate-status` → should say "Missing jobId" (also correct)

If either shows Netlify's 404 "Page not found" instead, the functions didn't deploy — double check
**Site configuration → Build & deploy → Build settings** has "Functions directory" set to
`netlify/functions`, and check the deploy log for a "Packaging Functions" step.

If it fails after that, check **Logs → Functions** in Netlify's left sidebar for the actual error —
it's almost always a missing or mistyped `ANTHROPIC_API_KEY` environment variable.

## 6. (Optional) Custom domain

**Domain settings → Add a domain** in Netlify if you want something like `scope-lens.yourteam.com`
instead of the default `*.netlify.app` address. Free on Netlify's free tier if you already own the
domain.

## Sharing with your team

Once deployed, anyone with the link can use the tool — there's no login built in. If you want to
restrict access, Netlify has **Site configuration → Visitor access → Password protection** (paid
plans) or you can add a simple shared password check in the function later if needed.

## Cost note

Every "Estimate hours" click costs a small amount of real API usage, billed to whoever owns the
`ANTHROPIC_API_KEY` — see the chat response for a per-estimate cost estimate. There's no per-user
limit built into this tool; if you want to cap usage (e.g. so it can't be hammered by a bot or
abused), that's a good next addition — a simple rate limit or shared-password gate in the function.
