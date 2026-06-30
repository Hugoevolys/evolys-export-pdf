import { readFileSync } from 'node:fs';
import type { WorksInput } from '../src/types/index.ts';

/**
 * Outil "Estimation des couts de travaux".
 * La base de prix, les coefficients (standing, regionaux) et les reperes de
 * coherence sont charges depuis worksPriceBase.json (editable sans toucher au
 * code). Calcul deterministe : PAS de recherche web. Sortie JSON structuree.
 */

interface PriceRow { poste: string; unite: string; bas: number; haut: number }
interface PriceLot { lot: string; postes: PriceRow[] }
interface RegionRow { zone: string; bas: number; haut: number; repere: string }
interface PriceConfig {
  meta: { version: string; date: string; note: string };
  standingCoef: Record<string, number>;
  coherenceM2: { type: string; bas: number; haut: number }[];
  regionalCoef: RegionRow[];
  accessSurcharge: string;
  priceBase: PriceLot[];
}

const CFG: PriceConfig = JSON.parse(
  readFileSync(new URL('./worksPriceBase.json', import.meta.url), 'utf8'),
);

const num = (n: number) => n.toLocaleString('fr-FR');

function buildReference(c: PriceConfig): string {
  const base = c.priceBase
    .map((lot) => `${lot.lot.toUpperCase()} : ` + lot.postes.map((p) => `${p.poste} ${num(p.bas)}-${num(p.haut)}/${p.unite}`).join(' ; ') + '.')
    .join('\n');
  const standing = Object.entries(c.standingCoef)
    .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} x${v.toLocaleString('fr-FR')}`)
    .join(' · ');
  const regional = c.regionalCoef
    .map((r) => `${r.zone} ${r.bas.toLocaleString('fr-FR')}${r.bas !== r.haut ? '-' + r.haut.toLocaleString('fr-FR') : ''}`)
    .join(' · ');
  const coherence = c.coherenceM2.map((r) => `${r.type} ${num(r.bas)}-${num(r.haut)}/m2`).join(' · ');
  return `# BASE DE PRIX DE REFERENCE (TTC, fourniture + pose, ${c.meta.date}, standing "Confort" = base 1,00 ; bas-haut)
${base}

# COEFFICIENTS DE STANDING (multiplient la base Confort)
${standing}. Le standing agit surtout sur les finitions/equipements (sols, peinture, cuisine, SDB, menuiseries), peu sur les lots techniques (elec/plomberie, davantage normes).

# COEFFICIENTS REGIONAUX (deduits du CODE POSTAL ; multiplient le sous-total APRES standing)
${regional}.
Majoration d'acces chantier : ${c.accessSurcharge}.

# REPERES DE COHERENCE AU M2 (standing Confort, hors region)
${coherence} (jusqu'a 4000/m2 avec modifications structurelles).`;
}

export const WORKS_SYSTEM = `# ROLE
Tu es un agent d'estimation de couts de travaux de renovation immobiliere, au service d'un reseau de chasseurs immobiliers en France metropolitaine. Tu produis une estimation chiffree, DETAILLEE PAR POSTE et credible, a partir d'une adresse, d'un type de bien, d'un standing et des postes a traiter.

# PRINCIPE CARDINAL
Vise TOUJOURS le juste prix du marche. Ne minore JAMAIS pour rassurer. Objectif : zero mauvaise surprise au moment des devis. En cas de doute, retiens le HAUT de fourchette et explicite l'hypothese.

# OUTIL NON CONVERSATIONNEL
Tu reponds en une seule passe : tu NE POSES PAS de questions. Si une donnee determinante manque (quantites, nb de points d'eau, nb de fenetres...), prends une HYPOTHESE PRUDENTE (plutot haute) deduite de la surface / du nb de pieces / de la description, et liste-la dans 'hypotheses'.

${buildReference(CFG)}

# REPRODUCTIBILITE (IMPERATIF) — memes entrees => meme resultat, au centime
- Prix_reference = MILIEU EXACT de la fourchette, soit round((bas + haut) / 2). Jamais une autre valeur.
- Coef_standing applique UNIFORMEMENT a TOUTES les lignes (demolition, electricite, plomberie, sols, peinture, menuiseries...) SAUF les forfaits Cuisine et Salle de bain.
- Cuisine et Salle de bain : le coef ne s'applique PAS ; a la place, la GAMME est choisie de facon DETERMINISTE selon le standing (Essentiel -> entree de gamme / standard ; Prestige -> haut de gamme). Voir decomposition.
- Provision aleas : 12 % par defaut ; 15 % UNIQUEMENT si bati avant 1948 ou restructuration. Jamais autre chose.
- Notations : S = surface (m2) ; P = nb de pieces (si absent, P = max(1, round(S/25))) ; W = nb points d'eau fournis ; F = nb fenetres fournies.

# DECOMPOSITION FIXE PAR POSTE (produis EXACTEMENT ces lignes et ces quantites, pas d'autres)
Pour chaque poste COCHE, genere precisement les lignes suivantes (et AUCUNE ligne supplementaire) :
- Demolition / depose : Curage complet = S m2 ; + Depose cuisine (1 forfait) si Cuisine cochee ; + Depose salle de bain (1 forfait) si Salle de bain cochee ; + Evacuation gravats = max(1, round(S/30)) benne(s).
- Creation de cloisons : Creation cloison = round(S x 0,15) m2 (sauf quantite precisee dans la description).
- Platrerie & isolation : Doublage placo BA13 = round(S x 0,40) m2 ; + Enduit/bandes = S m2.
- Electricite : 1 ligne Mise aux normes NF C15-100 = S m2 (aucun point supplementaire sauf demande).
- Plomberie : Points d'eau = (W si fourni, sinon 2 + 2 par salle de bain) points ; + Chauffe-eau electrique = 1 unite.
- Chauffage : Radiateurs electriques = P unites (sauf type precis decrit -> 1 forfait correspondant).
- Menuiseries exterieures : Fenetres PVC double vitrage = (F si fourni, sinon P + 1) unites.
- Menuiseries interieures : Portes interieures = (P + 1) unites.
- Revetements de sol : Ragreage = S m2 ; + Carrelage = round(S x 0,20) m2 ; + Parquet contrecolle = (S - round(S x 0,20)) m2 ; + Plinthes = round(S x 1,0) ml.
- Peinture : Enduit/preparation = S m2 ; + Peinture murs+plafonds = S m2.
- Cuisine : 1 ligne, gamme selon le standing (PAS de coef de standing applique) : Essentiel -> "Cuisine equipee entree de gamme" (milieu de fourchette 5000-9000 = 7000) ; Prestige -> "Cuisine equipee haut de gamme" (15000-30000 = 22500).
- Salle de bain : 1 ligne, gamme selon le standing (PAS de coef) : Essentiel -> "Renovation complete salle de bain (~5 m2)" (5000-10000 = 7500) ; Prestige -> "Salle de bain haut de gamme" (10000-18000 = 14000) ; + WC = 1 unite (coef standing applique au WC).
- Exterieur : selon surfaces decrites (toiture/facade/ITE) ; si non precise, signale-le dans hypotheses et n'inclus pas de ligne.
Le nombre de lignes ne doit dependre QUE des postes coches et des regles ci-dessus, jamais d'une appreciation variable.

# METHODE DE CALCUL
Pour chaque poste retenu : Cout_poste = Quantite x Prix_reference x Coef_standing.
Sous_total = somme des postes (apres standing).
Total_travaux = Sous_total x Coef_regional (choisi dans la fourchette selon densite/acces).
Provision pour aleas : 10 % (recent/bon etat), 12 % (standard), 15 % (bati avant 1948 / restructuration). totalProjet = Total_travaux x (1 + aleas).
Fourchette = [ totalProjet x 0,90 ; totalProjet x 1,15 ].
CONTROLE : recalcule cout/m2 = totalProjet / surface et verifie qu'il tombe dans la borne du type de renovation declare ; sinon, signale dans 'hypotheses' et reexamine les quantites (ne LISSE jamais le chiffre).

# EXCLUSIONS (a rappeler dans hypotheses, sauf demande contraire)
Mobilier, electromenager hors cuisine equipee, honoraires de maitrise d'oeuvre, frais de copro, diagnostics, desamiantage.

# ONGLET RENOVATION ENERGETIQUE (DPE WIZARD)
Tu ne calcules JAMAIS toi-meme la renovation energetique. Si un PDF DPE Wizard est JOINT au message (bloc document), lis la table "SYNTHESE FINANCIERE" du rapport "DPE Projete - Scenario de travaux" : pour CHAQUE ligne -> type de travaux, equipement/descriptif, cout estime ; puis l'investissement total, le scenario (meilleure rentabilite / meilleure lettre) et le gain de classe (ex : F -> B). Renvoie ces elements dans 'energy' (lines + total + scenario + dpeGain). Si le conseiller a precise un scenario, retiens CELUI-LA.
REGLE ANTI-DOUBLE-COMPTAGE (impérative) : si un poste est deja chiffre par DPE Wizard (isolation murs/combles, menuiseries exterieures, chauffage, eau chaude sanitaire...), NE le re-chiffre PAS dans les 'lines' travaux generaux ; retire le doublon cote travaux, garde le montant DPE Wizard, et indique le rapprochement dans 'hypotheses'.
Les montants energie sont "hors aides" (MaPrimeRenov', CEE, eco-PTZ) : rappelle-le dans energy.note. Si AUCUN PDF n'est joint, n'invente rien : laisse 'energy' absent et signale dans 'hypotheses' que la renovation energetique n'est pas chiffree.

# SORTIE : reponds UNIQUEMENT par un objet JSON valide conforme au schema, sans texte autour ni markdown. Toutes les chaines en francais avec ORTHOGRAPHE et ACCENTS corrects. Les montants sont des NOMBRES en euros (pas de chaines, pas de symbole). Coherence obligatoire : sousTotalTravaux = somme des lines.sousTotal ; totalProjet = round(sousTotalTravaux x regionalCoef x (1 + provisionAleasPct/100)) ; totalGeneral = totalProjet + (energy.total si present, sinon 0).`;

export const WORKS_SCHEMA_HINT = `{
  "recap": "Appartement 55 m2, 15 rue X 76000 Rouen, etat a renover, standing Confort, coef regional 0,92 (Normandie).",
  "standing": "Confort",
  "regionalZone": "Normandie",
  "regionalCoef": 0.92,
  "lines": [
    { "lot": "Demolition", "poste": "Curage complet", "quantite": "55 m2", "pu": "65 EUR/m2", "sousTotal": 3575 },
    { "lot": "Technique", "poste": "Mise aux normes electrique NF C15-100", "quantite": "55 m2", "pu": "105 EUR/m2", "sousTotal": 5775 }
    // ... une ligne par poste retenu, regroupees par lot
  ],
  "sousTotalTravaux": 0,             // somme des lines.sousTotal
  "provisionAleasPct": 12,
  "totalProjet": 0,                  // round(sousTotalTravaux * regionalCoef * (1 + provisionAleasPct/100))
  "fourchetteBasse": 0,              // round(totalProjet * 0.90)
  "fourchetteHaute": 0,              // round(totalProjet * 1.15)
  "coutM2": 0,                       // round(totalProjet / surface)
  "positionnement": "~ 950 EUR/m2 : coherent avec une renovation complete (borne 900-1600).",
  "energy": {                         // UNIQUEMENT si un PDF DPE Wizard est joint, sinon OMETTRE
    "scenario": "meilleure lettre",
    "dpeGain": "F -> B",
    "lines": [
      { "type": "Isolation des murs", "equipement": "ITI laine de roche 75% des murs", "cout": 2295 },
      { "type": "Chauffage", "equipement": "PAC air-air COP 3.0", "cout": 9000 }
    ],
    "total": 14135,
    "note": "Montants hors aides (MaPrimeRenov', CEE, eco-PTZ)."
  },
  "totalGeneral": 0,                  // totalProjet + energy.total (= totalProjet si pas d'energy)
  "hypotheses": [
    "Quantites de menuiseries estimees a 6 fenetres (non precise).",
    "Hors mobilier, electromenager, honoraires, diagnostics, desamiantage.",
    "Estimation indicative - a confirmer par devis d'artisans qualifies/RGE."
  ],
  "disclaimer": "Estimation indicative de cout de travaux, ce n'est pas un devis. Base de prix 2025-2026 a actualiser."
}`;

const KIND: Record<string, string> = {
  appartement: 'appartement', maison: 'maison individuelle', immeuble: 'immeuble', local: 'local',
};

export function buildWorksPrompt(p: WorksInput): string {
  const lines = [
    `Adresse : ${p.address ? p.address + ', ' : ''}${p.postalCode} ${p.city}`,
    `Type de bien : ${KIND[p.propertyKind] || p.propertyKind}`,
    `Surface habitable : ${p.surface} m2`,
    p.rooms ? `Pieces : ${p.rooms}` : '',
    p.floor ? `Etage : ${p.floor}${p.elevator ? ' (avec ascenseur)' : ' (sans ascenseur)'}` : '',
    p.epoch ? `Epoque de construction : ${p.epoch}` : '',
    p.ceilingHeight ? `Hauteur sous plafond : ${p.ceilingHeight}` : '',
    `Etat general : ${p.condition}`,
    `Type de renovation visee : ${p.renoType}`,
    `Standing souhaite : ${p.standing}`,
    `Postes de travaux a chiffrer : ${p.postes?.length ? p.postes.join(', ') : '(deduire de l etat et de la description)'}`,
    p.waterPoints ? `Nb de points d'eau (plomberie) : ${p.waterPoints}` : '',
    p.windows ? `Nb de menuiseries exterieures : ${p.windows}` : '',
    p.access ? `Acces chantier : ${p.access}` : '',
    p.notes ? `Description / contraintes : ${p.notes}` : '',
    p.dpePdfBase64
      ? `Renovation energetique : un PDF DPE Wizard est JOINT (bloc document)${p.dpeScenario ? ` ; scenario retenu : ${p.dpeScenario}` : ''}. Extrais sa SYNTHESE FINANCIERE, applique l'anti-double-comptage et renseigne 'energy'.`
      : `Renovation energetique : aucun PDF DPE Wizard fourni -> laisse 'energy' absent.`,
  ].filter(Boolean);

  return `Etablis l'estimation chiffree des travaux pour le bien suivant :

${lines.map((l) => '- ' + l).join('\n')}

Applique la METHODE : detaille chaque poste retenu (quantite x prix de reference x coef standing), regroupe par lot, applique le coef regional du code postal ${p.postalCode}, ajoute la provision pour aleas, donne le total projet, la fourchette basse/haute et le cout au m2. Verifie la coherence au m2 avec le type de renovation. Liste tes hypotheses et exclusions.

Reponds UNIQUEMENT avec le JSON conforme a ce schema :
${WORKS_SCHEMA_HINT}`;
}
