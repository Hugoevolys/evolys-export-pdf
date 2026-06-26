import type { PropertyInput, EstimationData, Advisor } from '@/types';

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

export async function estimate(property: PropertyInput, advisor?: Partial<Advisor>): Promise<EstimationData> {
  const r = await fetch(`${API}/api/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ property, advisor }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Recherche echouee');
  return r.json();
}

export async function generatePdf(data: EstimationData): Promise<Blob> {
  const r = await fetch(`${API}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error('Generation echouee');
  return r.blob();
}
