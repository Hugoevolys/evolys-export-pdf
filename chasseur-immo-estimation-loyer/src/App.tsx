import { useState } from 'react';
import type { PropertyInput, Advisor } from '@/types';
import { estimate, generatePdf } from '@/lib/api';
import { PropertyForm } from '@/components/PropertyForm';
import { CheckCircle2 } from 'lucide-react';

type Step = 'form' | 'done';

export default function App() {
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Flux direct : recherche IA -> generation PDF -> telechargement, sans etape de relecture.
  // (Le composant EstimationReview reste disponible si on veut reactiver la relecture.)
  async function handleEstimate(p: PropertyInput, a: Partial<Advisor>) {
    setLoading(true); setError('');
    try {
      const data = await estimate(p, a);
      const blob = await generatePdf(data);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `estimation_loyer_${data.footerAddress.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setStep('done');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/evolys-logo-white.png" alt="Evolys" className="h-7" />
            <span className="font-title text-lg">Estimation de loyer</span>
          </div>
          <span className="text-xs uppercase tracking-wider text-white/60">Location longue durée</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && <div className="mb-4 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

        {step === 'form' && <PropertyForm onSubmit={handleEstimate} loading={loading} />}

        {step === 'done' && (
          <div className="card text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-brand-green mx-auto mb-3" />
            <h2 className="font-title text-xl text-navy mb-1">PDF généré</h2>
            <p className="text-slate-500 text-sm">Le fichier a été téléchargé.</p>
            <button className="btn-primary mt-5" onClick={() => { setStep('form'); }}>Nouvelle estimation</button>
          </div>
        )}
      </main>
    </div>
  );
}
