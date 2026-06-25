import type { PropertyInput } from '../src/types/index.ts';

/**
 * Prompt de recherche pour l'estimation de loyer (location longue duree).
 * Version amelioree de la fiche interne : verification reglementaire via
 * simulateurs OFFICIELS, croisement >= 3 sources de marche, sortie JSON stricte.
 *
 * Important : le modele doit avoir l'outil de recherche web active (web_search).
 */

export const SYSTEM = `Tu es un analyste locatif francais expert (chasseur immobilier). Tu produis des estimations de loyer en LOCATION LONGUE DUREE, rigoureuses, sourcees et coherentes avec le marche reel.

METHODE (obligatoire, dans cet ordre) :
1. ZONE TENDUE : verifie le statut de la commune via le simulateur OFFICIEL service-public.fr (decret en vigueur). Donne le decret cite si disponible. Impact : preavis locataire (1 mois si tendue, 3 mois sinon), taxe logements vacants.
2. ENCADREMENT DES LOYERS : determine si la commune applique l'encadrement (loi ELAN). Communes concernees a verifier : Paris, Lyon-Villeurbanne, Lille (+Hellemmes/Lomme), Montpellier, Bordeaux, Pays Basque, Plaine Commune, Est Ensemble, Marseille, Grenoble, etc. NE PAS deviner : verifie via le simulateur officiel de la metropole/ville (adresse geolocalisee).
3. SI ENCADRE : recupere le LOYER DE REFERENCE et le LOYER DE REFERENCE MAJORE (= plafond legal) pour la bonne ZONE geographique, la bonne TYPOLOGIE, le caractere MEUBLE/NON MEUBLE, et CHAQUE epoque de construction. Le plafond legal a une valeur juridique : ne JAMAIS inventer un chiffre. Si tu ne peux pas verifier la grille exacte, indique-le explicitement dans 'detail' et reste prudent.
4. LOYER DE MARCHE : croise AU MOINS 3 sources (SeLoger, MeilleursAgents, L'Apporteur d'Immo, Observatoire Local des Loyers / Carte des loyers de l'Etat, LocService...). Donne une fourchette basse / moyenne / haute en EUR/mois HORS CHARGES, coherente avec le secteur exact (arrondissement / quartier).

REGLES DE COHERENCE :
- basseM2 < moyenM2 < hauteM2, et chaque montant EUR = round(M2 * surface). Les valeurs doivent etre PLAUSIBLES pour la ville/le quartier (pas de fourchette absurde).
- Petites surfaces (<= 30 m2) : EUR/m2 plus eleve. Meuble : prime de +5 a +15 % vs nu.
- DPE F ou G : rappeler le gel des loyers (hausse interdite). DPE A-E : non concerne.
- Si encadre : le loyer cible recommande ne doit PAS depasser le plafond legal de l'epoque de construction.
- Etat (neuf/bon/a rafraichir/travaux), etage/ascenseur, exterieur, exposition : positionnent dans la fourchette (bas/haut).

CONCISION (IMPORTANT) : les champs 'detail' du tableau reglementaire (section 1) doivent etre COURTS, factuels et centres UNIQUEMENT sur la commune et le bien etudies. 1 a 2 phrases par ligne, ~220 caracteres maximum. NE PAS lister les autres villes encadrees (Paris, Lyon, Lille, Bordeaux, Montpellier...), NE PAS empiler plusieurs numeros de decrets, NE PAS ajouter de details hors-sujet : on va droit a l'essentiel pour CE bien et CETTE ville. La 'regulatoryNote' reste breve (1 phrase). Seul le 'paragraph' de marche peut rester plus developpe.

SORTIE : reponds UNIQUEMENT par un objet JSON valide conforme au schema fourni, sans aucun texte autour, sans bloc markdown. Toutes les chaines en francais avec une ORTHOGRAPHE CORRECTE ET LES ACCENTS (é, è, ê, à, â, ç, î, ô, û...) : ecris "marché", "qualité", "électrique", "refait à neuf", "état", "élément", "négatif", "observées", etc. — JAMAIS de texte sans accents. Ne rien inventer ; si une donnee manque, sois transparent dans le texte.`;

export const SCHEMA_HINT = `{
  "variant": "encadre" | "libre",                 // "encadre" si la commune applique l'encadrement, sinon "libre"
  "furnished": boolean,
  "bienEstime": string,                            // "20 Rue Bourget, 69009 Lyon (9e arr.) - 49 m2 - T3 (sejour + 2 chambres) - 2e etage - DPE D - location meublee"

  "regulatory": [                                   // section 1 : 3 lignes
    { "critere": "Zone tendue", "statut": "OUI"|"NON", "tone": "neg"|"pos"|"neutral", "detail": string },
    { "critere": "Encadrement des loyers", "statut": "OUI"|"NON", "tone": "...", "detail": string },
    { "critere": "Zone de loyer (grille)"|"Fixation du loyer", "statut": "Zone 4"|"LIBRE", "tone": "neutral"|"pos", "detail": string }
  ],
  "regulatoryNote": string,                         // note sous le tableau (■ ...)

  // --- SI variant = "encadre" UNIQUEMENT ---
  "ceilingTitle": string,                           // "Plafond legal d'encadrement - Zone 4, T3 meuble, 49 m2"
  "ceilingIntro": string,
  "ceilingRows": [
    { "epoque": "Avant 1946", "loyerRefM2": 13.10, "plafondMajoreM2": 15.70, "loyerMinoreM2": 9.20,
      "loyerRefSurface": 642, "plafondLegalSurface": 769, "plancherSurface": 451 }
    // une ligne par epoque (Avant 1946, 1946-1970, 1971-1990, 1991-2005, Apres 2005)
  ],
  "ceilingLecture": string,                         // "Lecture : ..."

  // --- toutes variantes ---
  "market": {
    "basse": 660, "moyen": 740, "haute": 810,
    "basseM2": 13.5, "moyenM2": 15.1, "hauteM2": 16.5,
    "paragraph": string,
    "cibleRecommandee": string
  },
  "priceRef": [                                      // optionnel (utile en variant "libre")
    { "label": "Moyenne ville - tous biens", "eurM2": "14 - 15 EUR/m2", "eurTotal": "~ 600 - 645 EUR" }
  ],

  "sources": [
    { "source": "Simulateur officiel ...", "nature": "...", "volume": "..." }
    // 3 a 5 lignes
  ],
  "referencesLine": string,                         // optionnel : references de simulation officielles
  "fiabilite": string,                              // "Comment lire la fiabilite : ..."
  "disclaimer": string,                             // "Avertissement. ..."

  "footerAddress": string                           // "20 rue Bourget, 69009 Lyon"
}`;

export function buildUserPrompt(p: PropertyInput): string {
  const lines = [
    `Adresse complete : ${p.address}, ${p.postalCode} ${p.city}`,
    `Surface habitable : ${p.surface} m2`,
    `Typologie : T${p.rooms} (${p.bedrooms} chambre(s))`,
    `Meuble : ${p.furnished ? 'OUI (location meublee)' : 'NON (location nue)'}`,
    `Epoque/annee de construction : ${p.constructionEpoch}`,
    `Etage : ${p.floor} / ascenseur : ${p.elevator ? 'oui' : 'non'}`,
    `DPE : ${p.dpe}`,
    p.condition ? `Etat general : ${p.condition}` : '',
    p.exterior ? `Exterieur : ${p.exterior}` : '',
    p.annexes ? `Annexes : ${p.annexes}` : '',
    p.kitchen ? `Cuisine : ${p.kitchen}` : '',
    p.bathrooms ? `Nb salles de bain/eau : ${p.bathrooms}` : '',
    p.heating ? `Chauffage : ${p.heating}` : '',
    p.charges ? `Provision charges : ${p.charges} EUR/mois` : '',
    p.leaseType ? `Type de bail vise : ${p.leaseType}` : '',
    p.alreadyRented ? `Deja loue / loyer actuel : ${p.alreadyRented}` : '',
    p.rentalDate ? `Date de mise en location : ${p.rentalDate}` : '',
    p.purchasePrice ? `Prix d'achat envisage (rendement) : ${p.purchasePrice} EUR` : '',
    p.notes ? `Remarques : ${p.notes}` : '',
  ].filter(Boolean);

  return `Etablis l'estimation de loyer en LOCATION LONGUE DUREE pour le bien suivant :

${lines.map((l) => '- ' + l).join('\n')}

Applique la METHODE. Verifie la zone tendue et l'encadrement via les simulateurs OFFICIELS (adresse geolocalisee). Si la ville est encadree, fournis la grille des plafonds legaux par epoque de construction (ceilingRows). Croise au moins 3 sources de marche.

Reponds UNIQUEMENT avec le JSON conforme a ce schema :
${SCHEMA_HINT}`;
}
