import * as fs from 'node:fs';
import * as path from 'node:path';

import { computeGlobalCost } from './notaryFees.ts';
import type { Listing, Settings } from '../src/types/index.ts';

/**
 * Pont vers l'ERP Evolys (espace client, 18/11/2026).
 *
 * Le navigateur de l'outil ne parle JAMAIS directement à l'ERP : il passe par
 * ce serveur, qui porte le jeton court du conseiller (8 h) et relit les photos
 * sur son disque. Aucun CORS à ouvrir côté ERP.
 *
 * Sans `ERP_API_URL`, rien de tout cela n'existe : l'outil fonctionne comme
 * avant (les routes /api/erp/* répondent 503 et l'interface ne les appelle
 * que si elle a reçu un jeton).
 */
const ERP = (process.env.ERP_API_URL ?? '').replace(/\/+$/, '');
const DELAI_MS = 60_000;

export function erpConfigure(): boolean {
  return ERP.length > 0;
}

export class ErreurErp extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message);
  }
}

async function appel(chemin: string, jeton: string, init: { method?: string; body?: FormData } = {}): Promise<any> {
  let r: Response;
  try {
    r = await fetch(`${ERP}/api${chemin}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${jeton}` },
      body: init.body,
      signal: AbortSignal.timeout(DELAI_MS),
    });
  } catch {
    throw new ErreurErp("L'espace Evolys ne répond pas. Réessayez dans un instant.", 502);
  }
  const texte = await r.text();
  let json: any = null;
  try {
    json = texte ? JSON.parse(texte) : null;
  } catch {
    /* page HTML d'erreur */
  }
  if (!r.ok) {
    const message = typeof json?.message === 'string' ? json.message : `Erreur ${r.status} de l'espace Evolys.`;
    throw new ErreurErp(message, r.status);
  }
  return json;
}

export const sessionErp = (jeton: string) => appel('/export-pdf/session', jeton);
export const renouvelerErp = (jeton: string) => appel('/export-pdf/jeton/renouveler', jeton, { method: 'POST' });

/**
 * Publie une sélection dans l'espace du client : données nettoyées de chaque
 * annonce (coût global calculé comme dans le PDF), photos lues sur le disque
 * de l'outil (dossier de travail uniquement), et le PDF généré.
 */
export async function publierErp(params: {
  jeton: string;
  contactId: string;
  cle: string;
  listings: Listing[];
  settings: Settings;
  pdf: Buffer;
  dossierTravail: string;
}): Promise<any> {
  const fd = new FormData();
  const annonces = params.listings.map((l, i) => {
    const cout = computeGlobalCost(l, params.settings);
    let n = 0;
    for (const p of l.photos) {
      const reel = path.resolve(p);
      // Jamais un fichier hors du dossier de travail de l'outil.
      if (!reel.startsWith(params.dossierTravail + path.sep) || !fs.existsSync(reel)) continue;
      fd.append(`photo_${i}_${n}`, new Blob([fs.readFileSync(reel)]), path.basename(reel));
      n += 1;
    }
    return {
      titre: l.title,
      ville: l.city,
      codePostal: l.postalCode || null,
      surface: Number.isFinite(l.surface) ? l.surface : null,
      pieces: Number.isFinite(l.rooms) ? Math.round(l.rooms) : null,
      dpe: l.dpe ?? null,
      atouts: l.features ?? [],
      description: l.description ?? '',
      prix: Math.round(cout.netSellerPrice),
      honoraires: Math.round(cout.commission),
      fraisNotaire: Math.round(cout.notary),
      total: Math.round(cout.total),
      avisConseiller: l.advisorComment?.trim() || null,
      nbPhotos: n,
    };
  });
  fd.append('donnees', JSON.stringify({ contactId: params.contactId, cle: params.cle, annonces }));
  fd.append('pdf', new Blob([new Uint8Array(params.pdf)], { type: 'application/pdf' }), 'selection.pdf');
  return appel('/export-pdf/selections', params.jeton, { method: 'POST', body: fd });
}
