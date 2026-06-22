import type { GeneralInfo, Listing, Settings } from '@/types';

// En prod, pointe vers le backend Render (VITE_API_URL). En dev, vide -> proxy Vite.
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

/** URL d'une image servie par le backend (aperçu UI). */
export const fileUrl = (path: string) => `${API}/api/file?path=${encodeURIComponent(path)}`;

export async function uploadPdf(file: File): Promise<{ uploadId: string; listings: Listing[] }> {
  const fd = new FormData();
  fd.append('pdf', file);
  const r = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error((await r.json()).error || 'Upload échoué');
  return r.json();
}

export async function generatePdf(generalInfo: GeneralInfo, listings: Listing[]): Promise<Blob> {
  const r = await fetch(`${API}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generalInfo, listings }),
  });
  if (!r.ok) throw new Error('Génération échouée');
  return r.blob();
}

export async function getSettings(): Promise<Settings> {
  return (await fetch(`${API}/api/settings`)).json();
}
