# Chasseur Immo — Estimation de loyer (location longue duree)

Outil interne qui genere un **PDF d'estimation de loyer propre** (charte Evolys),
avec statut reglementaire (zone tendue / encadrement), plafond legal le cas echeant,
loyer moyen + fourchette basse/haute, methodologie et sources.

Architecture **hybride** : Claude fait la recherche (zone tendue, encadrement, loyers
de marche) -> le conseiller **valide / corrige** les chiffres -> le PDF est genere.

## Demarrage
```bash
cp .env.example .env          # renseigner ANTHROPIC_API_KEY
npm ci                        # install reproductible (lockfile) + Chromium (puppeteer)
npm run dev                   # front (5173) + back (3001)
```

## Flux (generation directe)
1. **Fiche du bien** : le conseiller saisit adresse, surface, typologie, meuble, epoque, DPE…
2. **Recherche IA** (`/api/estimate`) : Claude verifie zone tendue + encadrement via
   simulateurs officiels, croise >= 3 sources de marche, renvoie un `EstimationData`.
3. **Generation** (`/api/generate`) : enchaine automatiquement -> un seul PDF telechargeable,
   2 variantes automatiques :
   - **encadre** (ex. Lyon) : ajoute la grille des plafonds legaux par epoque.
   - **libre** (ex. Rouen) : pas de plafond, tableau de references de prix.

> Pas d'etape de relecture manuelle : la fiche declenche recherche + generation d'un coup.
> L'avertissement du PDF rappelle de verifier les plafonds legaux sur le simulateur officiel.
> (`EstimationReview` reste dans le code, non importe, pour reactiver une relecture si besoin.)

## Tester le rendu PDF sans appeler l'API
```bash
npm run test:pdf              # genere server/tmp/test_lyon_encadre.pdf et test_rouen_libre.pdf
```

## Structure
- `server/` — Express : `research.ts` (Claude + recherche web), `prompt.ts` (prompt + schema),
  `pdfGenerate.ts` (HTML -> PDF via Puppeteer, 2 variantes), `index.ts` (routes), `sampleData.ts` (jeux de test).
- `src/` — React + Vite : `PropertyForm` (fiche), `App.tsx` (flux direct recherche -> PDF),
  `EstimationReview` (relecture editable, conserve mais non utilise dans le flux actuel).

## Notes
- Modele : utiliser un modele Anthropic avec **recherche web** active (`web_search`).
- Les **plafonds legaux** ont une valeur juridique : l'etape de verification humaine est essentielle.
- Voir `SPECS.md` pour le detail des decisions, `PROMPT.md` pour le prompt, `DEPLOY.md` pour la mise en ligne (Render + Netlify).
- Recherche web : activable via `WEB_SEARCH` et `WEB_SEARCH_MAX_USES` (.env).
- **Install** : garder `package-lock.json` et privilegier `npm ci`. `tsx` (esbuild 0.28) et
  `vite` (esbuild 0.25) cohabitent ; un `npm install` qui re-resoud sans lockfile peut hoister
  esbuild et casser Vite (« Host version does not match binary version »). `npm ci` reproduit
  l'arborescence imbriquee correcte.
