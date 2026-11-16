import Anthropic from '@anthropic-ai/sdk';
import type { Listing } from '../src/types/index.ts';
import type { RawListing, RawHeader } from './pdfSplit.ts';
import { DEFAULT_TITLE } from '../src/lib/validate.ts';
import { randomUUID } from 'node:crypto';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const SYSTEM = `Tu reçois le texte brut d'UNE annonce immobilière issue d'un agrégateur.
Enregistre-la via l'outil fourni.
Règles :
- SUPPRIME toute coordonnée d'agent/agence concurrente (nom, tél, email, RSAC, SAFTI...).
- SUPPRIME le prix de vente publié de la description. Mets sa valeur numérique dans
  "netSellerPrice" comme point de départ (le conseiller la validera).
- Uniformise la description : orthographe, ponctuation, ton professionnel et neutre.
- Ne rien inventer ; mettre null si une donnée est absente.
- Si le texte contient plusieurs annonces, ne garde que la première.
- AUCUN tiret cadratin (—) ni demi-cadratin (–), ni dans le titre ni dans la description :
  utilise une virgule, deux-points, des parenthèses ou un point. Le trait d'union des mots
  composés (Saint-Germain, rez-de-chaussée) reste.`;

/** Filet de sécurité de la règle zéro tiret : « A – B » → « A, B », puce « — x » → « x ». */
const sansTirets = (t: string) =>
  t
    .replace(/^[ \t]*[–—][ \t]*/gm, '')
    .replace(/[ \t]*[–—][ \t]*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*([.:;!?)]|$)/gm, '$1')
    .trim();

// Sortie forcée via un outil : le modèle ne peut plus répondre en prose
// (bug du 02/11 : « Je détecte… » au lieu du JSON → tout l'upload échouait).
const TOOL = {
  name: 'enregistrer_annonce',
  description: "Enregistre l'annonce structurée et nettoyée.",
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string' },
      city: { type: 'string' },
      postalCode: { type: 'string' },
      surface: { type: ['number', 'null'] },
      rooms: { type: ['number', 'null'] },
      bedrooms: { type: ['number', 'null'] },
      landSurface: { type: ['number', 'null'] },
      dpe: { type: ['string', 'null'] },
      ges: { type: ['string', 'null'] },
      description: { type: 'string' },
      features: { type: 'array', items: { type: 'string' } },
      netSellerPrice: { type: ['number', 'null'] },
      isNewBuild: { type: 'boolean' },
    },
    required: ['title', 'city', 'postalCode', 'description', 'features', 'netSellerPrice', 'isNewBuild'],
  },
};

async function callModel(raw: RawListing): Promise<any> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content: `Texte de l'annonce :\n"""${raw.text}"""` }],
  });
  const block = msg.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    const txt = msg.content.map((b) => ('text' in b ? b.text : '')).join(' ').slice(0, 300);
    throw new Error(`Réponse IA sans données structurées : ${txt}`);
  }
  return block.input;
}

/** Structure + nettoie une annonce via Claude. Une annonce illisible ne bloque jamais tout l'upload. */
export async function extractListing(raw: RawListing): Promise<Listing> {
  let data: any = {};
  let warning: string | undefined;
  try {
    data = await callModel(raw);
  } catch (e1: any) {
    console.error('[extract] 1er essai échoué :', e1.message);
    try {
      data = await callModel(raw);
    } catch (e2: any) {
      console.error('[extract] 2e essai échoué :', e2.message, '| début du texte :', raw.text.slice(0, 200));
      warning = "Cette annonce n'a pas pu être lue automatiquement : complète titre, ville, prix et description à la main (ou retire-la).";
    }
  }

  if (warning && raw.header) {
    // Les données clés sont lues dans le PDF : seule la description manque.
    warning = "La description n'a pas pu être retraitée automatiquement : complète-la avant l'envoi.";
  }
  return applyHeader(buildListing(data, warning), raw.header);
}

/**
 * Les valeurs lues directement dans la fiche MoteurImmo (ville, CP, prix, pièces, surfaces,
 * DPE) priment sur la lecture IA : elles sont exactes par construction. L'IA garde le
 * titre (s'il est lisible), la description nettoyée et les atouts.
 */
export function applyHeader(l: Listing, h?: RawHeader): Listing {
  if (!h) return l;
  const out = { ...l };
  if (h.city) out.city = h.city;
  if (h.postalCode) out.postalCode = h.postalCode;
  if (!out.title?.trim() || out.title.trim() === DEFAULT_TITLE) {
    if (h.title) out.title = sansTirets(h.title);
  }
  if (h.rooms != null) out.rooms = h.rooms;
  if (h.bedrooms != null) out.bedrooms = h.bedrooms;
  if (h.surface != null) out.surface = h.surface;
  if (h.landSurface != null) out.landSurface = h.landSurface;
  if (h.dpe) out.dpe = h.dpe;
  if (h.ges) out.ges = h.ges;
  if (h.price != null && h.price > 0 && out.netSellerPrice !== h.price) {
    if (out.netSellerPrice > 0) {
      console.warn(`[extract] prix IA ${out.netSellerPrice} ≠ prix fiche ${h.price} : fiche retenue`);
    }
    out.netSellerPrice = h.price;
    out.notaryOverride = Math.round((h.price * out.notaryRate) / 100);
  }
  return out;
}

function buildListing(data: any, warning?: string): Listing {
  return {
    id: randomUUID(),
    title: sansTirets(data.title ?? DEFAULT_TITLE),
    city: data.city ?? '',
    postalCode: data.postalCode ?? '',
    surface: data.surface ?? 0,
    rooms: data.rooms ?? 0,
    bedrooms: data.bedrooms ?? 0,
    landSurface: data.landSurface ?? undefined,
    dpe: data.dpe ?? undefined,
    ges: data.ges ?? undefined,
    description: sansTirets(data.description ?? ''),
    features: Array.isArray(data.features) ? data.features.map(sansTirets) : [],
    netSellerPrice: data.netSellerPrice ?? 0,
    isNewBuild: Boolean(data.isNewBuild),
    mandateType: 'simple',
    notaryRate: data.isNewBuild ? 3 : 8.5,
    // Montant € pré-rempli = prix net × taux (le conseiller peut l'ajuster).
    notaryOverride: Math.round(((data.netSellerPrice ?? 0) * (data.isNewBuild ? 3 : 8.5)) / 100),
    advisorComment: '',
    photos: [], // chemins remplis depuis l'extraction PDF
    ...(warning ? { splitWarning: warning } : {}),
  };
}
