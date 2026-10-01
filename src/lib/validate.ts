import type { Listing } from '../types/index.ts';

/** Titre posé par server/extract.ts quand l'IA n'a rien pu lire dans l'annonce. */
export const DEFAULT_TITLE = 'Annonce';

/**
 * Problèmes qui interdisent d'envoyer l'annonce au client.
 * Partagé front (bouton bloqué + message) et back (refus de /api/generate).
 */
export function listingProblems(l: Listing): string[] {
  const problems: string[] = [];
  if (!l.title?.trim() || l.title.trim() === DEFAULT_TITLE || !l.city?.trim()) {
    problems.push("l'outil n'a pas pu lire cette annonce (titre ou ville manquant) : retire-la ou redépose son PDF");
  }
  if (!(l.netSellerPrice > 0)) {
    problems.push('prix net vendeur à 0 € : renseigne-le');
  }
  return problems;
}
