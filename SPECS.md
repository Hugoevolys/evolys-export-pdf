# Evolys – Export PDF Annonces

Outil interne Evolys qui transforme un PDF "moteur immo" (multi-annonces) en un PDF
client propre et professionnel : logos d'origine retirés, coordonnées concurrentes
supprimées, coût global ajouté, coordonnées du conseiller Evolys intégrées, commentaire
par annonce.

> Document de specs à donner à Claude Code pour piloter le build. Le scaffold de code
> correspondant est déjà présent dans ce dossier (voir `README.md`).

---

## 1. Décision d'architecture

**Choix : outil web déterministe (style "airscore"), PAS un agent IA autonome.**

Pourquoi : le conseiller utilise l'outil tous les jours et le rendu doit être **constant
et pro**. Un agent autonome improvise la mise en page à chaque exécution → résultat non
reproductible. Un outil web avec un **gabarit PDF fixe** garantit un rendu identique.

L'IA (API Claude) est utilisée **comme composant ciblé**, appelé par le backend, pour 3
étapes "intelligentes" seulement :

1. **Extraction** : structurer les données de chaque annonce depuis le texte du PDF.
2. **Nettoyage texte** : uniformiser/nettoyer les descriptions, retirer le texte
   concurrent (prix publié, coordonnées agent, mentions RSAC/SAFTI…).
3. **Vision photos** : détecter sur les photos les logos concurrents, noms d'agent,
   coordonnées incrustées → fournir les zones (bounding boxes) à effacer.

Tout le reste (calcul du coût global, gabarit, fusion des annonces, génération PDF) =
**code déterministe**, plus fiable et moins cher.

---

## 2. Flux utilisateur (conseiller)

```
Étape 1 — Upload
   Le conseiller dépose le PDF moteur immo (multi-annonces).
   -> Backend découpe le PDF en annonces (1 page texte + N pages photos chacune).
   -> Claude extrait les données structurées de chaque annonce.

Étape 2 — Infos générales (SAISIES UNE SEULE FOIS)
   - Nom du client
   - Prénom du client
   - Nom du conseiller
   - Prénom du conseiller
   - Téléphone du conseiller
   - Email du conseiller
   (Logo Evolys = déjà stocké côté serveur, pas à ressaisir.)

Étape 3 — Annonce par annonce (RÉPÉTÉ POUR CHAQUE ANNONCE)
   Pour chaque annonce, le conseiller voit les données extraites + les photos nettoyées
   et renseigne :
   - Commission Evolys (€ ou %, valeur par défaut paramétrable)
   - Frais de notaire (auto, % paramétrable, modifiable)
   - Prix d'achat net (pré-rempli depuis l'extraction, modifiable)
   - Commentaire libre du conseiller
   - Validation des photos nettoyées (re-traiter si besoin)
   -> Le "coût global" est recalculé en direct.

Étape 4 — Export
   L'outil génère UN SEUL PDF regroupant toutes les annonces (Annonce 1, 2, 3…),
   avec page de garde au nom du client + coordonnées conseiller + logo Evolys.
```

---

## 3. Modèle de données

Voir `src/types/index.ts` pour les types complets (GeneralInfo, Listing, ListingPhoto,
Detection, Settings).

### Calcul du coût global

```ts
function computeGlobalCost(l: Listing) {
  const commission = l.commission.mode === 'percent'
    ? l.netSellerPrice * l.commission.value / 100
    : l.commission.value;

  const base = l.netSellerPrice + commission; // assiette frais de notaire (à valider)
  const notary = l.notaryFees.mode === 'percent'
    ? base * l.notaryFees.value / 100
    : l.notaryFees.value;

  return {
    netSellerPrice: l.netSellerPrice,
    commission,
    notary,
    total: l.netSellerPrice + commission + notary,
  };
}
```

> A VALIDER avec Axel : l'assiette des frais de notaire (prix net seul, ou prix +
> commission ?) et le taux exact ancien/neuf. Valeurs par défaut paramétrables.

---

## 4. Backend – modules

Stack : Node + Express + TypeScript (identique à airscore).

| Module | Rôle |
|---|---|
| `server/index.ts` | API Express : endpoints upload / clean-photo / generate / settings. |
| `server/pdfSplit.ts` | Découpe le PDF en annonces, extrait texte + images par page. |
| `server/extract.ts` | Appelle Claude pour structurer chaque annonce + nettoyer le texte. |
| `server/photoClean.ts` | Vision (Claude) -> bbox -> masque -> inpainting (ou crop en repli). |
| `server/notaryFees.ts` | Calcul coût global (cf. §3). |
| `server/pdfGenerate.ts` | Gabarit HTML -> PDF via Puppeteer/Chromium. |
| `server/assets/evolys-logo.png` | Logo Evolys (à fournir par Axel). |

### Endpoints

```
POST /api/upload      -> { uploadId, listings: Listing[] (pré-remplies) }
POST /api/clean-photo -> { cleanedPath, detections }   (re-traiter une photo)
POST /api/generate    -> application/pdf  (le PDF final fusionné)
GET  /api/settings    -> Settings
PUT  /api/settings    -> Settings
```

---

## 5. Photos

Décision : **les photos source sont insérées telles quelles, sans aucune modification.**
On ne retire pas les filigranes/logos concurrents (retouche écartée pour raisons légales).
`pdf_extract.py` extrait les images de chaque page ; elles sont rattachées à l'annonce et
affichées dans le PDF final sans traitement.

## 6. Prompts IA (gabarits)

### Extraction + nettoyage texte (`extract.ts`)

```
Tu reçois le texte brut d'UNE annonce immobilière issue d'un agrégateur.
Renvoie un JSON strict conforme au schéma Listing.
Règles :
- SUPPRIME toute coordonnée d'agent/agence concurrente (nom, tél, email, RSAC, SAFTI…).
- SUPPRIME le prix de vente publié (il sera ressaisi). Mets-le dans netSellerPrice
  comme valeur de départ, mais ne le laisse PAS dans la description.
- Uniformise la description : orthographe, ponctuation, ton professionnel et neutre.
- Ne rien inventer ; laisser null si absent.
Réponds UNIQUEMENT par le JSON.
```

### Détection vision (`photoClean.ts`)

```
Analyse cette photo d'annonce immobilière. Identifie TOUTES les zones à supprimer :
logos d'agence (notamment SAFTI), noms d'agents, numéros, emails, filigranes, bandeaux
promotionnels. Pour chacune, renvoie un JSON :
[{ "label": "...", "bbox": [x,y,w,h], "confidence": 0-1 }]
Coordonnées en pixels, origine en haut à gauche. Réponds UNIQUEMENT par le JSON.
```

---

## 7. Gabarit PDF final

Généré en HTML/CSS puis rendu par Puppeteer (format A4).

```
[Page de garde]
   Logo Evolys
   "Sélection de biens pour M./Mme {client}"
   Conseiller : {prénom nom} — {tél} — {email}
   Date

[Pour chaque annonce]
   En-tête : "Annonce N — {title}"
   Galerie photos nettoyées
   Caractéristiques (surface, pièces, DPE/GES, features…)
   Description uniformisée
   ── Coût global ──
      Prix d'achat net        : {netSellerPrice} €
      Commission Evolys       : {commission} €
      Frais de notaire (est.) : {notary} €
      ───────────────────────
      COÛT GLOBAL             : {total} €
   Commentaire du conseiller : {advisorComment}
   Pied de page : coordonnées conseiller + logo Evolys
```

---

## 8. Stack & démarrage

- Frontend : React 18 + Vite + TypeScript + Tailwind (comme airscore).
- Backend : Express + TypeScript (tsx).
- IA : `@anthropic-ai/sdk`.
- PDF : `puppeteer`. Découpe/extraction PDF : `pdfjs-dist` (+ `mupdf` ou `pdf-lib`).
- Images : `sharp` (masques, crop, redimension).

```bash
cp .env.example .env      # ajouter ANTHROPIC_API_KEY (+ clé inpainting si applicable)
npm install
npm run dev               # front + back en parallèle
```

---

## 9. Décisions prises / points restants

DÉCIDÉ :
- Logo Evolys : fourni (PDF vectoriel) -> extrait en SVG + PNG HD transparent dans `server/assets/`. OK.
- Charte Figma officielle appliquée :
  - Couleurs : marine #00286E (principal), bleu clair #6DCAFF, bleu très clair #DDF3FF, orange #FF9A41 (accent).
  - Polices : Quattrocento (titres) + Quattrocento Sans (texte), via Google Fonts. OK.
- Commission : mandat simple 4% TTC (plancher 5 000 €) / exclusif 3% TTC (plancher 4 000 €). OK.
- Frais de notaire : 8% par défaut (ancien), 3% (neuf), assiette = prix net. OK.
- Photos : insérées telles quelles, aucune retouche (raison légale). OK.
- Extraction des images du PDF moteur immo : implémentée (pdf_extract.py), testée sur l'exemple (4 annonces). OK.

DÉCIDÉ (suite) :
- "20% du montant négocié" : AFFICHÉ sur le PDF (ligne informative), NON ajouté au coût global.
- Page de garde au nom du client : CONSERVÉE.

RESTE À VALIDER :
1. Mentions légales Evolys (n° RSAC du conseiller, statut EI…) à faire figurer sur le PDF ?
