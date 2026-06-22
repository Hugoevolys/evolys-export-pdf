# Déploiement en ligne — Evolys Export PDF

Même schéma qu'airscore : **code sur GitHub → backend sur Render + frontend sur Netlify**,
qui se déploient automatiquement à chaque push.

```
        GitHub (le code)
        /            \
   Render            Netlify
 (backend API)    (frontend web)
 Node+Python+        site statique
  Chromium           (l'URL que tu partages)
```

GitHub **stocke** le code ; Render **exécute** le backend ; Netlify **sert** le site.
GitHub seul ne peut pas faire tourner le backend (Pages = sites statiques uniquement).

---

## 0. Mettre le code sur GitHub
```bash
cd evolys-export-pdf
git init && git add . && git commit -m "Evolys export pdf"
# créer un repo vide sur github.com puis :
git remote add origin https://github.com/<toi>/evolys-export-pdf.git
git push -u origin main
```

## 1. Backend sur Render
1. render.com → **New +** → **Web Service** → connecte le repo GitHub.
2. Render détecte le **Dockerfile** (runtime = Docker). Laisser tel quel.
3. Plan : **Starter** recommandé (le Free s'endort et Chromium est lourd).
4. **Environment** → ajouter les variables :
   - `ANTHROPIC_API_KEY` = ta clé Claude
   - `ANTHROPIC_MODEL` = `claude-sonnet-4-6`
   - `CORS_ORIGIN` = (laisser `*` pour l'instant, on le restreindra à l'étape 3)
   - `PORT` = `3001`
5. **Create Web Service**. À la fin, note l'URL, ex. `https://evolys-export-pdf-api.onrender.com`.
6. Vérifie : ouvrir `…onrender.com/health` doit afficher `{"status":"ok"}`.

## 2. Frontend sur Netlify
1. netlify.com → **Add new site** → **Import from GitHub** → même repo.
2. Build : `npm run build` — Publish : `dist` (déjà dans `netlify.toml`).
3. **Site settings → Environment variables** :
   - `VITE_API_URL` = l'URL Render de l'étape 1 (sans `/` final).
4. **Deploy**. Note l'URL Netlify, ex. `https://evolys-export.netlify.app` → **c'est l'URL à partager**.

## 3. Verrouiller le CORS
Retourne dans Render → variable `CORS_ORIGIN` = ton URL Netlify exacte
(ex. `https://evolys-export.netlify.app`) → Save (redéploie tout seul).

## 4. Tester
Ouvre l'URL Netlify → upload un PDF moteur immo → remplis → génère le PDF.

---

## Mises à jour
Chaque `git push` sur `main` redéploie automatiquement Render **et** Netlify.

## Coûts
- Render Starter : ~7 $/mois (nécessaire pour Chromium ; le Free s'endort après inactivité).
- Netlify : gratuit largement suffisant.
- API Claude : à l'usage (extraction + vision par annonce).
