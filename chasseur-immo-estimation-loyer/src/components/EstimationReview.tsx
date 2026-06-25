import { useState } from 'react';
import type { EstimationData } from '@/types';
import { FileDown, Loader2, Code2, RotateCcw } from 'lucide-react';

/**
 * Relecture / correction avant generation. Le conseiller valide les chiffres
 * (l'IA peut se tromper, surtout sur les plafonds legaux). Les champs cles
 * sont editables directement ; un editeur JSON avance permet de tout ajuster.
 */
export function EstimationReview({ data, onChange, onGenerate, onBack, loading }: {
  data: EstimationData;
  onChange: (d: EstimationData) => void;
  onGenerate: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [showJson, setShowJson] = useState(false);
  const [jsonErr, setJsonErr] = useState('');
  const m = data.market;
  const setM = (k: keyof typeof m, v: number) => onChange({ ...data, market: { ...m, [k]: v } });

  return (
    <div className="card space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-title text-xl text-navy">Vérification de l'estimation</h2>
          <p className="text-sm text-slate-500">Contrôlez les chiffres avant de générer. Variante détectée : <strong>{data.variant === 'encadre' ? 'avec encadrement' : 'loyer libre'}</strong>.</p>
        </div>
        <button className="btn-ghost flex items-center gap-2 text-xs" onClick={() => setShowJson((s) => !s)}>
          <Code2 className="h-4 w-4" /> {showJson ? 'Vue simple' : 'Éditer le JSON complet'}
        </button>
      </div>

      <div>
        <label className="label">Bien estimé (ligne d'en-tête)</label>
        <textarea className="input" rows={2} value={data.bienEstime} onChange={(e) => onChange({ ...data, bienEstime: e.target.value })} />
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-navy/70 mb-2">Loyer de marché (€/mois HC)</div>
        <div className="grid grid-cols-3 gap-3">
          <NumBox label="Basse" v={m.basse} onV={(v) => setM('basse', v)} sub={m.basseM2} onSub={(v) => setM('basseM2', v)} />
          <NumBox label="Moyen" v={m.moyen} onV={(v) => setM('moyen', v)} sub={m.moyenM2} onSub={(v) => setM('moyenM2', v)} />
          <NumBox label="Haute" v={m.haute} onV={(v) => setM('haute', v)} sub={m.hauteM2} onSub={(v) => setM('hauteM2', v)} />
        </div>
        <button className="text-xs text-navy/70 mt-2 flex items-center gap-1 hover:text-navy"
          onClick={() => onChange({ ...data, market: { ...m,
            basseM2: round1(m.basse / surfaceGuess(data)), moyenM2: round1(m.moyen / surfaceGuess(data)), hauteM2: round1(m.haute / surfaceGuess(data)) } })}>
          <RotateCcw className="h-3 w-3" /> Recalculer les €/m² depuis la surface
        </button>
      </div>

      {data.variant === 'encadre' && data.ceilingRows?.length ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-navy/70 mb-2">Plafonds légaux (vérifier sur le simulateur officiel)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-navy text-white"><th className="p-2 text-left">Époque</th><th className="p-2">Réf €/m²</th><th className="p-2">Majoré €/m²</th><th className="p-2">Plafond légal (surface)</th></tr></thead>
              <tbody>
                {data.ceilingRows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2">{r.epoque}</td>
                    <td className="p-1"><input className="input py-1 text-center" type="number" step="0.1" value={r.loyerRefM2} onChange={(e) => editRow(i, 'loyerRefM2', +e.target.value)} /></td>
                    <td className="p-1"><input className="input py-1 text-center" type="number" step="0.1" value={r.plafondMajoreM2} onChange={(e) => editRow(i, 'plafondMajoreM2', +e.target.value)} /></td>
                    <td className="p-1"><input className="input py-1 text-center font-semibold" type="number" value={r.plafondLegalSurface} onChange={(e) => editRow(i, 'plafondLegalSurface', +e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div>
        <label className="label">Paragraphe marché</label>
        <textarea className="input" rows={4} value={m.paragraph} onChange={(e) => setM('paragraph' as any, e.target.value as any)} />
      </div>
      <div>
        <label className="label">Avertissement</label>
        <textarea className="input" rows={3} value={data.disclaimer} onChange={(e) => onChange({ ...data, disclaimer: e.target.value })} />
      </div>

      {showJson && (
        <div>
          <label className="label">JSON complet (EstimationData)</label>
          <textarea className="input font-mono text-xs" rows={16} defaultValue={JSON.stringify(data, null, 2)}
            onChange={(e) => {
              try { onChange(JSON.parse(e.target.value)); setJsonErr(''); }
              catch (err: any) { setJsonErr(err.message); }
            }} />
          {jsonErr && <div className="text-xs text-red-600 mt-1">JSON invalide : {jsonErr}</div>}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button className="btn-ghost" onClick={onBack}>Retour</button>
        <button className="btn-primary flex items-center gap-2" disabled={loading} onClick={onGenerate}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Générer le PDF
        </button>
      </div>
    </div>
  );

  function editRow(i: number, k: string, v: number) {
    const rows = [...(data.ceilingRows || [])];
    rows[i] = { ...rows[i], [k]: v } as any;
    onChange({ ...data, ceilingRows: rows });
  }
}

function NumBox({ label, v, onV, sub, onSub }: { label: string; v: number; onV: (n: number) => void; sub: number; onSub: (n: number) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <input className="input text-center text-lg font-bold" type="number" value={v} onChange={(e) => onV(+e.target.value)} />
      <div className="flex items-center gap-1 mt-2 justify-center text-xs text-slate-400">
        <input className="input py-1 w-20 text-center" type="number" step="0.1" value={sub} onChange={(e) => onSub(+e.target.value)} /> €/m²
      </div>
    </div>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
// Surface déduite de la ligne "bien estimé" si possible, sinon 1 (no-op).
function surfaceGuess(d: EstimationData): number {
  const match = d.bienEstime.match(/(\d+)\s*m2/);
  return match ? +match[1] : 1;
}
