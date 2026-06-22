import Anthropic from '@anthropic-ai/sdk';
import type { Listing } from '../src/types/index.ts';
import type { RawListing } from './pdfSplit.ts';
import { randomUUID } from 'node:crypto';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const SYSTEM = `Tu reçois le texte brut d'UNE annonce immobilière issue d'un agrégateur.
Renvoie un JSON strict conforme au schéma demandé.
Règles :
- SUPPRIME toute coordonnée d'agent/agence concurrente (nom, tél, email, RSAC, SAFTI...).
- SUPPRIME le prix de vente publié de la description. Mets sa valeur numérique dans
  "netSellerPrice" comme point de départ (le conseiller la validera).
- Uniformise la description : orthographe, ponctuation, ton professionnel et neutre.
- Ne rien inventer ; mettre null si une donnée est absente.
Réponds UNIQUEMENT par le JSON, sans texte autour.`;

const SCHEMA_HINT = `{
  "title": string,
  "city": string,
  "postalCode": string,
  "surface": number,
  "rooms": number,
  "bedrooms": number,
  "landSurface": number | null,
  "dpe": string | null,
  "ges": string | null,
  "description": string,
  "features": string[],
  "netSellerPrice": number,
  "isNewBuild": boolean
}`;

/** Structure + nettoie une annonce via Claude. */
export async function extractListing(raw: RawListing): Promise<Listing> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Schéma attendu :\n${SCHEMA_HINT}\n\nTexte de l'annonce :\n"""${raw.text}"""`,
      },
    ],
  });

  const textBlock = msg.content.find((b) => b.type === 'text');
  const jsonStr = (textBlock && 'text' in textBlock ? textBlock.text : '{}')
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const data = JSON.parse(jsonStr);

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
    notaryRate: data.isNewBuild ? 3 : 8,
    advisorComment: '',
    photos: [], // chemins remplis depuis l'extraction PDF
  };
}
