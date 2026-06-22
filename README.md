# Evolys — Export PDF Annonces

Transforme un PDF "moteur immo" multi-annonces en un PDF client propre :
logos d'origine retirés, coordonnées concurrentes supprimées, coût global ajouté,
coordonnées du conseiller Evolys + logo intégrés, commentaire par annonce.

➡️ **Lire `SPECS.md`** pour l'architecture complète et la liste des décisions à valider.

## Démarrage
```bash
cp .env.example .env        # renseigner ANTHROPIC_API_KEY
npm install                 # installe aussi Chromium (puppeteer) et sharp
pip install -r requirements.txt            # PyMuPDF (extraction texte + images du PDF)
npm run dev                 # front (5173) + back (3001)
```

## Flux
1. **Upload** du PDF → découpe en annonces + extraction IA. Photos source insérées **telles quelles** (aucune retouche).
2. **Infos générales** (1 fois) : client + conseiller (logo Evolys déjà intégré).
3. **Annonce par annonce** : prix net, commission, frais notaire, commentaire ; coût global en direct.
4. **Export** : un seul PDF fusionné.

## Structure
- `server/` — Express + modules : `pdfSplit` + `pdf_extract.py` (texte+images), `extract` (Claude), `notaryFees`, `pdfGenerate` (Puppeteer).
- `src/` — React + Vite : `App.tsx` (flux), `components/`, `lib/cost.ts` (calcul partagé).

## État
- Logo Evolys (SVG+PNG), charte marine #00296E, commission (grille), notaire 8%, extraction texte+images : **en place**.
- Photos : insérées telles quelles, **non modifiées** (pas de retrait de filigrane).
- Ligne "20% du montant négocié" : informative, **non ajoutée** au coût global.
- Reste : mentions légales Evolys à ajouter au PDF si besoin.
