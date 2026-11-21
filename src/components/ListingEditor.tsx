import type { Listing, Settings, MandateType } from '@/types';
import { computeGlobalCost, computeCommission, euro } from '@/lib/cost';
import { useEffect, useState } from 'react';
import { fileUrl, uploadPhotos } from '@/lib/api';
import { ImagePlus, Loader2, X } from 'lucide-react';

const CLASSES_ENERGIE = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

export function ListingEditor({
  listing, index, total, settings, onChange, onAjouterPhotos,
}: {
  listing: Listing;
  index: number;
  total: number;
  settings: Settings;
  onChange: (l: Listing) => void;
  /** Ajoute des photos à CETTE annonce (mise à jour par id : sûr même si on change d'annonce pendant l'envoi). */
  onAjouterPhotos: (chemins: string[]) => void;
}) {
  const cost = computeGlobalCost(listing, settings);
  const autoCommission = computeCommission({ ...listing, commissionOverride: undefined }, settings);
  const m = settings.mandates[listing.mandateType];
  const set = (patch: Partial<Listing>) => onChange({ ...listing, ...patch });
  const [envoiPhotos, setEnvoiPhotos] = useState(false);
  const [erreurPhotos, setErreurPhotos] = useState('');
  useEffect(() => setErreurPhotos(''), [listing.id]);

  async function ajouterPhotos(files: File[]) {
    setEnvoiPhotos(true); setErreurPhotos('');
    try {
      const chemins = await uploadPhotos(files);
      onAjouterPhotos(chemins);
    } catch (e: any) {
      setErreurPhotos(e.message);
    } finally {
      setEnvoiPhotos(false);
    }
  }

  /** Champ numérique : vide = 0 (ou absent pour les champs facultatifs). */
  const nombre = (v: string) => (v === '' ? 0 : Math.max(0, Number(v) || 0));

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="text-xs text-slate-400 mb-1">Annonce {index} / {total}</div>
      <h2 className="text-lg font-semibold">{listing.title || 'Nouvelle annonce'}</h2>
      <div className="text-sm text-slate-500 mb-4">{listing.city} {listing.postalCode}</div>
      {listing.splitWarning && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">⚠ {listing.splitWarning}</div>
      )}

      {listing.manuelle && (
        <div className="mb-4 rounded-lg bg-evolys-light/40 p-3 text-sm text-slate-700">
          Annonce ajoutée à la main : ajoute les photos (enregistrées depuis l'annonce ou en captures d'écran),
          puis renseigne le titre, la ville, le prix et la description.
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600">
          Photos <span className="text-slate-400">({listing.photos.length})</span>
        </span>
        <span className="flex items-center gap-3">
          {listing.photos.length > 0 && (
            <span className="text-xs text-slate-400">Survolez une photo et cliquez sur ✕ pour la retirer</span>
          )}
          <label className={`inline-flex items-center gap-1 rounded-lg border border-evolys px-2.5 py-1 text-xs font-medium text-evolys
            ${envoiPhotos ? 'opacity-50' : 'cursor-pointer hover:bg-evolys-light/30'}`}>
            {envoiPhotos ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
            {envoiPhotos ? 'Envoi…' : 'Ajouter des photos'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={envoiPhotos}
              onChange={(e) => {
                if (e.target.files?.length) ajouterPhotos(Array.from(e.target.files));
                e.target.value = '';
              }} />
          </label>
        </span>
      </div>
      {erreurPhotos && <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erreurPhotos}</div>}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {listing.photos.map((p, i) => (
          <div key={i} className="relative group">
            <img src={fileUrl(p)} className="h-20 w-full object-cover rounded" />
            <button
              type="button"
              onClick={() => set({ photos: listing.photos.filter((_, idx) => idx !== i) })}
              title="Retirer cette photo"
              className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full
                bg-black/55 text-white opacity-70 group-hover:opacity-100 hover:bg-red-600 transition">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {listing.photos.length === 0 && (
          <div className="col-span-4 text-xs text-slate-400 italic">Aucune photo — cette annonce n'aura pas de photos dans le PDF.</div>
        )}
      </div>

      {/* Texte de l'annonce : modifiable si la lecture automatique a raté quelque chose. */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <label className="text-sm col-span-4">
          <span className="text-slate-600">Titre</span>
          <input className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="text-sm col-span-3">
          <span className="text-slate-600">Ville</span>
          <input className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.city} onChange={(e) => set({ city: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Code postal</span>
          <input className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Surface (m²)</span>
          <input type="number" min={0} className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.surface || ''} onChange={(e) => set({ surface: nombre(e.target.value) })} />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Pièces</span>
          <input type="number" min={0} className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.rooms || ''} onChange={(e) => set({ rooms: nombre(e.target.value) })} />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Chambres</span>
          <input type="number" min={0} className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.bedrooms || ''} onChange={(e) => set({ bedrooms: nombre(e.target.value) })} />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Terrain (m²)</span>
          <input type="number" min={0} className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.landSurface || ''}
            onChange={(e) => set({ landSurface: nombre(e.target.value) || undefined })} />
        </label>
        <label className="text-sm col-span-2">
          <span className="text-slate-600">DPE</span>
          <select className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.dpe ?? ''} onChange={(e) => set({ dpe: e.target.value || undefined })}>
            {CLASSES_ENERGIE.map((c) => <option key={c} value={c}>{c || 'Non renseigné'}</option>)}
          </select>
        </label>
        <label className="text-sm col-span-2">
          <span className="text-slate-600">GES</span>
          <select className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.ges ?? ''} onChange={(e) => set({ ges: e.target.value || undefined })}>
            {CLASSES_ENERGIE.map((c) => <option key={c} value={c}>{c || 'Non renseigné'}</option>)}
          </select>
        </label>
        <label className="text-sm col-span-4">
          <span className="text-slate-600">Description</span>
          <textarea className="mt-1 w-full border rounded-lg px-3 py-2" rows={5}
            value={listing.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="text-sm">
          <span className="text-slate-600">Prix de vente (€)</span>
          <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.netSellerPrice}
            onChange={(e) => {
              const price = Number(e.target.value);
              // Recalcule le montant € des frais de notaire quand le prix change.
              set({ netSellerPrice: price, notaryOverride: Math.round((price * listing.notaryRate) / 100) });
            }} />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Type de mandat</span>
          <select className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.mandateType}
            onChange={(e) => set({ mandateType: e.target.value as MandateType })}>
            <option value="exclusif">Mandat de confiance — {settings.mandates.exclusif.rate}% (min {euro(settings.mandates.exclusif.floor)})</option>
            <option value="simple">Mandat simple — {settings.mandates.simple.rate}% (min {euro(settings.mandates.simple.floor)})</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Type de bien</span>
          <select className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.isNewBuild ? 'neuf' : 'ancien'}
            onChange={(e) => {
              const neuf = e.target.value === 'neuf';
              const rate = neuf ? settings.notaryRateNew : settings.notaryRate;
              // Applique le taux par défaut ET recalcule le montant € des frais de notaire.
              set({ isNewBuild: neuf, notaryRate: rate, notaryOverride: Math.round((listing.netSellerPrice * rate) / 100) });
            }}>
            <option value="ancien">Ancien — {settings.notaryRate}% de notaire</option>
            <option value="neuf">Neuf — {settings.notaryRateNew}% de notaire</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Frais de notaire (€)</span>
          <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2"
            value={listing.notaryOverride ?? ''}
            onChange={(e) => set({ notaryOverride: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <a href="https://www.anil.org/outils/outils-de-calcul/frais-dacquisition-dits-frais-de-notaire/"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-evolys underline hover:text-evolys-dark">
            Calculer les frais de notaire (ANIL) ↗
          </a>
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
        <div className="flex justify-between"><span>Prix de vente</span><span>{euro(cost.netSellerPrice)}</span></div>
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
