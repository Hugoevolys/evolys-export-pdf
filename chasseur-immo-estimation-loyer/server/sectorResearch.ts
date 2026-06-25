import Anthropic from '@anthropic-ai/sdk';
import type { SectorInput, SectorEstimate } from '../src/types/index.ts';
import { SECTOR_SYSTEM, buildSectorPrompt } from './sectorPrompt.ts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const WEB_SEARCH = (process.env.WEB_SEARCH ?? 'on').toLowerCase() !== 'off';
const WEB_SEARCH_MAX = Number(process.env.WEB_SEARCH_MAX_USES || 6);

function collectText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/** Extrait le 1er objet JSON valide d'une chaine (robuste au texte autour). */
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
    throw new Error('Reponse IA non parseable en JSON. Reessayez.');
  }
}

/**
 * Prix moyen d'achat d'un secteur (croisement annonces + prix au m2 + DVF).
 * Renvoie un SectorEstimate a afficher (aucun PDF).
 */
export async function sectorResearch(input: SectorInput): Promise<SectorEstimate> {
  const tools = WEB_SEARCH
    ? ([{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX }] as any)
    : undefined;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SECTOR_SYSTEM,
    ...(tools ? { tools } : {}),
    messages: [{ role: 'user', content: buildSectorPrompt(input) }],
  });

  const data = parseJson(collectText(msg.content)) as SectorEstimate;

  // Garantit la coherence des champs renvoyes a l'UI.
  data.city = data.city || input.city;
  data.postalCode = data.postalCode || input.postalCode;
  data.propertyType = data.propertyType || input.propertyType;
  data.surface = input.surface;
  return data;
}
