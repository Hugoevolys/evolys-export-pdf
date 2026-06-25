# SPECS — Outil d'estimation de loyer (location longue duree)

## Objectif
Produire un **PDF unique, propre et credible** d'estimation de loyer, reproduisant le
rendu des modeles de reference fournis (Lyon = encadre, Rouen = libre).

## Flux : generation directe (decision produit)
L'estimation melange deux natures de donnees :
- **Donnees a valeur juridique** : zone tendue, encadrement, loyers de reference / plafonds
  legaux. Elles viennent de simulateurs officiels ; une hallucination est inacceptable.
- **Estimation de marche** : fourchette indicative croisant plusieurs portails.

Claude **pre-remplit** (recherche web), puis le PDF est **genere directement** : la fiche
du bien declenche recherche + generation en une fois, sans ecran de relecture.

> Decision produit (Hugo) : l'etape de relecture/correction a ete **retiree du flux** pour
> aller plus vite. L'avertissement du PDF rappelle deja que les plafonds legaux doivent etre
> verifies sur le simulateur officiel avant signature du bail. Le composant `EstimationReview`
> reste present (non importe) si l'on souhaite reactiver une relecture humaine.

## Contrat de donnees : `EstimationData` (src/types/index.ts)
Objet unique produit par la recherche et consomme par le generateur PDF.
- `variant`: `'encadre' | 'libre'` -> pilote l'affichage de la section plafonds.
- `regulatory[]` : 3 lignes (zone tendue / encadrement / 3e ligne contextuelle).
- `ceilingRows[]` : grille plafonds par epoque (variante encadre uniquement).
- `market` : basse/moyen/haute + EUR/m2 + paragraphe + cible.
- `priceRef[]` : tableau de references (variante libre, optionnel).
- `sources[]`, `referencesLine`, `fiabilite`, `disclaimer`.

## Rendu PDF (server/pdfGenerate.ts)
- HTML/CSS -> PDF via **Puppeteer** (A4, `printBackground`).
- Banniere navy + bloc conseiller a droite ; bloc "Bien estime".
- Sections numerotees automatiquement (la section plafonds n'existe qu'en `encadre`).
- 3 cartes marche (basse grise / moyenne bleue / haute verte).
- Pied de page navy repete (footerTemplate Puppeteer) : adresse + n° de page + date.
- Charte Evolys : navy `#00286E`, dark `#001B4A`, bleu clair `#6DCAFF`, fond clair `#DDF3FF`,
  accent orange `#FF9A41` (avertissement) ; teal/vert/rouge pour les statuts.

## Pipeline
1. `POST /api/estimate` { property, advisor } -> `research()` -> `EstimationData`.
2. `POST /api/generate` { EstimationData } -> PDF (stream), enchaine automatiquement.

> L'UI appelle 1 puis 2 a la suite (cf. `src/App.tsx`) ; aucune etape manuelle entre les deux.

## Points d'attention / TODO
- **Logo** : deposer le logo client dans `server/assets/` et l'inserer dans la banniere
  (cf. evolys-export-pdf `logoDataUri`). Placeholder texte pour l'instant.
- **Cout API** : `max_uses` de la recherche web est limite a 6 ; ajuster selon budget.
- **Fiabilite encadrement** : les simulateurs de metropole (Toodego Lyon...) sont
  interactifs et difficiles a scraper ; la grille peut etre imprecise. En flux direct,
  l'avertissement du PDF renvoie au simulateur officiel ; reactiver `EstimationReview`
  permettrait de corriger les plafonds a la main avant generation.
- **Persistance** : aucune (stateless). Ajouter un stockage si historique souhaite.
- **Multi-conseillers / multi-marques** : `advisor` est deja parametrable par requete.
