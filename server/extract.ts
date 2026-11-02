import Anthropic from '@anthropic-ai/sdk';
import type { Listing } from '../src/types/index.ts';
import type { RawListing } from './pdfSplit.ts';
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
- Si le texte contient plusieurs annonces, ne garde que la première.`;

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
      warning = "Cette annonce n'a pas pu être lue automatiquement : complétez titre, ville et prix à la main (ou retirez-la).";
    }
  }

  return {
    id: randomUUID(),
    title: data.title ?? 'Annonce',
    city: data.city ?? '',
    postalCode: data.postalCode ?? '',
    surface: data.surface ?? 0,
    rooms: data.rooms ?? 0,
    bedrooms: data.bedrooms ?? 0,
    landSurface: data.landSurface ?? undefined,
    dpe: data.dpe ?? undefined,
    ges: data.ges ?? undefined,
    description: data.description ?? '',
    features: Array.isArray(data.features) ? data.features : [],
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
