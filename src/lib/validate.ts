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
    problems.push("titre ou ville manquant : renseigne-les ou retire l'annonce");
  }
  if (!(l.netSellerPrice > 0)) {
    problems.push('prix de vente à 0 € : renseigne-le');
  }
  if (!l.description?.trim()) {
    problems.push('description vide : rédige-la ou retire l\'annonce');
  }
  return problems;
}
