import type { Listing, Settings, MandateType } from '@/types';
import { computeGlobalCost, computeCommission, euro } from '@/lib/cost';
import { fileUrl } from '@/lib/api';

export function ListingEditor({
  listing, index, total, settings, onChange,
}: {
  listing: Listing;
  index: number;
  total: number;
  settings: Settings;
  onChange: (l: Listing) => void;
}) {
  const cost = computeGlobalCost(listing, settings);
  const autoCommission = computeCommission({ ...listing, commissionOverride: undefined }, settings);
  const m = settings.mandates[listing.mandateType];
  const set = (patch: Partial<Listing>) => onChange({ ...listing, ...patch });

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="text-xs text-slate-400 mb-1">Annonce {index} / {total}</div>
      <h2 className="text-lg font-semibold">{listing.title}</h2>
      <div className="text-sm text-slate-500 mb-4">{listing.city} {listing.postalCode}</div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {listing.photos.map((p, i) => (
          <img key={i} src={fileUrl(p)}
               className="h-20 w-full object-cover rounded" />
        ))}
        {listing.photos.length === 0 && (
          <div className="col-span-4 text-xs text-slate-400 italic">Photos source affichées ici (non modifiées).</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="text-sm">
          <span className="text-slate-600">Prix net vendeur (€)</span>
          <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.netSellerPrice}
            onChange={(e) => set({ netSellerPrice: Number(e.target.value) })} />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Type de mandat</span>
          <select className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.mandateType}
            onChange={(e) => set({ mandateType: e.target.value as MandateType })}>
            <option value="simple">Mandat simple — {settings.mandates.simple.rate}% (min {euro(settings.mandates.simple.floor)})</option>
            <option value="exclusif">Mandat exclusif — {settings.mandates.exclusif.rate}% (min {euro(settings.mandates.exclusif.floor)})</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Type de bien</span>
          <select className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.isNewBuild ? 'neuf' : 'ancien'}
            onChange={(e) => {
              const neuf = e.target.value === 'neuf';
              // Bascule le type ET applique le taux de notaire par défaut correspondant.
              set({ isNewBuild: neuf, notaryRate: neuf ? settings.notaryRateNew : settings.notaryRate });
            }}>
            <option value="ancien">Ancien — {settings.notaryRate}% de notaire</option>
            <option value="neuf">Neuf — {settings.notaryRateNew}% de notaire</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Frais de notaire (%)</span>
          <input type="number" step="0.1" className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.notaryRate}
            onChange={(e) => set({ notaryRate: Number(e.target.value) })} />
        </label>
        <label className="text-sm col-span-2">
          <span className="text-slate-600">Commission (auto, modifiable €)</span>
          <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2"
            placeholder={String(Math.round(autoCommission))}
            value={listing.commissionOverride ?? ''}
            onChange={(e) => set({ commissionOverride: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <span className="text-xs text-slate-400">Auto = max({m.rate}% × prix, {euro(m.floor)}) = {euro(autoCommission)}</span>
        </label>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 text-sm mb-4">
        <div className="flex justify-between"><span>Prix net vendeur</span><span>{euro(cost.netSellerPrice)}</span></div>
        <div className="flex justify-between"><span>Commission Evolys</span><span>{euro(cost.commission)}</span></div>
        <div className="flex justify-between"><span>Frais de notaire (est.)</span><span>{euro(cost.notary)}</span></div>
        <div className="flex justify-between font-semibold text-evolys border-t mt-1 pt-1">
          <span>COÛT GLOBAL</span><span>{euro(cost.total)}</span>
        </div>
      </div>

      <label className="text-sm block">
        <span className="text-slate-600">Commentaire du conseiller</span>
        <textarea className="mt-1 w-full border rounded-lg px-3 py-2" rows={3}
          value={listing.advisorComment}
          onChange={(e) => set({ advisorComment: e.target.value })} />
      </label>
    </div>
  );
}
