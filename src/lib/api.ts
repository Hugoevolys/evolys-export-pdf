import type { GeneralInfo, Listing, Settings, SplitReport } from '@/types';

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

export async function getSettings(): Promise<Settings> {
  return (await fetch(`${API}/api/settings`)).json();
}
