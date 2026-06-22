# Générateur de Business Plan — Evolys

Outil interne qui transforme un **formulaire** + des **documents uploadés** par le conseiller
en **UN seul PDF "business plan"** propre et professionnel, à la marque **Evolys**, destiné aux
**banques** pour appuyer une demande de financement immobilier.

> ⚠️ Le business plan n'est **PAS** réservé à l'investissement locatif. Il peut concerner :
> résidence principale, résidence secondaire, investissement locatif (courte ou longue durée),
> bureaux / local professionnel, local commercial, parking / box, terrain, etc.
> **C'est le formulaire qui pilote le contenu** : l'objet du financement choisi par le conseiller
> active/désactive dynamiquement les sections du PDF. Le formulaire est donc le cœur de l'outil.

> Outil frère de `evolys-export-pdf`. Même stack, même philosophie : **outil web déterministe**
> (rendu constant et pro), l'IA n'intervient que sur des étapes ciblées. Document de specs à
> donner à Claude Code pour piloter le build.

Modèle de référence (cas locatif LCD) : `Business Plan – Appartement Jouvenet` (21 pages, paysage).

---

## 1. Décision d'architecture

**Choix : outil web déterministe (style "airscore" / "evolys-export-pdf"), PAS un agent IA autonome.**

Le conseiller l'utilise pour chaque dossier bancaire ; le rendu doit être **constant, crédible et
bancable**. Un **gabarit PDF fixe + sections modulaires** garantit un rendu identique et adapté
à chaque type de projet.

L'IA (API Claude) est utilisée **comme composant ciblé**, appelé par le backend, pour :

1. **Extraction "bien"** : structurer adresse, surface, prix, DPE, type depuis l'annonce uploadée.
2. **Extraction "revenus"** (si projet avec revenus) : structurer loyers / nuitées / charges
   depuis un document d'estimation uploadé.
3. **Reformulation des textes libres** saisis par le conseiller (présentation, atouts) en français
   pro et neutre — sans rien inventer.

Tout le reste (calculs financiers, sélection des sections, génération PDF) = **code déterministe**.

---

## 2. Objet du financement = pilote du contenu

Le formulaire commence par le choix de l'**objet du financement** (`projectType`). Ce choix
définit un **profil de sections** (activées/désactivées par défaut, surchargeable manuellement).

| `projectType` | Revenus ? | Sections spécifiques activées par défaut |
|---|---|---|
| `residence_principale` | Non | Profil emprunteur & capacité, justification du choix du bien. PAS de rentabilité. |
| `residence_secondaire` | Non (ou LCD optionnel) | Idem RP ; revenus locatifs en option si location saisonnière. |
| `locatif_lcd` | Oui (nuitées) | Marché LCD, prévisionnel nuitées, rentabilité, cash-flow, projection, gestion locative, plan de sortie LLD. |
| `locatif_lld` | Oui (loyer) | Loyer mensuel, rentabilité, cash-flow, projection. |
| `bureaux` / `local_pro` | Oui ou usage propre | Si bail : loyer ; si usage propre : pas de revenus. Présentation pro du local. |
| `local_commercial` | Oui ou usage propre | Idem bureaux. |
| `parking` / `box` | Optionnel | Bloc bien simplifié (pas de DPE/pièces) ; revenus locatifs en option. |
| `terrain` | Non | Bloc bien simplifié, projet de construction en texte libre. |
| `autre` | Optionnel | Tout est manuel : le conseiller active les sections voulues. |

Règle générale :
- **Toujours présents** : page de garde, objet/présentation du projet, profil emprunteur &
  capacité de financement, présentation du bien, plan de financement, détail des chiffres,
  documents/annexes, page de contact.
- **Conditionnels (revenus)** : prévisionnel de revenus, rentabilité, cash-flow, projection,
  stratégie de gestion locative, plan de sortie. N'apparaissent que si `income.mode != 'none'`.
- **Optionnels** : atouts/contexte, marché local, partenaires, DPE (masqué si non pertinent,
  ex. parking/terrain).

Le conseiller peut **forcer** l'activation/désactivation de n'importe quelle section
(cases à cocher) — le profil par `projectType` ne fait que pré-cocher.

---

## 3. Flux utilisateur (conseiller)

```
Étape 0 — Objet du financement
   - projectType (liste ci-dessus) -> pré-configure les sections et les champs affichés.

Étape 1 — Infos générales du dossier (une seule fois)
   - Nom du projet ; structure d'acquisition (perso / SCI + nom) ; porteur(s) ;
     coordonnées de contact ; conseiller Evolys. (Logo/charte Evolys côté serveur.)

Étape 2 — Profil emprunteur & capacité  (clé pour la banque, tous projets)
   - Revenus mensuels du foyer, charges/crédits en cours, apport disponible.
   - Calcul auto : taux d'endettement, reste à vivre (indicatifs, modifiables).

Étape 3 — Le bien
   - Upload de l'annonce (PDF / image) -> Claude extrait adresse, type, surface, prix, DPE…
   - Photos extraites et rattachées (insérées telles quelles).
   - Champs adaptés au projectType (ex. pas de DPE/pièces pour un parking).
   - Saisie libre : présentation du projet, atouts (selon sections activées).

Étape 4 — Financement
   - Prix d'achat net (pré-rempli depuis l'annonce, modifiable)
   - Frais de notaire : SAISIS dans le formulaire (€ OU %, demandé au conseiller ;
     valeur par défaut indicative dans Settings, modifiable). Assiette = prix d'achat net.
   - Travaux / aménagement (€), honoraires / autres frais (€), apport (€).
   - Durée (mois), taux d'intérêt (%), taux d'assurance (%).
   -> "Coût total" + "Mensualité (prêt + assurance)" en direct.
   -> Option 2 scénarios : "Situation idéale" (sans apport) / "Situation envisageable" (avec apport).

Étape 5 — Revenus & rentabilité  (UNIQUEMENT si projet avec revenus)
   - Upload d'un document d'estimation (optionnel) -> Claude extrait les hypothèses.
   - LCD : nuitée creuse/pointe, taux de remplissage, nuitées/mois.
     LLD / commercial : loyer mensuel.
   - Charges d'exploitation paramétrables (gestion/conciergerie %, taxe foncière, PNO, copro…).
   -> Revenu mensuel/annuel, rendement brut/net, cash-flow, projection N années : en direct.

Étape 6 — Annexes & documents
   - Liste / upload des pièces (diagnostics, compromis, situation SCI, justificatifs revenus…).
     Chaque pièce : listée sur la page "Documents", et/ou concaténée en annexe du PDF.

Étape 7 — Export
   - UN SEUL PDF (page de garde -> sections actives -> annexes), téléchargeable.
```

---

## 4. Modèle de données (`src/types/index.ts`)

```ts
export type ProjectType =
  | 'residence_principale' | 'residence_secondaire'
  | 'locatif_lcd' | 'locatif_lld'
  | 'bureaux' | 'local_pro' | 'local_commercial'
  | 'parking' | 'terrain' | 'autre';

export type SectionId =
  | 'cover' | 'project' | 'borrower' | 'property' | 'highlights' | 'market'
  | 'financing' | 'figures' | 'income' | 'profitability' | 'projection'
  | 'management' | 'exitPlan' | 'documents' | 'partners' | 'contact';

export interface DealInfo {
  projectType: ProjectType;
  projectName: string;
  ownerStructure: 'personnel' | 'sci';
  sciName?: string;
  owners: { firstName: string; lastName: string }[];
  contactPhone: string;
  contactEmail: string;
  advisor: { firstName: string; lastName: string };
  date: string;                   // ISO
}

// Profil emprunteur — clé pour la banque (tous projets)
export interface Borrower {
  monthlyHouseholdIncome: number; // revenus mensuels nets du foyer
  currentMonthlyDebts: number;    // crédits/charges en cours
  availableSavings: number;       // apport disponible
  // calculés (indicatifs, modifiables) :
  // debtRatio = (currentMonthlyDebts + futureLoanPayment) / income
  // remaining = income - currentMonthlyDebts - futureLoanPayment
  notes?: string;
}

export interface Property {
  address: string; city: string; postalCode: string;
  type: string;                   // appartement, bureaux, parking…
  surfaceM2?: number;             // optionnel (terrain : surface terrain)
  rooms?: number;                 // masqué si non pertinent
  dpe?: string; ges?: string;     // masqués si non pertinent
  purchasePrice: number;
  description: string;            // reformulée
  highlights: string[];
  photos: string[];
}

export interface Financing {
  purchasePrice: number;
  notaryFees: Money;              // saisi (€ ou %), assiette = purchasePrice
  works: number;
  otherFees: number;
  downPayment: number;
  durationMonths: number;
  interestRate: number;           // % annuel
  insuranceRate: number;          // % annuel sur capital initial
}

// Revenus — OPTIONNEL, seulement si le projet en génère
export interface Income {
  mode: 'none' | 'lcd' | 'lld' | 'commercial';
  // LCD
  nightlyLow?: number; nightlyHigh?: number; nightlyAvg?: number;
  occupancyRate?: number; nightsPerMonth?: number;
  // LLD / commercial
  monthlyRent?: number;
  // charges d'exploitation (annuelles sauf gestion en %)
  managementRatePct?: number;     // gestion/conciergerie % des revenus
  propertyTax?: number; insurancePNO?: number;
  coOwnershipCharges?: number; accounting?: number; misc?: number;
  projectionYears: number;
  rentIndexationPct?: number;     // indexation annuelle, défaut 0
}

export interface Attachment { label: string; filePath: string; includeInPdf: boolean; }
export interface Money { mode: 'percent' | 'amount'; value: number; }

export interface BusinessPlan {
  deal: DealInfo;
  enabledSections: SectionId[];   // pré-rempli selon projectType, surchargeable
  borrower: Borrower;
  property: Property;
  financingScenarios: { label: string; financing: Financing }[];
  income?: Income;                // absent si mode 'none'
  attachments: Attachment[];
  settings: Settings;
}
```

`server/sections.ts` expose `defaultSections(projectType): SectionId[]` qui applique le tableau
du §2. Le PDF n'affiche que les sections présentes dans `enabledSections`.

---

## 5. Calculs financiers (déterministes — `server/finance.ts`)

> ⚠️ Formules **validées sur le modèle Jouvenet** : prêt 150 600 € / 240 mois / 3,4 % /
> assurance 0,30 % → mensualité totale **903,35 €** (865,70 prêt + 37,65 assurance).
> Avec 15 000 € d'apport (prêt 135 600 €) → **813,38 €**. Les deux retrouvés à l'euro.

### 5.1 Coût total & montant emprunté
```ts
function totalCost(f: Financing): number {
  const notary = f.notaryFees.mode === 'percent'
    ? f.purchasePrice * f.notaryFees.value / 100
    : f.notaryFees.value;
  return f.purchasePrice + notary + f.works + f.otherFees;
}
function loanAmount(f: Financing): number {
  return Math.max(0, totalCost(f) - f.downPayment);
}
```

### 5.2 Mensualité (prêt amortissable + assurance)
```ts
function monthlyPayment(f: Financing) {
  const P = loanAmount(f);
  const n = f.durationMonths;
  const r = f.interestRate / 100 / 12;
  const principal = r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
  const insurance = P * (f.insuranceRate / 100) / 12; // sur capital initial
  return { principal, insurance, total: principal + insurance };
}
```

### 5.3 Capacité d'emprunt (profil emprunteur)
```ts
function borrowerMetrics(b: Borrower, futureMonthlyPayment: number) {
  const debtRatio = (b.currentMonthlyDebts + futureMonthlyPayment) / b.monthlyHouseholdIncome;
  const remaining = b.monthlyHouseholdIncome - b.currentMonthlyDebts - futureMonthlyPayment;
  return { debtRatio, remaining }; // affichés en %, € (indicatifs)
}
```

### 5.4 Rentabilité & cash-flow  (seulement si income.mode != 'none')
```ts
function incomeMetrics(i: Income, totalCost: number, monthlyTotal: number) {
  const monthlyRevenue = i.mode === 'lcd'
    ? (i.nightlyAvg ?? ((i.nightlyLow! + i.nightlyHigh!) / 2)) * (i.nightsPerMonth ?? 0)
    : (i.monthlyRent ?? 0);
  const annualRevenue = monthlyRevenue * 12;
  const mgmt = annualRevenue * (i.managementRatePct ?? 0) / 100;
  const annualCharges = mgmt + (i.propertyTax ?? 0) + (i.insurancePNO ?? 0)
                      + (i.coOwnershipCharges ?? 0) + (i.accounting ?? 0) + (i.misc ?? 0);
  const grossYield = annualRevenue / totalCost;
  const netYield   = (annualRevenue - annualCharges) / totalCost;
  const monthlyCashflow = monthlyRevenue - monthlyTotal - annualCharges / 12;
  return { monthlyRevenue, annualRevenue, annualCharges, grossYield, netYield, monthlyCashflow };
}
```
> Modèle Jouvenet : 72,5 €/nuit × 21 = **1 522,5 €/mois** (18 270 €/an) ; brut ≈ **12,1 %**.

### 5.5 Projection sur N années
Tableau année par année : revenus (indexation `rentIndexationPct`, défaut 0 %), charges,
mensualités, cash-flow cumulé, capital restant dû. Rendu en graphique.

---

## 6. Gabarit PDF final

Format **paysage A4 (16:9)** rendu en HTML/CSS via Puppeteer. **Charte 100 % Evolys**
(valeurs reprises du projet `evolys-export-pdf`) :

- Couleurs : marine `#00286E` (principal), marine foncé `#001B4A`, bleu clair `#6DCAFF`,
  bleu très clair `#DDF3FF`, orange `#FF9A41` (accent). Texte `#1B2733`, gris `#44566B`,
  fonds clairs `#F7F9FB` / `#E3E9EE`.
- Polices : **Quattrocento** (titres) + **Quattrocento Sans** (texte), via Google Fonts.
- Logo Evolys (SVG + PNG HD) déjà dans `evolys-export-pdf/server/assets/` — à réutiliser.
- Mise en page sobre, aérée ; gros titres marine sur fond clair (ou blanc sur aplat marine).

### Catalogue de sections (rendues seulement si dans `enabledSections`)

```
cover         Page de garde — photo, nom du projet, objet du financement, structure. [toujours]
project       Présentation / objet du projet (texte reformulé).                       [toujours]
borrower      Profil emprunteur & capacité — revenus, charges, apport, endettement,
              reste à vivre.                                                            [toujours]
property      Présentation du bien — photos, plan, localisation, (DPE/GES si pertinent).[toujours]
highlights    Atouts / contexte du projet.                                             [option]
market        Marché & positionnement (ex. LCD vs LLD, marché local).                  [locatif]
financing     Plan de financement — coût total, emprunt, durée, taux, MENSUALITÉ
              (1 ou 2 scénarios).                                                       [toujours]
figures       Les chiffres — détail du coût (achat, notaire, travaux, total).          [toujours]
income        Prévisionnel de revenus — nuitées/loyer, taux de remplissage.            [si revenus]
profitability Rentabilité & cash-flow — rendement brut/net, cash-flow mensuel.         [si revenus]
projection    Projection financière — graphique sur N années.                          [si revenus]
management    Stratégie de gestion locative — gestion/conciergerie, automatisation.    [locatif]
exitPlan      Plan de sortie — revenus en LLD (estimation).                            [locatif lcd]
documents     Documents nécessaires — liste des pièces jointes.                        [toujours]
partners      Nos partenaires — apporteurs, diagnostiqueur, notaire…                   [option]
contact       Page de contact — coordonnées du porteur / conseiller Evolys.            [toujours]

[Annexes]     Documents uploadés (includeInPdf) concaténés (pdf-lib).
```

Chaque section lit ses données dans `BusinessPlan` et est **masquée automatiquement** si absente
de `enabledSections` ou si ses données sont vides.

---

## 7. Backend — modules & endpoints

Stack : Node + Express + TypeScript (identique à `evolys-export-pdf`).

| Module | Rôle |
|---|---|
| `server/index.ts` | API Express : upload, extract, generate, settings. |
| `server/pdfExtract.py` | Extraction texte + images des documents uploadés (PyMuPDF). |
| `server/extract.ts` | Claude : structure bien + revenus, reformule textes. |
| `server/sections.ts` | `defaultSections(projectType)` : profil de sections par objet. |
| `server/finance.ts` | Calculs (coût, mensualité, capacité, rentabilité, projection). |
| `server/pdfGenerate.ts` | Gabarit HTML → PDF (Puppeteer, paysage A4), sections modulaires. |
| `server/pdfMerge.ts` | Concatène business plan + annexes (pdf-lib). |
| `server/assets/` | Logo Evolys, polices, visuels de charte. |

### Endpoints
```
POST /api/extract-property  { file }              -> Property (pré-remplie) + photos
POST /api/extract-income    { file }              -> Income (hypothèses pré-remplies)
POST /api/preview-finance   { financing, income?, borrower } -> métriques calculées (live)
GET  /api/sections/:type    -> SectionId[] par défaut pour ce projectType
POST /api/generate          { BusinessPlan }      -> application/pdf (PDF final fusionné)
GET  /api/settings          -> Settings
PUT  /api/settings          -> Settings
```

---

## 8. Prompts IA (gabarits)

### Extraction bien (`extract.ts`)
```
Tu reçois le texte brut d'une annonce immobilière. Renvoie un JSON strict conforme au type
Property. Règles : ne rien inventer (null si absent) ; SUPPRIME les coordonnées d'agence
concurrente ; uniformise la description (orthographe, ton pro et neutre). Réponds UNIQUEMENT
par le JSON.
```

### Extraction revenus (`extract.ts`)
```
Tu reçois un document estimant les revenus locatifs. Extrais en JSON (type Income) :
prix/nuitée, taux de remplissage, nuitées/mois, ou loyer mensuel, et les charges identifiées.
Ne rien inventer ; null si absent. Réponds UNIQUEMENT par le JSON.
```

### Reformulation textes libres (`extract.ts`)
```
Reformule ce texte en français professionnel, neutre et fluide, sans changer les faits ni les
chiffres, sans rien ajouter. Réponds UNIQUEMENT par le texte reformulé.
```

---

## 9. Stack & démarrage

- Frontend : React 18 + Vite + TypeScript + Tailwind.
- Backend : Express + TypeScript (tsx).
- IA : `@anthropic-ai/sdk`. PDF : `puppeteer` + `pdf-lib`. Extraction : `PyMuPDF`. Images : `sharp`.

```bash
cp .env.example .env        # ANTHROPIC_API_KEY
npm install
pip install -r requirements.txt
npm run dev                 # front + back en parallèle
```
> Réutilise les dépendances déjà présentes dans `evolys-export-pdf/package.json`.

---

## 10. Décisions prises / points à valider

DÉCIDÉ :
- Outil déterministe ; IA = extraction + reformulation uniquement.
- **Le formulaire pilote tout** : `projectType` configure les sections (locatif, RP, RS,
  bureaux, local commercial, parking, terrain, autre). Sections surchargeables manuellement.
- Sections "revenus/rentabilité/projection/gestion/plan de sortie" = **conditionnelles**
  (uniquement si le projet génère des revenus).
- Profil emprunteur & capacité de financement = section **toujours présente** (clé banque).
- Marque = **Evolys** (charte marine #00286E + accent #FF9A41, Quattrocento, logo Evolys).
- Frais de notaire **saisis dans le formulaire** (€ ou %), assiette = prix d'achat net.
- Mensualité = prêt amortissable + assurance sur capital initial (validé sur le modèle).
- Photos insérées telles quelles ; annexes concaténées (option par document).

À VALIDER avec Axel :
1. Liste définitive des `projectType` et leur profil de sections par défaut.
2. Seuils indicatifs : taux d'endettement max affiché (ex. 35 %), reste à vivre.
3. Indexation des loyers dans la projection (défaut 0 %).
4. Valeurs par défaut des charges d'exploitation (gestion %, PNO, taxe foncière…).
5. Mentions légales / RSAC du conseiller à faire figurer sur le PDF ?
