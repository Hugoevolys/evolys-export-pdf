import { readFileSync } from 'node:fs';

/**
 * Indexation annuelle de la base de prix travaux sur l'indice INSEE BT01.
 * Regle : du 1er janvier N au 31 decembre N, coef = BT01(septembre N-1) / BT01(reference).
 * Septembre N-1 est publie a la mi-novembre N-1 : la valeur est donc connue au 1er janvier.
 * Avant la premiere revision (2027), coef = 1.
 */

interface Bt01Config {
  meta: { source: string; mois_indice: number; premiere_revision: number };
  reference: { mois: string; valeur: number };
  valeurs: Record<string, number>;
}

export interface Bt01Indexation {
  coef: number;            // multiplicateur applique aux prix de la grille
  moisIndice: string;      // mois BT01 utilise (ex "2026-09")
  valeur: number;          // valeur BT01 utilisee
  reference: { mois: string; valeur: number };
  annee: number;           // annee de prix en vigueur
  secours: boolean;        // true si l'INSEE n'a pas repondu et qu'on a pris la derniere valeur connue
}

const CFG: Bt01Config = JSON.parse(readFileSync(new URL('./bt01.json', import.meta.url), 'utf8'));
const cache: Record<string, number> = { ...CFG.valeurs };

async function fetchInsee(mois: string): Promise<number | null> {
  const url = `${CFG.meta.source}?startPeriod=${mois}&endPeriod=${mois}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/xml' } });
    if (!res.ok) return null;
    const xml = await res.text();
    const m = xml.match(new RegExp(`TIME_PERIOD="${mois}"[^>]*OBS_VALUE="([\\d.]+)"`));
    const v = m ? Number(m[1]) : NaN;
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Derniere valeur connue (fichier + cache) anterieure ou egale a `mois`. */
function derniereConnue(mois: string): [string, number] {
  const cles = Object.keys(cache).filter((k) => k <= mois).sort();
  const k = cles[cles.length - 1] ?? CFG.reference.mois;
  return [k, cache[k] ?? CFG.reference.valeur];
}

export async function getIndexationBt01(now = new Date()): Promise<Bt01Indexation> {
  const annee = now.getFullYear();
  const ref = CFG.reference;
  if (annee < CFG.meta.premiere_revision) {
    return { coef: 1, moisIndice: ref.mois, valeur: ref.valeur, reference: ref, annee, secours: false };
  }
  const mois = `${annee - 1}-${String(CFG.meta.mois_indice).padStart(2, '0')}`;
  let valeur = cache[mois];
  let moisIndice = mois;
  let secours = false;
  if (valeur === undefined) {
    const v = await fetchInsee(mois);
    if (v !== null) {
      cache[mois] = v;
      valeur = v;
    } else {
      [moisIndice, valeur] = derniereConnue(mois);
      secours = true;
      console.warn(`[BT01] INSEE injoignable pour ${mois}, repli sur ${moisIndice} = ${valeur}`);
    }
  }
  const coef = Math.round((valeur / ref.valeur) * 10000) / 10000;
  return { coef, moisIndice, valeur, reference: ref, annee, secours };
}

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const moisFr = (m: string) => {
  const [a, mm] = m.split('-').map(Number);
  return `${MOIS_FR[mm - 1]} ${a}`;
};

/** Phrase affichee a l'ecran et dans le PDF. */
export function phraseIndexation(ix: Bt01Indexation): string {
  const base = `Prix ${ix.annee}, indexés chaque 1er janvier sur l'indice INSEE BT01 (coût du bâtiment, tous corps d'état)`;
  if (ix.coef === 1) return `${base}, grille de référence de ${moisFr(ix.reference.mois)}.`;
  const pct = ((ix.coef - 1) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1, signDisplay: 'always' });
  return `${base} : ${pct} % depuis la grille de ${moisFr(ix.reference.mois)} (indice de ${moisFr(ix.moisIndice)}).`;
}
