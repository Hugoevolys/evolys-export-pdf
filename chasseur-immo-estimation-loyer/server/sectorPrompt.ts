import type { SectorInput } from '../src/types/index.ts';

/**
 * Prompt pour l'outil "Prix moyen du secteur" (prix d'ACHAT).
 * Objectif : donner au conseiller le prix moyen au m2 d'une ville / d'un secteur
 * pour un type de bien. Ce n'est PAS un avis de valeur d'un bien precis.
 * Le modele doit avoir l'outil de recherche web active (web_search).
 */

export const SECTOR_SYSTEM = `Tu es un analyste du marche immobilier francais. Ta mission : estimer le PRIX MOYEN D'ACHAT AU M2 d'un SECTEUR (ville ou quartier) pour un type de bien donne. Ce n'est PAS un avis de valeur d'un bien precis : c'est un repere de marche pour le conseiller.

METHODE (obligatoire) - croise CES TROIS familles de sources via la recherche web :
1. ANNONCES EN VENTE : sur LEBONCOIN et SELOGER, regarde les annonces en vente dans la ville/secteur qui correspondent au type de bien (appartement ou maison) et a une surface proche. Donne une fourchette de prix au m2 observee et le nombre approximatif d'annonces comparables.
2. PRIX AU M2 DU SECTEUR : sur MEILLEURSAGENTS et SELOGER, releve le prix au m2 moyen du secteur pour ce type de bien (indices de marche).
3. DVF (Demandes de Valeurs Foncieres - ventes reellement enregistrees, data.gouv / app.dvf.etalab.gouv.fr ou sites qui l'exploitent) : donne la moyenne au m2 des ventes des 2 DERNIERES ANNEES pour ce type de bien sur la commune.

SYNTHESE :
- Si une ADRESSE precise est fournie, AFFINE sur le quartier exact (geolocalise l'adresse) : les prix varient fortement d'un quartier a l'autre d'une meme ville. Sinon, raisonne a l'echelle de la commune.
- Donne un PRIX MOYEN au m2 (EUR) + une fourchette basse / haute coherente, en CROISANT les 3 familles de sources (ne te fie pas a une seule).
- maison = monopropriete (pavillon/maison individuelle) ; distingue bien appartement vs maison, les prix au m2 different.
- Calcule le prix estime pour la surface fournie : prixEstimeBien = round(prixMoyenM2 * surface) ; idem pour basse/haute.
- Coherence : prixBasM2 < prixMoyenM2 < prixHautM2. Les valeurs doivent etre PLAUSIBLES pour la ville (pas de fourchette absurde).
- Si une source manque ou n'est pas verifiable, sois transparent dans 'detail' et appuie-toi sur les autres. Ne JAMAIS inventer de chiffre precis.

SORTIE : reponds UNIQUEMENT par un objet JSON valide conforme au schema, sans texte autour ni bloc markdown. Toutes les chaines en francais avec une ORTHOGRAPHE CORRECTE ET LES ACCENTS. Le 'summary' est court (3-4 phrases) : le prix moyen retenu, la convergence/ecart des sources, et le positionnement du secteur. Le 'disclaimer' rappelle que c'est une moyenne de secteur indicative, PAS un avis de valeur d'un bien precis.`;

export const SECTOR_SCHEMA_HINT = `{
  "city": "Rouen",
  "postalCode": "76000",
  "propertyType": "appartement" | "maison",
  "surface": 70,

  "prixMoyenM2": 2800,                 // prix moyen d'ACHAT au m2 (EUR)
  "prixBasM2": 2400,
  "prixHautM2": 3300,
  "prixEstimeBien": 196000,            // round(prixMoyenM2 * surface)
  "prixEstimeBasse": 168000,
  "prixEstimeHaute": 231000,

  "sources": [
    { "source": "Annonces en vente (Leboncoin, SeLoger)", "prixM2": "2 500 - 3 200 EUR/m2", "detail": "~40 annonces comparables (type + surface proche)" },
    { "source": "Prix au m2 secteur (MeilleursAgents, SeLoger)", "prixM2": "~2 800 EUR/m2", "detail": "indice de marche, maj recente" },
    { "source": "DVF - ventes reelles (2 ans)", "prixM2": "~2 700 EUR/m2", "detail": "moyenne des ventes enregistrees 2024-2026" }
  ],

  "summary": string,                   // 3-4 phrases
  "fiabilite": string,                 // 1 phrase (convergence des sources, volume)
  "disclaimer": string                 // "Moyenne de secteur indicative - ce n'est pas un avis de valeur d'un bien precis."
}`;

export function buildSectorPrompt(p: SectorInput): string {
  const type = p.propertyType === 'maison' ? 'maison (monopropriete / individuelle)' : 'appartement';
  return `Estime le PRIX MOYEN D'ACHAT AU M2 du secteur pour :
${p.address ? `- Adresse : ${p.address}, ${p.city}${p.postalCode ? ` (${p.postalCode})` : ''} -> AFFINE sur le quartier exact de cette adresse\n` : ''}- Ville : ${p.city}${p.postalCode ? ` (${p.postalCode})` : ''}
- Type de bien : ${type}
- Surface de reference : ${p.surface} m2

Applique la METHODE : croise (1) les annonces en vente Leboncoin + SeLoger correspondant au type et a une surface proche, (2) les prix au m2 du secteur sur MeilleursAgents + SeLoger, (3) la moyenne DVF des ventes des 2 dernieres annees. Donne le prix moyen au m2, la fourchette, et le prix estime pour ${p.surface} m2.

Reponds UNIQUEMENT avec le JSON conforme a ce schema :
${SECTOR_SCHEMA_HINT}`;
}
