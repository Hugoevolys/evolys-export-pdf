import { useState } from 'react';
import clsx from 'clsx';
import type { PropertyInput, Advisor } from '@/types';
import { Loader2, Search, MapPin, Building2, Sparkles, UserRound } from 'lucide-react';

const EPOCHS = ['av.1946', '1946-1970', '1971-1990', '1991-2005', 'ap.2005'];
const DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const HEATING = ['Individuel gaz', 'Individuel électrique', 'Collectif', 'Pompe à chaleur', 'Bois / autre'];
const KITCHENS = ['Équipée', 'Aménagée', 'Semi-équipée', 'Nue'];
const LEASES = ['Meublé 1 an', 'Nu 3 ans', 'Bail mobilité', 'Bail étudiant'];
const EXTERIORS = ['Balcon', 'Terrasse', 'Jardin'];
const ANNEXES = ['Cave', 'Parking', 'Box', 'Garage'];

// 1re lettre en majuscule automatique pour les champs en saisie libre.
const cap = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

const empty: PropertyInput = {
  address: '', postalCode: '', city: '',
  surface: 0, rooms: 3, bedrooms: 2,
  furnished: true, constructionEpoch: '1991-2005',
  floor: '', elevator: false, dpe: 'D',
};

export function PropertyForm({ onSubmit, loading }: {
  onSubmit: (p: PropertyInput, a: Partial<Advisor>) => void;
  loading: boolean;
}) {
  const [p, setP] = useState<PropertyInput>(empty);
  // Le rôle est toujours « Chasseur immobilier » : fixe, non saisi par le conseiller.
  const [advisor, setAdvisor] = useState<Partial<Advisor>>({ company: 'Evolys', advisorName: '', advisorLastName: '', rsac: '', rsacCity: '', proAddress: '', role: 'Chasseur immobilier', client: '' });
  const set = (k: keyof PropertyInput, v: any) => setP((s) => ({ ...s, [k]: v }));
  const setA = (k: keyof Advisor, v: any) => setAdvisor((s) => ({ ...s, [k]: v }));
  // Coche/décoche une option multi-select a partir de l'etat le plus recent (robuste).
  const toggleMulti = (k: 'exterior' | 'annexes', opt: string) => setP((s) => {
    const cur = (s[k] || '').split(',').map((x) => x.trim()).filter(Boolean);
    const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
    return { ...s, [k]: next.join(', ') };
  });

  const valid = !!(
    p.address && p.postalCode && p.city && p.surface > 0 &&
    advisor.advisorName?.trim() && advisor.advisorLastName?.trim() && advisor.rsac?.trim() &&
    advisor.rsacCity?.trim() && advisor.proAddress?.trim()
  );

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="font-title text-2xl text-navy">Fiche du bien</h2>
        <p className="text-sm text-slate-500 mt-1">Les champs marqués <span className="text-navy font-semibold">*</span> sont indispensables. Claude vérifie ensuite la zone tendue, l'encadrement et les loyers de marché.</p>
      </div>

      <Section title="Localisation" icon={MapPin} required>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-4"><label className="label">Adresse (n° + voie) *</label>
            <input className="input" value={p.address} onChange={(e) => set('address', cap(e.target.value))} placeholder="20 Rue Bourget" /></div>
          <div><label className="label">Code postal *</label>
            <input className="input" value={p.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="69009" /></div>
          <div><label className="label">Ville *</label>
            <input className="input" value={p.city} onChange={(e) => set('city', cap(e.target.value))} placeholder="Lyon" /></div>
        </div>
      </Section>

      <Section title="Caractéristiques" icon={Building2} required>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-2"><label className="label">Surface (m²) *</label>
            <input className="input" type="number" value={p.surface || ''} onChange={(e) => set('surface', +e.target.value)} placeholder="49" /></div>
          <div><label className="label">Pièces (T) *</label>
            <input className="input" type="number" value={p.rooms} onChange={(e) => set('rooms', +e.target.value)} /></div>
          <div><label className="label">Chambres *</label>
            <input className="input" type="number" value={p.bedrooms} onChange={(e) => set('bedrooms', +e.target.value)} /></div>
          <div><label className="label">Étage *</label>
            <input className="input" value={p.floor} onChange={(e) => set('floor', cap(e.target.value))} placeholder="2e" /></div>
          <div><label className="label">DPE *</label>
            <select className="input" value={p.dpe} onChange={(e) => set('dpe', e.target.value)}>{DPE.map((d) => <option key={d}>{d}</option>)}</select></div>

          <div className="col-span-2"><label className="label">Meublé *</label>
            <Toggle value={p.furnished ? '1' : '0'} onChange={(v) => set('furnished', v === '1')}
              options={[{ v: '1', label: 'Meublé' }, { v: '0', label: 'Non meublé' }]} /></div>
          <div className="col-span-2"><label className="label">Ascenseur</label>
            <Toggle value={p.elevator ? '1' : '0'} onChange={(v) => set('elevator', v === '1')}
              options={[{ v: '1', label: 'Oui' }, { v: '0', label: 'Non' }]} /></div>
          <div className="col-span-2"><label className="label">Époque de construction *</label>
            <select className="input" value={p.constructionEpoch} onChange={(e) => set('constructionEpoch', e.target.value)}>{EPOCHS.map((x) => <option key={x}>{x}</option>)}</select></div>

          <div className="col-span-3"><label className="label">État général</label>
            <select className="input" value={p.condition || ''} onChange={(e) => set('condition', e.target.value)}><option value="">—</option><option>neuf / refait à neuf</option><option>bon</option><option>à rafraîchir</option><option>travaux</option></select></div>
          <div className="col-span-3"><label className="label">Chauffage</label>
            <select className="input" value={p.heating || ''} onChange={(e) => set('heating', e.target.value)}><option value="">—</option>{HEATING.map((h) => <option key={h}>{h}</option>)}</select></div>
        </div>
      </Section>

      <Section title="Qualitatif" icon={Sparkles} hint="affine la fourchette">
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3"><label className="label">Extérieur</label>
            <CheckChips value={p.exterior || ''} options={EXTERIORS} onToggle={(opt) => toggleMulti('exterior', opt)} /></div>
          <div className="col-span-3"><label className="label">Annexes</label>
            <CheckChips value={p.annexes || ''} options={ANNEXES} onToggle={(opt) => toggleMulti('annexes', opt)} /></div>
          <div className="col-span-2"><label className="label">Cuisine</label>
            <select className="input" value={p.kitchen || ''} onChange={(e) => set('kitchen', e.target.value)}><option value="">—</option>{KITCHENS.map((k) => <option key={k}>{k}</option>)}</select></div>
          <div className="col-span-2"><label className="label">Charges (€/mois)</label>
            <input className="input" type="number" value={p.charges || ''} onChange={(e) => set('charges', +e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Type de bail visé</label>
            <select className="input" value={p.leaseType || ''} onChange={(e) => set('leaseType', e.target.value)}><option value="">—</option>{LEASES.map((l) => <option key={l}>{l}</option>)}</select></div>
          <div className="col-span-3"><label className="label">Déjà loué (loyer actuel)</label>
            <input className="input" value={p.alreadyRented || ''} onChange={(e) => set('alreadyRented', cap(e.target.value))} placeholder="ex : 690 € HC" /></div>
          <div className="col-span-6"><label className="label">Remarques pour la recherche</label>
            <textarea className="input" rows={2} value={p.notes || ''} onChange={(e) => set('notes', cap(e.target.value))} placeholder="vue dégagée, secteur recherché, travaux récents..." /></div>
        </div>
      </Section>

      <Section title="Conseiller & client" icon={UserRound} hint="en-tête & mentions légales du PDF">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Conseiller — prénom *</label>
            <input className="input" value={advisor.advisorName || ''} onChange={(e) => setA('advisorName', cap(e.target.value))} placeholder="Hugo" /></div>
          <div><label className="label">Conseiller — nom *</label>
            <input className="input" value={advisor.advisorLastName || ''} onChange={(e) => setA('advisorLastName', cap(e.target.value))} placeholder="Martin" /></div>
          <div><label className="label">Numéro RSAC *</label>
            <input className="input" value={advisor.rsac || ''} onChange={(e) => setA('rsac', e.target.value)} placeholder="ex : 902 345 678" /></div>
          <div><label className="label">Ville d'immatriculation RSAC *</label>
            <input className="input" value={advisor.rsacCity || ''} onChange={(e) => setA('rsacCity', cap(e.target.value))} placeholder="Dieppe" /></div>
          <div className="col-span-2"><label className="label">Adresse professionnelle *</label>
            <input className="input" value={advisor.proAddress || ''} onChange={(e) => setA('proAddress', cap(e.target.value))} placeholder="12 rue de l'Exemple, 76200 Dieppe" /></div>
          <div className="col-span-2"><label className="label">À l'attention de (client)</label>
            <input className="input" value={advisor.client || ''} onChange={(e) => setA('client', cap(e.target.value))} placeholder="M. et Mme Martin" /></div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Ces informations alimentent les mentions légales en pied de page (agent commercial immobilier, RSAC, EI). Le document est daté automatiquement au jour de la génération.</p>
      </Section>

      <button className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base" disabled={!valid || loading}
        onClick={() => onSubmit(p, advisor)}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Patientez, la génération est en cours…</> : <><Search className="h-4 w-4" /> Lancer l'estimation</>}
      </button>
    </div>
  );
}

function Section({ title, icon: Icon, hint, required, children }: {
  title: string;
  icon: typeof MapPin;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy/10 text-navy">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold text-navy">{title}{required && <span className="text-navy/50"> *</span>}</span>
        {hint && <span className="text-xs text-slate-400">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={clsx(
            'flex-1 px-3 py-2 text-sm font-medium transition-colors',
            value === o.v ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-50',
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-sélection : chaque option se coche/décoche ; stocké en chaine "A, B". */
function CheckChips({ value, options, onToggle }: {
  value: string;
  options: string[];
  onToggle: (opt: string) => void;
}) {
  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return (
    <div className="flex flex-wrap gap-2 pt-0.5">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm border transition-colors',
              on ? 'bg-navy text-white border-navy' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
            )}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}
