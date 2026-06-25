import { useState } from 'react';
import clsx from 'clsx';
import type { SectorInput, SectorEstimate } from '@/types';
import { sectorEstimate } from '@/lib/api';
import { Loader2, Search, MapPin, ArrowLeft, RotateCcw, TrendingUp } from 'lucide-react';

const euro = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const eurM2 = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0)} €/m²`;
const cap = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

export function SectorTool({ onBack }: { onBack: () => void }) {
  const [input, setInput] = useState<SectorInput>({ city: '', postalCode: '', propertyType: 'appartement', surface: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SectorEstimate | null>(null);
  const set = (k: keyof SectorInput, v: any) => setInput((s) => ({ ...s, [k]: v }));
  const valid = !!(input.city.trim() && input.surface > 0);

  async function run() {
    setLoading(true); setError('');
    try {
      setResult(await sectorEstimate(input));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  if (result) return <SectorResult data={result} onReset={() => setResult(null)} onBack={onBack} />;

  return (
    <div className="card space-y-6">
      <button className="text-sm text-navy/70 hover:text-navy flex items-center gap-1" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>
      <div>
        <h2 className="font-title text-2xl text-navy">Prix moyen du secteur</h2>
        <p className="text-sm text-slate-500 mt-1">Claude croise les <strong>annonces en vente</strong> (Leboncoin, SeLoger), les <strong>prix au m²</strong> (MeilleursAgents, SeLoger) et les <strong>ventes réelles DVF</strong> (2 ans) pour donner le prix moyen d'achat du secteur. Repère de marché, pas un avis de valeur.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy/10 text-navy"><MapPin className="h-4 w-4" /></span>
          <span className="text-sm font-semibold text-navy">Secteur & bien</span>
        </div>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3"><label className="label">Ville *</label>
            <input className="input" value={input.city} onChange={(e) => set('city', cap(e.target.value))} placeholder="Rouen" /></div>
          <div className="col-span-1"><label className="label">Code postal</label>
            <input className="input" value={input.postalCode || ''} onChange={(e) => set('postalCode', e.target.value)} placeholder="76000" /></div>
          <div className="col-span-2"><label className="label">Surface (m²) *</label>
            <input className="input" type="number" value={input.surface || ''} onChange={(e) => set('surface', +e.target.value)} placeholder="70" /></div>
          <div className="col-span-6"><label className="label">Type de bien *</label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white max-w-xs">
              {([['appartement', 'Appartement'], ['maison', 'Maison']] as const).map(([v, lbl]) => (
                <button key={v} type="button" onClick={() => set('propertyType', v)}
                  className={clsx('flex-1 px-3 py-2 text-sm font-medium transition-colors',
                    input.propertyType === v ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-50')}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base" disabled={!valid || loading} onClick={run}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Patientez, recherche en cours…</> : <><Search className="h-4 w-4" /> Estimer le prix du secteur</>}
      </button>
    </div>
  );
}

function SectorResult({ data, onReset, onBack }: { data: SectorEstimate; onReset: () => void; onBack: () => void }) {
  const typeLabel = data.propertyType === 'maison' ? 'Maison' : 'Appartement';
  return (
    <div className="card space-y-6">
      <button className="text-sm text-navy/70 hover:text-navy flex items-center gap-1" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>
      <div>
        <h2 className="font-title text-2xl text-navy">Prix moyen du secteur</h2>
        <p className="text-sm text-slate-500 mt-1">{typeLabel} — {data.city}{data.postalCode ? ` (${data.postalCode})` : ''} · référence {data.surface} m²</p>
      </div>

      {/* Bandeau resultat */}
      <div className="rounded-2xl bg-navy text-white p-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/60 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Prix moyen au m²</div>
          <div className="font-title text-4xl mt-1">{eurM2(data.prixMoyenM2)}</div>
          <div className="text-xs text-white/70 mt-1">fourchette {eurM2(data.prixBasM2)} – {eurM2(data.prixHautM2)}</div>
        </div>
        <div className="border-l border-white/20 pl-4">
          <div className="text-xs uppercase tracking-wide text-white/60">Estimé pour {data.surface} m²</div>
          <div className="font-title text-4xl mt-1">{euro(data.prixEstimeBien)}</div>
          <div className="text-xs text-white/70 mt-1">{euro(data.prixEstimeBasse)} – {euro(data.prixEstimeHaute)}</div>
        </div>
      </div>

      {data.summary && <p className="text-sm leading-relaxed text-slate-700">{data.summary}</p>}

      {/* Sources */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-navy/70 mb-2">Sources croisées</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-navy text-white text-xs">
              <th className="p-2 text-left">Source</th><th className="p-2 text-left">Prix €/m²</th><th className="p-2 text-left">Détail</th>
            </tr></thead>
            <tbody>
              {data.sources?.map((s, i) => (
                <tr key={i} className="border-b border-slate-200 align-top">
                  <td className="p-2 font-medium text-slate-700">{s.source}</td>
                  <td className="p-2 whitespace-nowrap">{s.prixM2 || '—'}</td>
                  <td className="p-2 text-slate-500">{s.detail || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.fiabilite && <p className="text-xs text-slate-500">{data.fiabilite}</p>}
      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <strong>Note.</strong> {data.disclaimer}
      </div>

      <div className="flex justify-between pt-2">
        <button className="btn-ghost flex items-center gap-2" onClick={onBack}>Accueil</button>
        <button className="btn-primary flex items-center gap-2" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> Nouvelle recherche
        </button>
      </div>
    </div>
  );
}
