# Deploiement — Estimation de loyer (Evolys)

Schema : **code sur GitHub -> backend sur Render + frontend sur Netlify**, redeployes
automatiquement a chaque push.

```
        GitHub (le code)
        /            \
   Render            Netlify
 (backend API)    (frontend web)
 Node + Chromium     site statique
                     (URL a partager)
```

## 0. Code sur GitHub
```bash
cd chasseur-immo-estimation-loyer
git init && git add . && git commit -m "Estimation loyer"
git remote add origin https://github.com/<toi>/chasseur-immo-estimation-loyer.git
git push -u origin main
```

## 1. Backend sur Render
1. render.com -> **New +** -> **Web Service** -> connecte le repo.
2. Render detecte le **Dockerfile** (runtime = Docker). Laisser tel quel.
3. Plan : **Starter** (le Free s'endort et Chromium est lourd).
4. **Environment** -> variables :
   - `ANTHROPIC_API_KEY` = ta cle Claude
   - `ANTHROPIC_MODEL` = `claude-sonnet-4-6`
   - `CORS_ORIGIN` = `*` (a restreindre a l'etape 3)
   - `PORT` = `3001`
5. **Create Web Service**. Note l'URL, ex. `https://chasseur-immo-estimation-api.onrender.com`.
6. Verifie : `…onrender.com/health` -> `{"status":"ok"}`.

## 2. Frontend sur Netlify
1. netlify.com -> **Add new site** -> **Import from GitHub** -> meme repo.
2. Build `npm run build`, publish `dist` (deja dans `netlify.toml`).
3. **Environment variables** : `VITE_API_URL` = l'URL Render (sans `/` final).
4. **Deploy**. L'URL Netlify est celle a partager.

## 3. Verrouiller le CORS
Render -> `CORS_ORIGIN` = ton URL Netlify exacte -> Save (redeploie).

## 4. Recherche web (important)
La recherche reglementaire/marche utilise l'**outil de recherche web de l'API Anthropic**
(`web_search`, dans `server/research.ts`). Il faut que la recherche web soit **activee**
pour ta cle/organisation (console.anthropic.com). La recherche web est facturee en sus
des tokens. Pour ajuster le cout, modifier `max_uses` dans `server/research.ts`.

## Mises a jour
Chaque `git push` sur `main` redeploie Render **et** Netlify.

## Couts
- Render Starter : ~7 $/mois (Chromium).
- Netlify : gratuit.
- API Claude : tokens + recherche web a l'usage.
