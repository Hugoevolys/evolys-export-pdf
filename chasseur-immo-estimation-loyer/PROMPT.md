# Prompt de recherche (estimation de loyer longue duree)

Version amelioree du prompt de la fiche interne. Utilise dans `server/prompt.ts`
(SYSTEM + buildUserPrompt). Reproduit ici pour copier-coller manuel (Hugo / CRM).

## Ameliorations vs prompt d'origine
- Methode **ordonnee et obligatoire** (zone tendue -> encadrement -> grille plafonds -> marche).
- Interdiction explicite **d'inventer** un plafond legal ; transparence si non verifiable.
- Regles de **coherence chiffree** (basse < moyen < haute ; EUR = m2 x surface ; fourchette plausible).
- Prise en compte **DPE F/G** (gel), **meuble** (+5 a +15 %), petites surfaces, etat/etage.
- Sortie **JSON strict** (schema EstimationData) -> directement exploitable par l'outil.

## SYSTEM
(voir server/prompt.ts -> constante SYSTEM)

## Modele de saisie (si usage manuel)
```
Fais une estimation de loyer en LOCATION LONGUE DUREE pour :
- Adresse : ___
- Surface : ___ m2 / Typologie : T__ ( __ ch. ) / Meuble : ___
- Epoque de construction : ___ / Etage : ___ / ascenseur : ___ / DPE : ___
- Etat : ___ / Exterieur-annexes : ___ / Cuisine : ___ / Chauffage : ___
- Charges : ___ EUR/mois / Bail vise : ___ / Deja loue : ___ / Date : ___

Verifie ZONE TENDUE et ENCADREMENT via simulateurs OFFICIELS (service-public +
metropole, adresse geolocalisee). Si encadre : donne la grille des plafonds legaux
par epoque. Croise >= 3 sources de marche. Donne loyer moyen + fourchette basse/haute
(HC/mois), methodologie, sources et volume de donnees. Reponds en JSON (schema EstimationData).
```
