import Anthropic from '@anthropic-ai/sdk';
import type { WorksInput, WorksEstimate } from '../src/types/index.ts';
import { WORKS_SYSTEM, buildWorksPrompt } from './worksPrompt.ts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function collectText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

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
 * Estimation de couts de travaux (deterministe, sans recherche web).
 * Renvoie un WorksEstimate a afficher (aucun PDF).
 */
export async function worksResearch(input: WorksInput): Promise<WorksEstimate> {
  // PDF DPE Wizard : lu nativement par Claude via un bloc "document".
  const content: any[] = [];
  if (input.dpePdfBase64) {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.dpePdfBase64 } });
  }
  content.push({ type: 'text', text: buildWorksPrompt(input) });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 5000,
    system: WORKS_SYSTEM,
    messages: [{ role: 'user', content }],
  });

  const data = parseJson(collectText(msg.content)) as WorksEstimate;

  // Filet de securite : recale les totaux si l'IA derive (somme des lignes fait foi).
  const sum = Array.isArray(data.lines)
    ? Math.round(data.lines.reduce((s, l) => s + (Number(l.sousTotal) || 0), 0))
    : 0;
  if (sum > 0) data.sousTotalTravaux = sum;
  const coef = Number(data.regionalCoef) || 1;
  const aleas = Number(data.provisionAleasPct) || 12;
  const total = Math.round(data.sousTotalTravaux * coef * (1 + aleas / 100));
  if (total > 0) {
    data.totalProjet = total;
    data.fourchetteBasse = Math.round(total * 0.9);
    data.fourchetteHaute = Math.round(total * 1.15);
    if (input.surface > 0) data.coutM2 = Math.round(total / input.surface);
  }
  // Bloc B (energie) : total = somme des lignes si presentes ; total general = A + B.
  const energyTotal = data.energy?.lines?.length
    ? Math.round(data.energy.lines.reduce((s, l) => s + (Number(l.cout) || 0), 0))
    : Number(data.energy?.total) || 0;
  if (data.energy) data.energy.total = energyTotal;
  data.totalGeneral = (data.totalProjet || 0) + energyTotal;
  return data;
}
