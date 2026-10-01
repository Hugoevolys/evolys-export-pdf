import { useState, useEffect } from 'react';
import type { GeneralInfo, Listing, Settings } from '@/types';
import { uploadPdf, generatePdf, getSettings } from '@/lib/api';
import { listingProblems } from '@/lib/validate';
import { GeneralInfoForm } from '@/components/GeneralInfoForm';
import { ListingEditor } from '@/components/ListingEditor';
import { Upload, Loader2, FileDown, X, ArrowRight, AlertTriangle } from 'lucide-react';

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
  const [dragActive, setDragActive] = useState(false);
  useEffect(() => { getSettings().then(setSettings).catch(() => {}); }, []);

  async function handleAddFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (!pdfs.length) return;
    setLoading(true); setError('');
    try {
      // Traite chaque document déposé et cumule les annonces extraites.
      for (const file of pdfs) {
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

  // Annonces qui ne peuvent pas partir chez le client (illisibles ou à 0 €).
  const blocking = listings
    .map((l, i) => ({ i, id: l.id, problems: listingProblems(l) }))
    .filter((x) => x.problems.length);

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
                Déposez vos annonces MoteurImmo : l'outil les nettoie et génère un PDF client à votre image.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg shadow-evolys/5 ring-1 ring-slate-100 p-8">
              <label
                onDragOver={(e) => { e.preventDefault(); if (!loading) setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); if (!loading) handleAddFiles(e.dataTransfer.files); }}
                className={`group block rounded-2xl p-10 text-center cursor-pointer border-2 border-dashed transition-all
                ${loading || dragActive ? 'border-evolys bg-evolys-light/30' : 'border-slate-200 hover:border-evolys hover:bg-evolys-light/20'}`}>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-evolys-light flex items-center justify-center transition-transform group-hover:scale-105">
                  {loading
                    ? <Loader2 className="h-7 w-7 animate-spin text-evolys" />
                    : <Upload className="h-7 w-7 text-evolys" />}
                </div>
                <div className="font-title text-lg text-evolys">
                  {dragActive ? 'Déposez vos fichiers ici' : 'Déposer vos exports PDF MoteurImmo'}
                </div>
                <div className="text-sm text-slate-500 mt-1">Glissez-déposez ou cliquez — un ou plusieurs PDF</div>
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
                          {listingProblems(l).length > 0 && (
                            <span className="block text-xs text-red-600">⚠ {listingProblems(l).join(' ; ')}</span>
                          )}
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
                J'ai fini de déposer mes annonces MoteurImmo
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
                <button onClick={handleExport} disabled={loading || blocking.length > 0}
                  title={blocking.length ? 'Corrige les annonces signalées avant de générer le PDF' : undefined}
                  className="px-4 py-2 rounded-lg bg-evolys-accent text-white flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <FileDown className="h-4 w-4" />}
                  Générer le PDF
                </button>
              )}
            </div>
            {blocking.length > 0 && (
              <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" /> PDF bloqué : corrige ces annonces avant de générer
                </div>
                <ul className="space-y-1">
                  {blocking.map((b) => (
                    <li key={b.i}>
                      <button onClick={() => setCurrent(b.i)} className="underline hover:text-red-900">
                        Annonce {b.i + 1}
                      </button>
                      {' '}— {b.problems.join(' ; ')}
                      {' '}
                      <button onClick={() => { removeListing(b.id); setCurrent(0); if (listings.length <= 1) setStep('upload'); }}
                        className="ml-1 rounded border border-red-300 px-2 py-0.5 text-xs hover:bg-red-100">
                        Retirer cette annonce
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
