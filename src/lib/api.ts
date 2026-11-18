import type { GeneralInfo, Listing, SessionEvolys, Settings, SplitReport } from '@/types';

// En prod, pointe vers le backend Render (VITE_API_URL). En dev, vide -> proxy Vite.
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

/** URL d'une image servie par le backend (aperçu UI). */
export const fileUrl = (path: string) => `${API}/api/file?path=${encodeURIComponent(path)}`;

/** Message d'erreur lisible même quand le serveur renvoie une page HTML (réveil, 502…). */
async function errorOf(r: Response, fallback: string): Promise<string> {
  const body = await r.text().catch(() => '');
  try {
    const j = JSON.parse(body);
    if (j?.error) return j.error;
  } catch { /* pas du JSON */ }
  if (r.status >= 500) return `Le serveur n'a pas répondu correctement (erreur ${r.status}). Réessaie dans une minute.`;
  return `${fallback} (erreur ${r.status})`;
}

export async function uploadPdf(file: File): Promise<{ uploadId: string; listings: Listing[]; report?: SplitReport }> {
  const fd = new FormData();
  fd.append('pdf', file);
  let r: Response;
  try {
    r = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
  } catch {
    throw new Error(`${file.name} : connexion au serveur impossible. Vérifie ta connexion et réessaie.`);
  }
  if (!r.ok) throw new Error(await errorOf(r, 'Upload échoué'));
  return r.json();
}

export async function generatePdf(generalInfo: GeneralInfo, listings: Listing[]): Promise<Blob> {
  const r = await fetch(`${API}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generalInfo, listings }),
  });
  if (!r.ok) throw new Error(await errorOf(r, 'Génération échouée'));
  return r.blob();
}

// ─── Espace client Evolys (outil ouvert avec un jeton) ─────────────────────
// Le jeton voyage dans le CORPS des requêtes, jamais dans l'adresse.

async function postErp<T>(chemin: string, corps: unknown): Promise<T> {
  const r = await fetch(`${API}/api/erp/${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error(await errorOf(r, 'Liaison avec Evolys impossible'));
  return r.json();
}

export const sessionEvolys = (jeton: string) => postErp<SessionEvolys>('session', { jeton });
export const renouvelerJeton = (jeton: string) => postErp<{ jeton: string }>('renouveler', { jeton });

export async function publierSelection(params: {
  jeton: string;
  contactId: string;
  cle: string;
  listings: Listing[];
  pdf: Blob;
}): Promise<{ selectionId: string; biens: number; dejaPubliee: boolean }> {
  const fd = new FormData();
  fd.append('donnees', JSON.stringify({ jeton: params.jeton, contactId: params.contactId, cle: params.cle, listings: params.listings }));
  fd.append('pdf', params.pdf, 'selection.pdf');
  let r: Response;
  try {
    r = await fetch(`${API}/api/erp/publier`, { method: 'POST', body: fd });
  } catch {
    throw new Error('Connexion au serveur impossible. Vérifie ta connexion et réessaie.');
  }
  if (!r.ok) throw new Error(await errorOf(r, 'Publication échouée'));
  return r.json();
}

export async function getSettings(): Promise<Settings> {
  return (await fetch(`${API}/api/settings`)).json();
}
