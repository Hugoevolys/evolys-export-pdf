import { useState } from 'react';
import clsx from 'clsx';
import type { WorksInput, WorksEstimate } from '@/types';
import { worksEstimate, worksPdf } from '@/lib/api';
import { Loader2, Search, MapPin, Building2, Hammer, ArrowLeft, RotateCcw, Zap, Upload, X, FileDown } from 'lucide-react';

const euro = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const cap = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

const KINDS = [['appartement', 'Appartement'], ['maison', 'Maison'], ['immeuble', 'Immeuble'], ['local', 'Local']] as const;
const EPOCHS = ['avant 1948', '1948-1974', 'apres 1974'] as const;
const CONDITIONS = ['à rafraîchir', 'à rénover', 'à restructurer'] as const;
const RENOS = ['rafraîchissement', 'partielle', 'complète', 'lourde'] as const;
const STANDINGS = [['essentiel', 'Essentiel'], ['confort', 'Confort'], ['prestige', 'Prestige']] as const;
const POSTES = [
  'Démolition / dépose', 'Création de cloisons', 'Plâtrerie & isolation', 'Électricité', 'Plomberie',
  'Chauffage', 'Menuiseries extérieures', 'Menuiseries intérieures', 'Revêtements de sol', 'Peinture',
  'Cuisine', 'Salle de bain', 'Extérieur (toiture/façade/ITE)',
];

const empty: WorksInput = {
  address: '', postalCode: '', city: '', floor: '', elevator: false, access: '',
  propertyKind: 'appartement', surface: 0, rooms: undefined, epoch: '', ceilingHeight: '',
  condition: 'à rénover', renoType: 'complète', standing: 'confort',
  postes: [], waterPoints: undefined, windows: undefined, notes: '',
};

export function WorksTool({ onBack }: { onBack: () => void }) {
  const [p, setP] = useState<WorksInput>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<WorksEstimate | null>(null);
  const set = (k: keyof WorksInput, v: any) => setP((s) => ({ ...s, [k]: v }));
  const togglePoste = (poste: string) => setP((s) => ({
    ...s, postes: s.postes.includes(poste) ? s.postes.filter((x) => x !== poste) : [...s.postes, poste],
  }));
  const valid = !!(p.postalCode.trim() && p.city.trim() && p.surface > 0);

  function onDpeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const b64 = res.includes(',') ? res.split(',')[1] : res;
      setP((s) => ({ ...s, dpePdfBase64: b64, dpePdfName: f.name, dpeScenario: s.dpeScenario || 'meilleure lettre' }));
    };
    reader.readAsDataURL(f);
  }
  const clearDpe = () => setP((s) => ({ ...s, dpePdfBase64: undefined, dpePdfName: undefined }));

  async function run() {
    setLoading(true); setError('');
    try { setResult(await worksEstimate(p)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  if (result) return <WorksResult data={result} onReset={() => setResult(null)} onBack={onBack} />;

  return (
    <div className="card space-y-6">
      <button className="text-sm text-navy/70 hover:text-navy flex items-center gap-1" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>
      <div>
        <h2 className="font-title text-2xl text-navy">Estimation des travaux</h2>
        <p className="text-sm text-slate-500 mt-1">Chiffrage détaillé par poste (base de prix 2025-2026, coefficient régional du code postal). Vise le juste prix du marché — pas un devis.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <Section title="Localisation & accès" icon={MapPin} required>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-6"><label className="label">Adresse</label>
            <input className="input" value={p.address || ''} onChange={(e) => set('address', cap(e.target.value))} placeholder="15 rue Jeanne d'Arc" /></div>
          <div className="col-span-2"><label className="label">Code postal *</label>
            <input className="input" value={p.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="76000" /></div>
          <div className="col-span-2"><label className="label">Ville *</label>
            <input className="input" value={p.city} onChange={(e) => set('city', cap(e.target.value))} placeholder="Rouen" /></div>
          <div className="col-span-1"><label className="label">Étage</label>
            <input className="input" value={p.floor || ''} onChange={(e) => set('floor', cap(e.target.value))} placeholder="2e" /></div>
          <div className="col-span-1"><label className="label">Ascenseur</label>
            <Toggle value={p.elevator ? '1' : '0'} onChange={(v) => set('elevator', v === '1')} options={[{ v: '1', label: 'Oui' }, { v: '0', label: 'Non' }]} /></div>
          <div className="col-span-6"><label className="label">Accès chantier <span className="text-slate-400 font-normal">(optionnel)</span></label>
            <input className="input" value={p.access || ''} onChange={(e) => set('access', e.target.value)} placeholder="centre-ville, rue étroite, pas de stationnement, monte-meuble…" /></div>
        </div>
      </Section>

      <Section title="Bien" icon={Building2} required>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3"><label className="label">Type de bien *</label>
            <select className="input" value={p.propertyKind} onChange={(e) => set('propertyKind', e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="col-span-1"><label className="label">Surface (m²) *</label>
            <input className="input" type="number" value={p.surface || ''} onChange={(e) => set('surface', +e.target.value)} placeholder="55" /></div>
          <div className="col-span-1"><label className="label">Pièces</label>
            <input className="input" type="number" value={p.rooms || ''} onChange={(e) => set('rooms', +e.target.value || undefined)} /></div>
          <div className="col-span-1"><label className="label">H. plafond</label>
            <input className="input" value={p.ceilingHeight || ''} onChange={(e) => set('ceilingHeight', e.target.value)} placeholder="2,50 m" /></div>
          <div className="col-span-3"><label className="label">Époque de construction</label>
            <select className="input" value={p.epoch || ''} onChange={(e) => set('epoch', e.target.value)}><option value="">—</option>{EPOCHS.map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
      </Section>

      <Section title="Ampleur & standing" icon={Hammer} required>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3"><label className="label">État général *</label>
            <select className="input" value={p.condition} onChange={(e) => set('condition', e.target.value)}>{CONDITIONS.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="col-span-3"><label className="label">Type de rénovation *</label>
            <select className="input" value={p.renoType} onChange={(e) => set('renoType', e.target.value)}>{RENOS.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="col-span-6"><label className="label">Standing *</label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white max-w-md">
              {STANDINGS.map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('standing', v)}
                  className={clsx('flex-1 px-3 py-2 text-sm font-medium transition-colors', p.standing === v ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-50')}>{l}</button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">Essentiel ×0,85 · Confort ×1,00 · Prestige ×1,40</p>
          </div>
        </div>
      </Section>

      <Section title="Postes de travaux" icon={Hammer} hint="cochez ; laissez vide = l'agent déduit">
        <div className="flex flex-wrap gap-2">
          {POSTES.map((poste) => {
            const on = p.postes.includes(poste);
            return (
              <button key={poste} type="button" onClick={() => togglePoste(poste)}
                className={clsx('px-3 py-1.5 rounded-full text-sm border transition-colors',
                  on ? 'bg-navy text-white border-navy' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50')}>{poste}</button>
            );
          })}
        </div>
        <div className="grid grid-cols-6 gap-3 mt-3">
          <div className="col-span-2"><label className="label">Nb points d'eau</label>
            <input className="input" type="number" value={p.waterPoints || ''} onChange={(e) => set('waterPoints', +e.target.value || undefined)} /></div>
          <div className="col-span-2"><label className="label">Nb fenêtres</label>
            <input className="input" type="number" value={p.windows || ''} onChange={(e) => set('windows', +e.target.value || undefined)} /></div>
        </div>
        <div className="mt-3"><label className="label">Description libre & contraintes</label>
          <textarea className="input" rows={3} value={p.notes || ''} onChange={(e) => set('notes', cap(e.target.value))} placeholder="souhaits du client, copropriété, PLU, secteur ABF, délais, postes particuliers…" /></div>
      </Section>

      <Section title="Rénovation énergétique (DPE Wizard)" icon={Zap} hint="optionnel — import du chiffrage énergie">
        {p.dpePdfName ? (
          <>
            <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <span className="truncate text-slate-700">📄 {p.dpePdfName}</span>
              <button type="button" className="text-slate-400 hover:text-red-600" onClick={clearDpe} aria-label="Retirer"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-6 gap-3 mt-3">
              <div className="col-span-3"><label className="label">Scénario retenu</label>
                <select className="input" value={p.dpeScenario || ''} onChange={(e) => set('dpeScenario', e.target.value)}>
                  <option value="meilleure lettre">Meilleure lettre</option>
                  <option value="meilleure rentabilite">Meilleure rentabilité</option>
                </select></div>
            </div>
          </>
        ) : (
          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500 hover:border-navy hover:text-navy transition-colors">
            <Upload className="h-4 w-4" /> Déposer le PDF DPE Wizard
            <input type="file" accept="application/pdf" className="hidden" onChange={onDpeFile} />
          </label>
        )}
        <p className="text-xs text-slate-400 mt-1">Importez le PDF DPE Wizard : Claude en extrait la synthèse financière et l'ajoute au total (hors aides), sans double comptage avec les postes ci-dessus. Le scénario apparaît une fois le PDF importé.</p>
      </Section>

      <button className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base" disabled={!valid || loading} onClick={run}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Patientez, chiffrage en cours…</> : <><Search className="h-4 w-4" /> Estimer les travaux</>}
      </button>
    </div>
  );
}

function WorksResult({ data, onReset, onBack }: { data: WorksEstimate; onReset: () => void; onBack: () => void }) {
  const [exporting, setExporting] = useState(false);
  async function exportPdf() {
    setExporting(true);
    try {
      const blob = await worksPdf(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'estimation_travaux.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  }
  return (
    <div className="card space-y-6">
      <button className="text-sm text-navy/70 hover:text-navy flex items-center gap-1" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>
      <div>
        <h2 className="font-title text-2xl text-navy">Estimation des travaux</h2>
        {data.recap && <p className="text-sm text-slate-500 mt-1">{data.recap}</p>}
      </div>

      {/* Bandeau total */}
      <div className="rounded-2xl bg-navy text-white p-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/60">{data.energy ? 'Travaux (hors énergie)' : 'Total projet estimé'}</div>
          <div className="font-title text-4xl mt-1">{euro(data.totalProjet)}</div>
          <div className="text-xs text-white/70 mt-1">fourchette {euro(data.fourchetteBasse)} – {euro(data.fourchetteHaute)}</div>
        </div>
        <div className="border-l border-white/20 pl-4">
          <div className="text-xs uppercase tracking-wide text-white/60">Coût travaux au m²</div>
          <div className="font-title text-4xl mt-1">{euro(data.coutM2)}</div>
          <div className="text-xs text-white/70 mt-1">{data.positionnement}</div>
        </div>
      </div>

      {/* Détail par poste */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-navy/70 mb-2">Détail par poste</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-navy text-white text-xs">
              <th className="p-2 text-left">Lot</th><th className="p-2 text-left">Poste</th><th className="p-2 text-left">Quantité</th><th className="p-2 text-left">P.U.</th><th className="p-2 text-right">Sous-total</th>
            </tr></thead>
            <tbody>
              {data.lines?.map((l, i) => (
                <tr key={i} className="border-b border-slate-200 align-top">
                  <td className="p-2 text-slate-500">{l.lot}</td>
                  <td className="p-2 font-medium text-slate-700">{l.poste}</td>
                  <td className="p-2 whitespace-nowrap text-slate-500">{l.quantite}</td>
                  <td className="p-2 whitespace-nowrap text-slate-500">{l.pu}</td>
                  <td className="p-2 text-right whitespace-nowrap">{euro(l.sousTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Synthèse */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm space-y-1">
        <Row label="Sous-total travaux" value={euro(data.sousTotalTravaux)} />
        <Row label={`Coefficient régional${data.regionalZone ? ` (${data.regionalZone})` : ''}`} value={`× ${data.regionalCoef}`} />
        <Row label={`Provision pour aléas`} value={`+ ${data.provisionAleasPct} %`} />
        <div className="border-t border-slate-200 my-1" />
        <Row label={data.energy ? 'Total travaux (hors énergie)' : 'Total projet'} value={euro(data.totalProjet)} bold />
      </div>

      {/* Bloc B — rénovation énergétique (DPE Wizard) */}
      {data.energy ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-navy/70 mb-2">Rénovation énergétique — DPE Wizard</div>
          <p className="text-xs text-slate-500 mb-2">Scénario : <strong>{data.energy.scenario}</strong>{data.energy.dpeGain ? ` · DPE ${data.energy.dpeGain}` : ''}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-navy/90 text-white text-xs"><th className="p-2 text-left">Poste énergie</th><th className="p-2 text-left">Équipement</th><th className="p-2 text-right">Coût</th></tr></thead>
              <tbody>
                {data.energy.lines?.map((l, i) => (
                  <tr key={i} className="border-b border-slate-200 align-top">
                    <td className="p-2 font-medium text-slate-700">{l.type}</td>
                    <td className="p-2 text-slate-500">{l.equipement || ''}</td>
                    <td className="p-2 text-right whitespace-nowrap">{euro(l.cout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between text-sm font-semibold text-navy mt-1"><span>Total rénovation énergétique</span><span>{euro(data.energy.total)}</span></div>
          {data.energy.note && <p className="text-xs text-slate-400 mt-1">{data.energy.note}</p>}
        </div>
      ) : null}

      {/* Total général */}
      {data.energy ? (
        <div className="rounded-xl bg-navy text-white p-4 flex items-center justify-between">
          <span className="text-sm uppercase tracking-wide text-white/70">Total général (travaux + énergie)</span>
          <span className="font-title text-2xl">{euro(data.totalGeneral)}</span>
        </div>
      ) : null}

      {data.hypotheses?.length ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-navy/70 mb-2">Hypothèses & réserves</div>
          <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
            {data.hypotheses.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <strong>Note.</strong> {data.disclaimer}
      </div>

      <div className="flex flex-wrap justify-between gap-2 pt-2">
        <button className="btn-ghost" onClick={onBack}>Accueil</button>
        <div className="flex gap-2">
          <button className="btn-ghost flex items-center gap-2" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Exporter en PDF
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={onReset}>
            <RotateCcw className="h-4 w-4" /> Nouvelle estimation
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={clsx('flex justify-between', bold && 'text-navy font-bold text-base')}>
      <span className={clsx(!bold && 'text-slate-500')}>{label}</span><span>{value}</span>
    </div>
  );
}

function Section({ title, icon: Icon, hint, required, children }: {
  title: string; icon: typeof MapPin; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy/10 text-navy"><Icon className="h-4 w-4" /></span>
        <span className="text-sm font-semibold text-navy">{title}{required && <span className="text-navy/50"> *</span>}</span>
        {hint && <span className="text-xs text-slate-400">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={clsx('flex-1 px-2 py-2 text-sm font-medium transition-colors', value === o.v ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-50')}>{o.label}</button>
      ))}
    </div>
  );
}
