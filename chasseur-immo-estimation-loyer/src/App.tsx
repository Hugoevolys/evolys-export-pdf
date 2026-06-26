import { useState, useEffect } from 'react';
import type { PropertyInput, Advisor } from '@/types';
import { estimate, generatePdf } from '@/lib/api';
import { PropertyForm } from '@/components/PropertyForm';
import { WorksTool } from '@/components/WorksTool';
import { CheckCircle2, FileText, TrendingUp, Hammer, ChevronRight, ExternalLink } from 'lucide-react';

type View = 'home' | 'rentForm' | 'rentDone' | 'works';

const PRIX_SECTEUR_URL = 'https://www.meilleursagents.com/prix-immobilier/';

// Routage URL leger : /travaux et /loyer ouvrent directement le bon formulaire.
const pathToView = (path: string): View =>
  path.startsWith('/travaux') ? 'works'
  : path.startsWith('/loyer') ? 'rentForm'
  : 'home';
const viewToPath = (v: View): string =>
  v === 'works' ? '/travaux'
  : v === 'rentForm' || v === 'rentDone' ? '/loyer'
  : '/';

export default function App() {
  const [view, setViewState] = useState<View>(() => pathToView(window.location.pathname));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setView = (v: View) => {
    setViewState(v);
    const path = viewToPath(v);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
  };

  // Synchronise sur le bouton precedent/suivant du navigateur.
  useEffect(() => {
    const onPop = () => setViewState(pathToView(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Estimation de loyer : recherche IA -> generation PDF -> telechargement (flux direct).
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
      setView('rentDone');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  const headerTag =
    view === 'works' ? 'Estimation des travaux'
    : view.startsWith('rent') ? 'Estimation de loyer'
    : 'Outils conseiller';

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button className="flex items-center gap-3" onClick={() => { setView('home'); setError(''); }}>
            <img src="/evolys-logo-white.png" alt="Evolys" className="h-7" />
            <span className="font-title text-lg">Evolys</span>
          </button>
          <span className="text-xs uppercase tracking-wider text-white/60">{headerTag}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && <div className="mb-4 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

        {view === 'home' && (
          <div className="space-y-5">
            <div>
              <h1 className="font-title text-2xl text-navy">Outils d'estimation</h1>
              <p className="text-sm text-slate-500 mt-1">Choisissez un outil.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ToolCard
                icon={FileText}
                title="Estimation de loyer longue durée"
                desc="Statut réglementaire, encadrement, loyer de marché → PDF téléchargeable."
                onClick={() => { setView('rentForm'); setError(''); }}
              />
              <ToolCard
                icon={Hammer}
                title="Estimation des travaux"
                desc="Chiffrage détaillé par poste (base de prix + coef. régional). Réponse à l'écran."
                onClick={() => { setView('works'); setError(''); }}
              />
              <ToolCard
                icon={TrendingUp}
                title="Prix moyen du secteur"
                desc="Consulter les prix au m² du secteur sur MeilleursAgents (ouvre le site)."
                external
                onClick={() => window.open(PRIX_SECTEUR_URL, '_blank', 'noopener,noreferrer')}
              />
            </div>
          </div>
        )}

        {view === 'rentForm' && <PropertyForm onSubmit={handleEstimate} loading={loading} />}

        {view === 'works' && <WorksTool onBack={() => { setView('home'); setError(''); }} />}

        {view === 'rentDone' && (
          <div className="card text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-brand-green mx-auto mb-3" />
            <h2 className="font-title text-xl text-navy mb-1">PDF généré</h2>
            <p className="text-slate-500 text-sm">Le fichier a été téléchargé.</p>
            <div className="flex justify-center gap-3 mt-5">
              <button className="btn-ghost" onClick={() => setView('home')}>Accueil</button>
              <button className="btn-primary" onClick={() => setView('rentForm')}>Nouvelle estimation</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ToolCard({ icon: Icon, title, desc, onClick, external }: {
  icon: typeof FileText;
  title: string;
  desc: string;
  onClick: () => void;
  external?: boolean;
}) {
  return (
    <button onClick={onClick}
      className="card text-left hover:ring-navy/30 hover:shadow-md transition-all group">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
          <Icon className="h-5 w-5" />
        </span>
        {external
          ? <ExternalLink className="h-5 w-5 text-slate-300 group-hover:text-navy transition-colors" />
          : <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-navy transition-colors" />}
      </div>
      <h2 className="font-title text-lg text-navy mt-3">{title}</h2>
      <p className="text-sm text-slate-500 mt-1">{desc}</p>
    </button>
  );
}
