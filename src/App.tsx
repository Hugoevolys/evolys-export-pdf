import { useState, useEffect } from 'react';
import type { GeneralInfo, Listing, Settings } from '@/types';
import { uploadPdf, generatePdf, getSettings } from '@/lib/api';
import { GeneralInfoForm } from '@/components/GeneralInfoForm';
import { ListingEditor } from '@/components/ListingEditor';
import { Upload, Loader2, FileDown } from 'lucide-react';

type Step = 'upload' | 'general' | 'listings' | 'done';

const emptyInfo: GeneralInfo = {
  clientFirstName: '', clientLastName: '',
  advisorFirstName: '', advisorLastName: '',
  advisorPhone: '', advisorEmail: '',
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

  async function handleUpload(file: File) {
    setLoading(true); setError('');
    try {
      const res = await uploadPdf(file);
      setListings(res.listings);
      setStep('general');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setLoading(true);
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
    <div className="min-h-screen p-6">
      <header className="max-w-3xl mx-auto mb-6 flex items-center gap-2">
        <h1 className="text-2xl font-bold text-evolys">Evolys — Export PDF Annonces</h1>
      </header>

      {error && <div className="max-w-3xl mx-auto mb-4 bg-red-50 text-red-700 rounded-lg p-3">{error}</div>}

      <main className="max-w-3xl mx-auto">
        {step === 'upload' && (
          <label className="block bg-white rounded-xl shadow p-10 text-center cursor-pointer border-2 border-dashed">
            {loading ? <Loader2 className="mx-auto animate-spin" /> : <Upload className="mx-auto mb-3 text-evolys" />}
            <div className="font-medium">Déposer le PDF moteur immo</div>
            <div className="text-sm text-slate-500">Multi-annonces accepté</div>
            <input type="file" accept="application/pdf" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          </label>
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
