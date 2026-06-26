// Types partages frontend <-> backend.
// EstimationData est LE contrat : la recherche Claude le produit, le
// conseiller le valide/corrige, puis pdfGenerate le rend en PDF.

/** Saisie minimale du conseiller (la "fiche de renseignements"). */
export interface PropertyInput {
  // Indispensables (*)
  address: string;            // n + voie, ex "20 Rue Bourget"
  postalCode: string;         // "69009"
  city: string;               // "Lyon"
  surface: number;            // m2
  rooms: number;              // T3 -> 3
  bedrooms: number;
  furnished: boolean;         // meuble ?
  constructionEpoch: string;  // "av.1946" | "1946-1970" | "1971-1990" | "1991-2005" | "ap.2005" | "1998"
  floor: string;              // "2e" ; "RDC"
  elevator: boolean;
  dpe: string;                // A..G
  // Qualitatives (facultatives)
  condition?: string;         // neuf / bon / a rafraichir / travaux
  exterior?: string;          // balcon, terrasse, jardin...
  annexes?: string;           // cave, parking...
  kitchen?: string;           // equipee / amenagee / nue
  bathrooms?: number;
  heating?: string;           // individuel/collectif, energie
  charges?: number;           // provision charges EUR/mois
  // Contexte
  leaseType?: string;         // meuble 1 an / nu 3 ans / mobilite / etudiant
  alreadyRented?: string;     // loyer actuel le cas echeant
  rentalDate?: string;        // date de mise en location
  purchasePrice?: number;     // optionnel : pour rendement
  notes?: string;             // remarques libres pour la recherche
}

export interface Advisor {
  company: string;            // marque (porte le logo) - defaut "Evolys"
  advisorName: string;        // prenom du conseiller qui etablit l'estimation
  advisorLastName?: string;   // nom du conseiller (mentions legales pied de page)
  rsac?: string;              // numero RSAC du conseiller (mentions legales)
  role: string;               // "Chasseur immobilier"
  date: string;               // "03/06/2026"
  client?: string;            // destinataire : "a l'attention de ..."
}

/** Une ligne d'un tableau (statut reglementaire). */
export interface RegulatoryRow {
  critere: string;            // "Zone tendue"
  statut: string;             // "OUI" | "NON" | "Zone 4" | "LIBRE"
  tone: 'neg' | 'pos' | 'neutral'; // couleur du statut (neg=rouge, pos=vert/teal)
  detail: string;
}

/** Ligne de la grille d'encadrement (un par epoque de construction). */
export interface CeilingRow {
  epoque: string;             // "Avant 1946"
  loyerRefM2: number;         // EUR/m2
  plafondMajoreM2: number;    // EUR/m2
  loyerMinoreM2: number;      // EUR/m2
  loyerRefSurface: number;    // EUR pour la surface
  plafondLegalSurface: number;// EUR pour la surface  (= colonne mise en avant)
  plancherSurface: number;    // EUR pour la surface
}

/** Trois cartes : basse / moyenne / haute. */
export interface MarketEstimate {
  basse: number;              // EUR/mois HC
  moyen: number;
  haute: number;
  basseM2: number;            // EUR/m2
  moyenM2: number;
  hauteM2: number;
  paragraph: string;          // texte sous les cartes
  cibleRecommandee?: string;  // "viser ~740-790 EUR"
}

/** Ligne du tableau "reference de prix" (variante non encadree, type Rouen). */
export interface PriceRefRow {
  label: string;              // "Moyenne Rouen - tous biens"
  eurM2: string;              // "14 - 15 EUR/m2"
  eurTotal: string;           // "~ 600 - 645 EUR"
}

/** Ligne du tableau methodologie. */
export interface SourceRow {
  source: string;
  nature: string;
  volume: string;
}

export interface EstimationData {
  variant: 'encadre' | 'libre';
  advisor: Advisor;

  // En-tete
  furnished: boolean;
  bienEstime: string;         // ligne "Bien estime : ..."

  // Section 1
  regulatory: RegulatoryRow[];
  regulatoryNote?: string;    // note avec puce sous le tableau (section 1)

  // Section 2 (encadre uniquement)
  ceilingTitle?: string;      // "Plafond legal d'encadrement - Zone 4, T3 meuble, 49 m2"
  ceilingIntro?: string;
  ceilingRows?: CeilingRow[];
  ceilingLecture?: string;    // caption "Lecture : ..."

  // Section marche
  market: MarketEstimate;
  priceRef?: PriceRefRow[];   // tableau optionnel (variante libre)

  // Section methodologie
  sources: SourceRow[];
  referencesLine?: string;    // ligne des references de simulation (encadre)
  fiabilite: string;          // "Comment lire la fiabilite : ..."
  disclaimer: string;         // "Avertissement. ..."

  // Pied de page
  footerAddress: string;      // "20 rue Bourget, 69009 Lyon"
}

// ============================================================
// Outil 3 : Estimation des couts de travaux (renovation)
// ============================================================

/** Saisie du formulaire d'estimation de travaux. */
export interface WorksInput {
  // Localisation & acces
  address?: string;
  postalCode: string;                 // requis (coef regional)
  city: string;
  floor?: string;                     // etage
  elevator?: boolean;
  access?: string;                    // contraintes acces chantier (texte court)
  propertyKind: 'appartement' | 'maison' | 'immeuble' | 'local'; // requis
  // Bien
  surface: number;                    // requis (m2)
  rooms?: number;
  epoch?: 'avant 1948' | '1948-1974' | 'apres 1974' | '';
  ceilingHeight?: string;
  // Ampleur & standing
  condition: string;                  // a rafraichir / a renover / a restructurer (requis)
  renoType: string;                   // rafraichissement / partielle / complete / lourde (requis)
  standing: 'essentiel' | 'confort' | 'prestige'; // requis
  // Postes (cle = poste coche) + quantites clefs facultatives
  postes: string[];
  waterPoints?: number;               // nb points d'eau (plomberie)
  windows?: number;                   // nb menuiseries exterieures
  notes?: string;                     // description libre + contraintes
  // Renovation energetique (DPE Wizard) — PDF lu nativement par Claude
  dpePdfBase64?: string;              // PDF en base64 (sans prefixe data:)
  dpePdfName?: string;
  dpeScenario?: 'meilleure rentabilite' | 'meilleure lettre' | '';
}

/** Bloc B : renovation energetique importee de DPE Wizard (non recalculee). */
export interface EnergyBlock {
  scenario: string;                   // "meilleure lettre"
  dpeGain?: string;                   // "F -> B"
  lines: { type: string; equipement?: string; cout: number }[];
  total: number;                      // investissement total (hors aides)
  note?: string;
}

/** Une ligne du detail par poste. */
export interface WorksLine {
  lot: string;                        // "Demolition" | "Technique" | "Second oeuvre" | "Finitions" | "Equipements" | "Exterieur"
  poste: string;                      // "Mise aux normes electrique"
  quantite: string;                   // "55 m2" | "3 points" | "forfait"
  pu: string;                         // prix unitaire retenu, ex "105 EUR/m2"
  sousTotal: number;                  // EUR
}

/** Resultat affiche a l'ecran (aucun PDF). */
export interface WorksEstimate {
  recap: string;                      // rappel du bien
  standing: string;                   // standing retenu
  regionalZone?: string;              // zone deduite du CP
  regionalCoef: number;               // coef regional applique
  lines: WorksLine[];                 // detail par poste
  sousTotalTravaux: number;           // somme postes x standing
  provisionAleasPct: number;          // ex 12 (%)
  totalProjet: number;                // total central
  fourchetteBasse: number;
  fourchetteHaute: number;
  coutM2: number;                     // total travaux / surface
  positionnement: string;             // vs reperes marche
  energy?: EnergyBlock;               // bloc B (si PDF DPE Wizard fourni)
  totalGeneral: number;               // bloc A (totalProjet) + energy.total
  hypotheses: string[];               // inclusions / exclusions / reserves
  disclaimer: string;
}
