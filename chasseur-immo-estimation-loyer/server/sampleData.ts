import type { EstimationData } from '../src/types/index.ts';

// Jeux de donnees de test reproduisant les 2 PDF de reference.
// Servent au script test:pdf (verification du rendu sans appel API).

export const LYON_ENCADRE: EstimationData = {
  variant: 'encadre',
  furnished: true,
  advisor: { company: 'Evolys', advisorName: 'Hugo', role: 'Chasseur immobilier', date: '03/06/2026', client: 'M. et Mme Martin' },
  bienEstime:
    '20 Rue Bourget, 69009 Lyon (9e arrondissement) - 49 m2 - T3 (sejour + 2 chambres) - 2e etage - DPE D - location **meublee**',
  regulatory: [
    { critere: 'Zone tendue', statut: 'OUI', tone: 'neg',
      detail: 'Lyon est classee en zone tendue (agglo. > 50 000 hab. a forte tension locative). Preavis reduit a 1 mois, taxe sur les logements vacants applicable.' },
    { critere: 'Encadrement des loyers', statut: 'OUI', tone: 'neg',
      detail: 'Dispositif en vigueur a Lyon & Villeurbanne depuis le 01/11/2021. Arrete prefectoral en vigueur jusqu au 31/10/2026.' },
    { critere: 'Zone de loyer (grille)', statut: 'Zone 4', tone: 'neutral',
      detail: "L adresse 20 rue Bourget est situee en **Zone 4** du decoupage officiel (5 zones geographiques). Confirme par geolocalisation sur le simulateur officiel." },
  ],
  regulatoryNote:
    "Le loyer d un logement remis en location, en cas de changement de locataire ou de renouvellement de bail, **ne peut legalement pas depasser le loyer de reference majore** (loyer de reference + 20 %) indique ci-dessous, sauf complement de loyer justifie par des caracteristiques exceptionnelles.",
  ceilingTitle: "Plafond legal d'encadrement - Zone 4, T3 meuble, 49 m2",
  ceilingIntro:
    "Le plafond legal depend de l **annee de construction** de l immeuble. Le DPE (classe D) ne permet pas a lui seul de la determiner : nous fournissons donc la grille complete issue du simulateur officiel de la Metropole de Lyon. Le **loyer maximum autorise** est la colonne 'Plafond legal'.",
  ceilingRows: [
    { epoque: 'Avant 1946', loyerRefM2: 13.10, plafondMajoreM2: 15.70, loyerMinoreM2: 9.20, loyerRefSurface: 642, plafondLegalSurface: 769, plancherSurface: 451 },
    { epoque: '1946 - 1970', loyerRefM2: 12.30, plafondMajoreM2: 14.80, loyerMinoreM2: 8.60, loyerRefSurface: 603, plafondLegalSurface: 725, plancherSurface: 421 },
    { epoque: '1971 - 1990', loyerRefM2: 12.20, plafondMajoreM2: 14.60, loyerMinoreM2: 8.50, loyerRefSurface: 598, plafondLegalSurface: 715, plancherSurface: 417 },
    { epoque: '1991 - 2005', loyerRefM2: 13.40, plafondMajoreM2: 16.10, loyerMinoreM2: 9.40, loyerRefSurface: 657, plafondLegalSurface: 789, plancherSurface: 461 },
    { epoque: 'Apres 2005', loyerRefM2: 14.20, plafondMajoreM2: 17.00, loyerMinoreM2: 9.90, loyerRefSurface: 696, plafondLegalSurface: 833, plancherSurface: 485 },
  ],
  ceilingLecture:
    'Lecture : pour un immeuble courant de ce secteur (1946-2005), le loyer meuble ne peut legalement pas depasser 715 a 789 EUR HC/mois ; jusqu a 833 EUR pour une construction posterieure a 2005. Valeurs hors charges, arrete en vigueur (bail signe a partir du 01/11/2025).',
  market: {
    basse: 660, moyen: 740, haute: 810,
    basseM2: 13.5, moyenM2: 15.1, hauteM2: 16.5,
    paragraph:
      "Ces valeurs correspondent au loyer **hors charges** mensuel pratique pour un T3 meuble d environ 49 m2 dans le 9e arrondissement, croisees a partir de plusieurs sources (voir methodologie). **Loyer cible recommande :** viser le haut de fourchette (~ 740-790 EUR), un logement meuble se louant generalement proche du plafond - dans la limite du plafond legal applicable selon l annee de construction (section 2). Prevoir en sus une provision pour charges (~ 30-60 EUR/mois).",
    cibleRecommandee: '740-790 EUR',
  },
  sources: [
    { source: 'Simulateur officiel Metropole de Lyon (Toodego)', nature: 'Loyers de reference et plafonds legaux - adresse geolocalisee en Zone 4. 5 simulations (1 par epoque).', volume: 'Donnee officielle - valeur juridique. Arrete prefectoral 2025-2026.' },
    { source: 'Observatoire Local des Loyers (OLL) - agree Etat', nature: 'Loyers reellement constates du parc prive (base des loyers de reference).', volume: '149 communes, 16 zones - min. 50 logements par cellule pour publication.' },
    { source: 'data.gouv.fr', nature: "Jeu de donnees 'Encadrement des loyers Metropole de Lyon 2025-2026' (grille + zonage geographique).", volume: 'Donnee publique officielle - maj 04/2026.' },
    { source: 'SeLoger', nature: 'Loyers d annonces Lyon 9e : ~15 EUR/m2 en moyenne (fourchette 11-23 EUR/m2).', volume: '~195 annonces actives (9e) - ~570 T3 sur Lyon.' },
    { source: 'MeilleursAgents / barometres', nature: 'Loyer moyen appartement Lyon 9e ~ 15 EUR/m2 ; loyer median Lyon ~ 950 EUR.', volume: 'Agregats de marche - maj 2026.' },
  ],
  referencesLine:
    'References de simulation officielles (Metropole de Lyon, 03/06/2026) - verifiables : avant 1946 **LVQSHKPG** (n.503280) - 1946-1970 **CJWWGPGT** (n.503289) - 1971-1990 **CZPJNNKK** (n.503297) - 1991-2005 **LGPMMHJK** (n.503301) - apres 2005 **XRJXDVRN** (n.503307).',
  fiabilite:
    'Comment lire la fiabilite : le plafond legal (section 2) est une donnee officielle a valeur juridique, issue d une enquete statistique encadree par l Etat. L estimation de marche (section 3) est une fourchette indicative, convergente entre l OLL et les portails prives (ecart faible : ~13,5 a 16,5 EUR/m2), ce qui traduit une bonne robustesse.',
  disclaimer:
    "Document fourni a titre d information. L estimation de marche est indicative et non contractuelle ; elle depend de l etat, des prestations et de l etage du bien. Le plafond legal d encadrement, lui, est imperatif : confirmez l annee de construction de l immeuble (acte / reglement de copropriete / DPE) pour retenir la ligne exacte du tableau. Le loyer de reference et le loyer majore doivent obligatoirement figurer au bail.",
  footerAddress: '20 rue Bourget, 69009 Lyon',
};

export const ROUEN_LIBRE: EstimationData = {
  variant: 'libre',
  furnished: true,
  advisor: { company: 'Evolys', advisorName: 'Axel', role: 'Chasseur immobilier', date: '03/06/2026', client: 'Mme Dubois' },
  bienEstime:
    '27 Rue de la Poterne, 76000 Rouen (centre historique) - 43 m2 - T3 (sejour + 2 chambres) - 2e etage - DPE D - location **meublee**',
  regulatory: [
    { critere: 'Zone tendue', statut: 'NON', tone: 'neg',
      detail: "Rouen (76000) n est **pas** classee en zone tendue (verifie sur le simulateur officiel service-public, conforme au decret n.2025-1267 du 22/12/2025). Preavis locataire de droit commun : **3 mois**." },
    { critere: 'Encadrement des loyers', statut: 'NON', tone: 'neg',
      detail: 'Rouen ne fait pas partie des agglomerations appliquant l encadrement des loyers (loi ELAN). **Aucun loyer de reference ni plafond legal** ne s applique.' },
    { critere: 'Fixation du loyer', statut: 'LIBRE', tone: 'pos',
      detail: 'Le loyer est fixe **librement** a la 1re mise en location comme a la relocation. En cours de bail, la revision est limitee a l evolution de l IRL (INSEE).' },
  ],
  regulatoryNote:
    "**A noter :** le bien etant classe **DPE D**, il n est pas concerne par le gel des loyers des passoires energetiques (classes F et G). Contrairement a Lyon ou Paris, il n existe donc **aucun plafond a respecter** a Rouen : seul le marche fixe le niveau de loyer atteignable (section 2).",
  market: {
    basse: 610, moyen: 680, haute: 740,
    basseM2: 14.2, moyenM2: 15.8, hauteM2: 17.2,
    paragraph:
      "Loyer **hors charges** mensuel estime pour un T3 meuble d environ 43 m2 situe au **27 rue de la Poterne**, en plein **centre historique** de Rouen (secteur Vieux-Marche / Gros-Horloge), un emplacement recherche qui positionne le bien dans le haut de la fourchette locale. Une petite surface se loue par ailleurs a un prix au m2 superieur a la moyenne. **Loyer cible recommande :** ~ 680-730 EUR HC/mois, le meuble se louant generalement avec une prime de 5 a 15 %. Prevoir en sus une provision pour charges (~ 30-50 EUR/mois).",
    cibleRecommandee: '680-730 EUR',
  },
  priceRef: [
    { label: 'Moyenne Rouen - tous biens', eurM2: '14 - 15 EUR/m2', eurTotal: '~ 600 - 645 EUR' },
    { label: 'Secteur centre / Vieux-Marche', eurM2: '16 - 19 EUR/m2', eurTotal: '~ 690 - 815 EUR' },
    { label: 'Fourchette retenue (meuble, central)', eurM2: '14,2 - 17,2 EUR/m2', eurTotal: '610 - 740 EUR' },
  ],
  sources: [
    { source: 'Simulateur officiel service-public.fr', nature: 'Statut zone tendue de la commune (preavis). Resultat : Rouen hors zone tendue.', volume: 'Donnee officielle - conforme decret n.2025-1267 du 22/12/2025.' },
    { source: 'SeLoger', nature: 'Loyers d annonces Rouen 76000 : ~14 EUR/m2 en moyenne (fourchette 10-24 EUR/m2) ; meuble ~611 EUR moyen.', volume: '~1 279 annonces actives a Rouen 76000.' },
    { source: "L Apporteur d Immo (modele)", nature: 'Loyer m2 appartement Rouen ~15 EUR/m2 (CC) ; par rue : centre 16-19 EUR/m2.', volume: 'Estimation par adresse - maj 03/2026.' },
    { source: 'MeilleursAgents / Carte des loyers', nature: 'Loyer moyen appartement Rouen ~14 EUR/m2 ; carte des loyers de l Etat.', volume: 'Carte officielle ~35 000 communes (loyers constates).' },
  ],
  fiabilite:
    'Comment lire la fiabilite : a Rouen, **aucune donnee a valeur juridique** (pas d encadrement) ; l estimation repose donc sur la convergence de plusieurs sources de marche. Celles-ci s accordent autour de **14-17 EUR/m2** pour un appartement central, ce qui donne une fourchette resserree et donc robuste. L incertitude principale porte sur l etat interieur et les prestations du logement, qui font varier le positionnement dans la fourchette.',
  disclaimer:
    "Document fourni a titre d information ; estimation de marche indicative et non contractuelle. A Rouen, le loyer est fixe librement (pas de plafond legal). Le niveau atteignable depend de l etat, des prestations, de la luminosite et de l etage du bien, ainsi que de la qualite de l ameublement. La revision annuelle en cours de bail reste plafonnee a l IRL publie par l INSEE.",
  footerAddress: '27 rue de la Poterne, 76000 Rouen',
};
