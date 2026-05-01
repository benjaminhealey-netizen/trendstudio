# TrendStudio — Cloudflare Pages Deploy Guide

## What's in this folder

```
trendstudio/
  index.html          ← the entire app (one file)
  functions/
    claude.js         ← serverless function (proxies Anthropic API)
  README.md
```

---

## Deploy in 5 steps

### 1. Get an Anthropic API key
Go to https://console.anthropic.com → API Keys → Create Key.
Copy it somewhere safe.

### 2. Push to GitHub
Create a new repo on GitHub (can be private), then:
```bash
cd trendstudio
git init
git add .
git commit -m "TrendStudio init"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 3. Connect to Cloudflare Pages
1. Go to https://dash.cloudflare.com
2. Click **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Pick your repo
4. Build settings:
   - Framework preset: **None**
   - Build command: (leave blank)
   - Build output directory: `/` (just a slash)
5. Click **Save and Deploy**

### 4. Add your API key as an environment variable
1. Go to your new Pages project → **Settings** → **Environment Variables**
2. Click **Add variable**
   - Variable name: `ANTHROPIC_API_KEY`
   - Value: paste your key
3. Make sure it's set for **Production** (and Preview if you want)
4. Click **Save**

### 5. Redeploy
Go to **Deployments** → click the three dots on your latest deploy → **Retry deployment**.

Your site is now live at `https://YOUR-PROJECT.pages.dev` and anyone can use it!

---

## How it works

The browser calls `/claude` which hits `functions/claude.js`.
That function runs on Cloudflare's edge servers — it injects your API key
server-side so it's never exposed to users. The function calls Anthropic,
gets the response, and sends it back to the browser.

---

## Costs

- Cloudflare Pages: free (unlimited requests on the free tier)
- Anthropic API: pay per use (~$0.003 per scan/generate action)
  Add usage limits at https://console.anthropic.com to stay in budget.
