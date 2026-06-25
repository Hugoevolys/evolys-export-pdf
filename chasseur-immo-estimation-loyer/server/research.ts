import Anthropic from '@anthropic-ai/sdk';
import type { PropertyInput, EstimationData, Advisor } from '../src/types/index.ts';
import { SYSTEM, buildUserPrompt } from './prompt.ts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
// Recherche web : activable/desactivable + nombre de recherches (cout).
const WEB_SEARCH = (process.env.WEB_SEARCH ?? 'on').toLowerCase() !== 'off';
const WEB_SEARCH_MAX = Number(process.env.WEB_SEARCH_MAX_USES || 6);

function todayFr(): string {
  return new Date().toLocaleDateString('fr-FR');
}

function collectText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/** Extrait le 1er objet JSON valide d'une chaine (robuste au texte/citations autour). */
function parseJson(text: string): any {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* noop */ }
    }
    throw new Error('Reponse IA non parseable en JSON. Reessayez ou completez la fiche.');
  }
}

/**
 * Recherche + structuration via Claude (avec recherche web optionnelle).
 * Renvoie un EstimationData a relire/corriger par le conseiller.
 */
export async function research(input: PropertyInput, advisor?: Partial<Advisor>): Promise<EstimationData> {
  const tools = WEB_SEARCH
    ? ([{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX }] as any)
    : undefined;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: SYSTEM,
    ...(tools ? { tools } : {}),
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  });

  const data = parseJson(collectText(msg.content)) as EstimationData;

  // Le gabarit prefixe deja "Avertissement." : on retire un eventuel doublon en
  // tete du champ disclaimer renvoye par l'IA (evite "Avertissement. Avertissement. ...").
  if (data.disclaimer) {
    data.disclaimer = data.disclaimer.replace(/^\s*avertissement\s*[.:-]*\s*/i, '').trim();
  }

  // Injecte marque / conseiller / client / date (non demandes a l'IA).
  data.advisor = {
    company: advisor?.company || 'Evolys',
    advisorName: advisor?.advisorName || '',
    advisorLastName: advisor?.advisorLastName,
    rsac: advisor?.rsac,
    role: advisor?.role || 'Chasseur immobilier',
    date: advisor?.date || todayFr(),
    client: advisor?.client,
  };
  data.furnished = input.furnished;
  if (!data.footerAddress) data.footerAddress = `${input.address}, ${input.postalCode} ${input.city}`;
  return data;
}
