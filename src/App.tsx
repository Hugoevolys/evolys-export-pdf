import { useState, useEffect } from 'react';
import type { GeneralInfo, Listing, Settings } from '@/types';
import { uploadPdf, generatePdf, getSettings } from '@/lib/api';
import { GeneralInfoForm } from '@/components/GeneralInfoForm';
import { ListingEditor } from '@/components/ListingEditor';
import { Upload, Loader2, FileDown, X, ArrowRight } from 'lucide-react';

type Step = 'upload' | 'general' | 'listings' | 'done';

const emptyInfo: GeneralInfo = {
  clientFirstName: '', clientLastName: '',
  advisorFirstName: '', advisorLastName: '',
  advisorPhone: '', advisorEmail: '', advisorRsac: '',
  advisorRsacCity: '', advisorAddress: '',
};

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<GeneralInfo>(emptyInfo);
  const [listings, setListings] = useState<Listing[]>([]);
  const [current, setCurrent] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => { getSettings().then(setSettings).catch(() => {}); }, []);

  async function handleAddFiles(files: FileList) {
    setLoading(true); setError('');
    try {
      // Traite chaque document déposé et cumule les annonces extraites.
      for (const file of Array.from(files)) {
        const res = await uploadPdf(file);
        setListings((prev) => [...prev, ...res.listings]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const removeListing = (id: string) =>
    setListings((prev) => prev.filter((l) => l.id !== id));

  // Fusionne une annonce (sur-découpée) avec la précédente : ses photos sont
  // récupérées dans l'annonce précédente, puis elle est retirée. Aucune photo perdue.
  const mergeWithPrevious = (id: string) =>
    setListings((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx <= 0) return prev;
      return prev
        .map((l, i) => (i === idx - 1 ? { ...l, photos: [...l.photos, ...prev[idx].photos] } : l))
        .filter((_, i) => i !== idx);
    });

  async function handleExport() {
    setLoading(true); setError('');
    try {
      const blob = await generatePdf(info, listings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'selection-evolys.pdf'; a.click();
      setStep('done');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const updateListing = (l: Listing) =>
    setListings((prev) => prev.map((x, i) => (i === current ? l : x)));

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-evolys-light/40 via-slate-50 to-slate-50">
      <header className="max-w-3xl mx-auto mb-8 flex items-center justify-between">
        <img src="/evolys-logo.svg" alt="Evolys" className="h-11" />
        <span className="text-xs font-medium uppercase tracking-wider text-evolys/60">Export PDF Annonces</span>
      </header>

      {error && <div className="max-w-3xl mx-auto mb-4 bg-red-50 text-red-700 rounded-lg p-3">{error}</div>}

      <main className="max-w-3xl mx-auto">
        {step === 'upload' && (
          <div>
            <div className="text-center mb-8">
              <h1 className="font-title text-3xl text-evolys mb-2">Créez votre sélection de biens</h1>
              <p className="text-slate-500">
                Déposez vos annonces moteur immo : l'outil les nettoie et génère un PDF client à votre image.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg shadow-evolys/5 ring-1 ring-slate-100 p-8">
              <label className={`group block rounded-2xl p-10 text-center cursor-pointer border-2 border-dashed transition-all
                ${loading ? 'border-evolys bg-evolys-light/30' : 'border-slate-200 hover:border-evolys hover:bg-evolys-light/20'}`}>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-evolys-light flex items-center justify-center transition-transform group-hover:scale-105">
                  {loading
                    ? <Loader2 className="h-7 w-7 animate-spin text-evolys" />
                    : <Upload className="h-7 w-7 text-evolys" />}
                </div>
                <div className="font-title text-lg text-evolys">Déposer vos exports PDF MoteurImmo</div>
                <div className="text-sm text-slate-500 mt-1">Fichiers PDF — un ou plusieurs à la fois</div>
                <div className="text-xs text-slate-400 mt-3 max-w-sm mx-auto leading-relaxed">
                  {loading
                    ? 'Extraction en cours… (≈ 30 s par document)'
                    : 'Vous pouvez ajouter vos documents en plusieurs fois. Chaque PDF est découpé automatiquement en annonces.'}
                </div>
                <input type="file" accept="application/pdf" multiple className="hidden" disabled={loading}
                  onChange={(e) => {
                    if (e.target.files?.length) handleAddFiles(e.target.files);
                    e.target.value = '';
                  }} />
              </label>

              {/* Compteur + liste des annonces importées */}
              <div className="mt-6 flex items-center gap-3">
                <div className={`inline-flex items-center gap-2 font-semibold rounded-full px-4 py-2 transition-colors
                  ${listings.length ? 'bg-evolys text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <span className="text-lg leading-none">{listings.length}</span>
                  <span className="text-sm">annonce{listings.length > 1 ? 's' : ''} importée{listings.length > 1 ? 's' : ''}</span>
                </div>
                {listings.length > 0 && (
                  <span className="text-sm text-slate-400">Vérifiez la liste avant de continuer</span>
                )}
              </div>

              {listings.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {listings.map((l, i) => (
                    <li key={l.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                      <span className="truncate flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-evolys text-white text-xs shrink-0">{i + 1}</span>
                        <span className="truncate">
                          <span className="font-medium text-slate-700">{l.title}</span>
                          <span className="text-slate-400"> — {l.city} {l.postalCode}</span>
                          <span className="text-slate-400"> · {l.photos.length} photo{l.photos.length > 1 ? 's' : ''}</span>
                        </span>
                      </span>
                      <span className="ml-3 flex items-center gap-3 shrink-0">
                        {i > 0 && (
                          <button onClick={() => mergeWithPrevious(l.id)}
                            className="text-xs text-slate-500 hover:text-evolys underline whitespace-nowrap"
                            title="Fusionner avec l'annonce précédente — récupère ses photos (si le découpage a coupé une annonce en deux)">
                            Fusionner ↑
                          </button>
                        )}
                        <button onClick={() => removeListing(l.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors" title="Retirer cette annonce">
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                disabled={listings.length === 0 || loading}
                onClick={() => setStep('general')}
                className="mt-6 w-full px-4 py-3.5 rounded-xl bg-evolys text-white font-medium shadow-sm
                  hover:bg-evolys-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2">
                J'ai fini de déposer mes annonces moteur immo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'general' && (
          <GeneralInfoForm value={info} onChange={setInfo} onNext={() => setStep('listings')} />
        )}

        {step === 'listings' && listings[current] && settings && (
          <div>
            <ListingEditor
              listing={listings[current]}
              index={current + 1}
              total={listings.length}
              settings={settings!}
              onChange={updateListing}
            />
            <div className="flex justify-between mt-4">
              <button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}
                className="px-4 py-2 rounded-lg bg-white border disabled:opacity-40">Précédent</button>
              {current < listings.length - 1 ? (
                <button onClick={() => setCurrent((c) => c + 1)}
                  className="px-4 py-2 rounded-lg bg-evolys text-white">Annonce suivante</button>
              ) : (
                <button onClick={handleExport} disabled={loading}
                  className="px-4 py-2 rounded-lg bg-evolys-accent text-white flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <FileDown className="h-4 w-4" />}
                  Générer le PDF
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="bg-white rounded-xl shadow p-10 text-center">
            <h2 className="text-xl font-semibold mb-2">PDF généré ✅</h2>
            <p className="text-slate-500">Le fichier a été téléchargé. Tu peux relancer une nouvelle session.</p>
            <button onClick={() => { setStep('upload'); setListings([]); setCurrent(0); }}
              className="mt-4 px-4 py-2 rounded-lg bg-evolys text-white">Nouvelle session</button>
          </div>
        )}
      </main>
    </div>
  );
}
