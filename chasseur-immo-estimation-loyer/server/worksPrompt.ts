import { readFileSync } from 'node:fs';
import type { WorksInput } from '../src/types/index.ts';

/**
 * Outil "Estimation des couts de travaux".
 * - worksPriceBase.json : base de prix par poste (electricite, plomberie, sols...).
 * - worksForfaits.json  : forfaits Économique cuisine / SDB / WC / depose (par type + bande de surface).
 * Les deux fichiers sont editables sans toucher au code. Calcul deterministe (pas de recherche web).
 * 3 packs : le moteur calcule TOUJOURS en base Économique puis applique le coef de pack
 * (Économique x1,00 · Classique x1,30 · Prestige x2,60).
 */

interface PriceRow { poste: string; unite: string; bas: number; haut: number }
interface PriceLot { lot: string; postes: PriceRow[] }
interface RegionRow { zone: string; bas: number; haut: number; repere: string }
interface PriceConfig {
  meta: { date: string };
  coherenceM2: { type: string; bas: number; haut: number }[];
  regionalCoef: RegionRow[];
  accessSurcharge: string;
  priceBase: PriceLot[];
}
interface Band { surface_min: number; surface_max: number; forfait?: number; nb_typique?: number }
interface ForfaitsConfig {
  meta: { coef_pack: Record<string, number> };
  cuisine: { appartement: Band[]; maison: Band[] };
  salle_de_bain: { appartement: Band[]; maison: Band[] };
  wc: { forfait_unitaire: number; appartement: Band[]; maison: Band[] };
  depose: { bandes: Band[] };
  modificateur_etage: { regles: { condition: string; coefficient: number }[] };
}

const CFG: PriceConfig = JSON.parse(readFileSync(new URL('./worksPriceBase.json', import.meta.url), 'utf8'));
const FORF: ForfaitsConfig = JSON.parse(readFileSync(new URL('./worksForfaits.json', import.meta.url), 'utf8'));
export const COEF_PACK = FORF.meta.coef_pack; // { economique:1, classique:1.3, prestige:2.6 }

const num = (n: number) => n.toLocaleString('fr-FR');
const bandRange = (b: Band) => (b.surface_max >= 9999 ? `>${b.surface_min}` : `${b.surface_min}-${b.surface_max}`);
const bandsStr = (rows: Band[], withNb = false) =>
  rows.map((b) => `${bandRange(b)}m2 ${b.forfait !== undefined ? num(b.forfait) : ''}${withNb && b.nb_typique ? ` (${b.nb_typique} typique)` : ''}`.trim()).join(' · ');

function buildReference(c: PriceConfig, f: ForfaitsConfig): string {
  const base = c.priceBase
    .map((lot) => `${lot.lot.toUpperCase()} : ` + lot.postes.map((p) => `${p.poste} ${num(p.bas)}-${num(p.haut)}/${p.unite}`).join(' ; ') + '.')
    .join('\n');
  const regional = c.regionalCoef
    .map((r) => `${r.zone} ${r.bas.toLocaleString('fr-FR')}${r.bas !== r.haut ? '-' + r.haut.toLocaleString('fr-FR') : ''}`)
    .join(' · ');
  const wcNb = (rows: Band[]) => rows.map((b) => `${bandRange(b)}m2 ${b.nb_typique}`).join(' · ');
  return `# BASE DE PRIX (autres postes : demolition, elec, plomberie, chauffage, menuiseries, sols, peinture, exterieur) — TTC ${c.meta.date}, valeurs Économique = prix BAS ; bas-haut donne a titre indicatif
${base}

# FORFAITS ÉCONOMIQUE par TYPE de bien et BANDE de surface habitable totale (EUR national). A utiliser EXCLUSIVEMENT pour cuisine / salle de bain / WC / depose (jamais la base ci-dessus pour ces 4 postes).
CUISINE equipee entree de gamme (fournie posee) :
  Appartement : ${bandsStr(f.cuisine.appartement)}.
  Maison : ${bandsStr(f.cuisine.maison)}.
SALLE DE BAIN renovation complete entree de gamme, PAR SDB (nb typique) :
  Appartement : ${bandsStr(f.salle_de_bain.appartement, true)}.
  Maison : ${bandsStr(f.salle_de_bain.maison, true)}.
WC entree de gamme : ${f.wc.forfait_unitaire} EUR/unite. Nb typique — Appartement : ${wcNb(f.wc.appartement)} ; Maison : ${wcNb(f.wc.maison)}.
DEPOSE (cuisine OU salle de bain, evacuation comprise, par unite deposee ; meme grille appart/maison) : ${bandsStr(f.depose.bandes)}.
MODIFICATEUR ETAGE (s'applique UNIQUEMENT aux deposes) : RDC / avec ascenseur / maison x1,00 · appartement sans ascenseur etage 1-2 x1,10 · etage 3-4 x1,20 · etage 5 et + x1,30.

# COEFFICIENTS REGIONAUX (deduits du CODE POSTAL ; multiplient le sous-total)
${regional}.
Majoration d'acces chantier : ${c.accessSurcharge}.

# REPERES DE COHERENCE AU M2 (indicatifs, standing milieu de gamme, hors region)
${c.coherenceM2.map((r) => `${r.type} ${num(r.bas)}-${num(r.haut)}/m2`).join(' · ')}.`;
}

export const WORKS_SYSTEM = `# ROLE
Tu es un agent d'estimation de couts de travaux de renovation immobiliere, au service d'un reseau de chasseurs immobiliers en France metropolitaine. Tu produis une estimation chiffree, DETAILLEE PAR POSTE et credible.

# PRINCIPE CARDINAL
Vise le juste prix du marche. Ne minore jamais. En cas de doute, retiens le haut de bande et explicite l'hypothese.

# OUTIL NON CONVERSATIONNEL
Une seule passe, pas de questions. Si une donnee manque, prends une hypothese prudente deduite de la surface / du nb de pieces / de la description, et liste-la dans 'hypotheses'.

${buildReference(CFG, FORF)}

# STANDING : chiffre TOUJOURS en base ÉCONOMIQUE (n'applique PAS le coef de pack)
Toutes tes valeurs ('pu' et 'sousTotal') sont en base ÉCONOMIQUE, comme si le pack etait Économique. Le SYSTEME appliquera ensuite le coefficient de pack (Classique x1,30 ou Prestige x2,60) apres ta reponse : tu ne l'appliques donc JAMAIS toi-meme. Indique simplement le pack demande dans 'recap' et 'standing'.

# REPRODUCTIBILITE (IMPERATIF) — memes entrees => meme resultat
- Valeur_Économique EXACTE : forfait de la grille (cuisine/SDB/WC/depose) selon TYPE + bande de surface ; prix BAS de la base pour les autres postes. Jamais une valeur intermediaire au hasard.
- Modificateur d'etage : applique au forfait de depose (cuisine ET salle de bain, de facon IDENTIQUE), selon l'etage + ascenseur (RDC/ascenseur/maison = x1,00 ; appart sans ascenseur : 1-2 x1,10, 3-4 x1,20, 5+ x1,30). Le meme modificateur s'applique aux DEUX deposes.
- Provision aleas : 10 % par defaut ; 15 % uniquement si bati avant 1948 / restructuration lourde.
- Notations : S = surface (m2) ; P = nb de pieces (si absent, P = max(1, round(S/25))) ; W = nb points d'eau fournis ; F = nb fenetres fournies.

# DECOMPOSITION FIXE PAR POSTE COCHE (genere EXACTEMENT ces lignes, valeurs en base Économique ; le coef_pack sera applique a chaque ligne)
- Cuisine : (a) Depose cuisine = forfait depose[bande S] x modif_etage ; (b) Cuisine equipee entree de gamme = forfait cuisine[type][bande S].
- Salle de bain : (a) Depose salle de bain = forfait depose[bande S] x modif_etage ; (b) Renovation complete SDB = forfait SDB[type][bande S] x nb_SDB (nb typique de la bande, sauf indication) ; (c) WC = ${FORF.wc.forfait_unitaire} x nb_WC (nb typique de la bande).
- Demolition / depose (poste coche a part) : Curage complet = prix bas curage x S ; + Evacuation gravats = prix bas x max(1, round(S/30)) benne(s). (les deposes cuisine/SDB sont deja generees par les postes Cuisine/Salle de bain ci-dessus, ne pas les redoubler.)
- Creation de cloisons : Creation cloison = round(S x 0,15) m2.
- Platrerie & isolation : Doublage placo BA13 = round(S x 0,40) m2 ; + Enduit/bandes = S m2.
- Electricite : Mise aux normes NF C15-100 = S m2.
- Plomberie : Points d'eau = (W si fourni, sinon 2 + 2 par SDB) points ; + Chauffe-eau electrique = 1 unite.
- Chauffage : Radiateurs electriques = P unites.
- Menuiseries exterieures : Fenetres PVC double vitrage = (F si fourni, sinon P + 1) unites.
- Menuiseries interieures : Portes interieures = (P + 1) unites.
- Revetements de sol : Ragreage = S m2 ; + Carrelage = round(S x 0,20) m2 ; + Parquet contrecolle = (S - round(S x 0,20)) m2 ; + Plinthes = round(S x 1,0) ml.
- Peinture : Enduit/preparation = S m2 ; + Peinture murs+plafonds = S m2.
- Exterieur : selon surfaces decrites (toiture/facade/ITE) ; si non precise, signale-le dans hypotheses et n'inclus pas de ligne.
Le nombre de lignes ne depend QUE des postes coches et de ces regles.

# METHODE DE CALCUL (en base ÉCONOMIQUE — le systeme ajoutera le coef de pack ensuite)
Pour chaque ligne : Valeur_ligne = Valeur_Économique (et, pour les deposes, x Modif_etage). 'pu' et 'sousTotal' sont en ÉCONOMIQUE.
Sous_total = somme des lignes. Total_travaux = Sous_total x Coef_regional.
totalProjet = round(Total_travaux x (1 + aleas)). Fourchette = [ round(totalProjet x 0,90) ; round(totalProjet x 1,15) ]. coutM2 = round(totalProjet / S). (Ces totaux Économique seront eux aussi remultiplies par le systeme.)

# EXCLUSIONS (a rappeler dans hypotheses)
Mobilier, electromenager hors cuisine equipee, honoraires de maitrise d'oeuvre, frais de copro, diagnostics, desamiantage.

# ONGLET RENOVATION ENERGETIQUE (DPE WIZARD)
Tu ne calcules JAMAIS la renovation energetique. Si un PDF DPE Wizard est JOINT (bloc document), lis la table "SYNTHESE FINANCIERE" : pour chaque ligne -> type, equipement, cout ; puis l'investissement total, le scenario et le gain de classe (ex : F -> B) -> 'energy'. Le coef_pack NE s'applique PAS au bloc energie (montants importes tels quels). REGLE ANTI-DOUBLE-COMPTAGE : si un poste est deja chiffre par DPE Wizard (isolation, menuiseries, chauffage, ECS...), ne le re-chiffre pas cote travaux ; indique le rapprochement dans 'hypotheses'. Montants energie "hors aides". Si aucun PDF : 'energy' absent, signale-le dans 'hypotheses'.

# SORTIE : UNIQUEMENT un objet JSON valide conforme au schema, sans texte autour ni markdown. Francais avec accents. Montants = NOMBRES en euros (sans symbole). 'pu' = STRICTEMENT le prix unitaire final (ex : "3 500 €/forfait", "540 €/forfait", "80 €/m²") : pour une depose, integre deja le modificateur d'etage DANS le nombre ; AUCUNE parenthese, AUCUNE mention de bande / etage / coefficient / calcul. Coherence : sousTotalTravaux = somme des lines.sousTotal ; totalProjet = round(sousTotalTravaux x regionalCoef x (1 + provisionAleasPct/100)) ; totalGeneral = totalProjet + (energy.total si present, sinon 0).`;

export const WORKS_SCHEMA_HINT = `{
  "recap": "Appartement 60 m2, 15 rue X 76000 Rouen, etat a renover, pack Classique (x1,30), coef regional 0,92 (Normandie).",
  "standing": "Classique",
  "regionalZone": "Normandie",
  "regionalCoef": 0.92,
  "lines": [
    { "lot": "Demolition", "poste": "Depose cuisine (evacuation comprise)", "quantite": "1 forfait", "pu": "540 €/forfait", "sousTotal": 540 },
    { "lot": "Equipements", "poste": "Cuisine equipee entree de gamme", "quantite": "1 forfait", "pu": "3 500 €/forfait", "sousTotal": 3500 }
    // pu et sousTotal en base ÉCONOMIQUE (depose = forfait bande x modif_etage ; cuisine appart 45-65m2 = 3500). Le systeme applique ensuite le coef de pack.
  ],
  "sousTotalTravaux": 0,
  "provisionAleasPct": 10,
  "totalProjet": 0,
  "fourchetteBasse": 0,
  "fourchetteHaute": 0,
  "coutM2": 0,
  "positionnement": "~ ... EUR/m2, coherent avec le perimetre des postes retenus.",
  "energy": {                         // UNIQUEMENT si un PDF DPE Wizard est joint, sinon OMETTRE
    "scenario": "meilleure lettre", "dpeGain": "F -> B",
    "lines": [ { "type": "Isolation des murs", "equipement": "ITI laine de roche", "cout": 2295 } ],
    "total": 14135, "note": "Montants hors aides (MaPrimeRenov', CEE, eco-PTZ)."
  },
  "totalGeneral": 0,
  "hypotheses": [
    "Depose cuisine/SDB incluse avant repose.",
    "Hors mobilier, electromenager, honoraires, diagnostics, desamiantage.",
    "Estimation indicative - a confirmer par devis d'artisans qualifies/RGE."
  ],
  "disclaimer": "Estimation indicative de cout de travaux, ce n'est pas un devis. Base de prix 2025-2026 a actualiser."
}`;

const KIND: Record<string, string> = {
  appartement: 'appartement', maison: 'maison individuelle', immeuble: 'immeuble', local: 'local',
};

export function buildWorksPrompt(p: WorksInput): string {
  const coef = COEF_PACK[p.standing] ?? 1;
  const lines = [
    `Adresse : ${p.address ? p.address + ', ' : ''}${p.postalCode} ${p.city}`,
    `Type de bien : ${KIND[p.propertyKind] || p.propertyKind}`,
    `Surface habitable : ${p.surface} m2`,
    p.rooms ? `Pieces : ${p.rooms}` : '',
    p.floor ? `Etage : ${p.floor}${p.propertyKind === 'maison' ? ' (maison, modif etage = 1,00)' : p.elevator ? ' (avec ascenseur)' : ' (sans ascenseur)'}` : '',
    p.epoch ? `Epoque de construction : ${p.epoch}` : '',
    p.ceilingHeight ? `Hauteur sous plafond : ${p.ceilingHeight}` : '',
    `Etat general : ${p.condition}`,
    `Type de renovation visee : ${p.renoType}`,
    `Pack demande : ${p.standing} (mentionne-le dans recap/standing, mais CHIFFRE EN BASE ÉCONOMIQUE ; le systeme appliquera ensuite le coef ${coef})`,
    `Postes de travaux a chiffrer : ${p.postes?.length ? p.postes.join(', ') : '(deduire de l etat et de la description)'}`,
    p.waterPoints ? `Nb de points d'eau (plomberie) : ${p.waterPoints}` : '',
    p.windows ? `Nb de menuiseries exterieures : ${p.windows}` : '',
    p.access ? `Acces chantier : ${p.access}` : '',
    p.notes ? `Description / contraintes : ${p.notes}` : '',
    p.dpePdfBase64
      ? `Renovation energetique : un PDF DPE Wizard est JOINT (bloc document)${p.dpeScenario ? ` ; scenario retenu : ${p.dpeScenario}` : ''}. Extrais sa SYNTHESE FINANCIERE, applique l'anti-double-comptage et renseigne 'energy' (sans coef_pack).`
      : `Renovation energetique : aucun PDF DPE Wizard fourni -> laisse 'energy' absent.`,
  ].filter(Boolean);

  return `Etablis l'estimation chiffree des travaux pour le bien suivant :

${lines.map((l) => '- ' + l).join('\n')}

Applique la METHODE : chaque ligne = valeur ÉCONOMIQUE (forfait grille pour cuisine/SDB/WC/depose, prix bas pour les autres), deposes x modif_etage ; regroupe par lot ; applique le coef regional du code postal ${p.postalCode} ; ajoute la provision aleas ; donne le total, la fourchette et le cout au m2 EN ÉCONOMIQUE (le systeme appliquera le coef de pack ${coef}). Liste hypotheses et exclusions.

Reponds UNIQUEMENT avec le JSON conforme a ce schema :
${WORKS_SCHEMA_HINT}`;
}
