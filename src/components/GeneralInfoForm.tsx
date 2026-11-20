import type { GeneralInfo, SessionEvolys } from '@/types';

const fields: { key: keyof GeneralInfo; label: string; type?: string }[] = [
  { key: 'clientFirstName', label: 'Prénom du client' },
  { key: 'clientLastName', label: 'Nom du client' },
  { key: 'advisorFirstName', label: 'Prénom du conseiller' },
  { key: 'advisorLastName', label: 'Nom du conseiller' },
  { key: 'advisorPhone', label: 'Téléphone du conseiller', type: 'tel' },
  { key: 'advisorEmail', label: 'Email du conseiller', type: 'email' },
  { key: 'advisorRsac', label: 'N° RSAC du conseiller' },
  { key: 'advisorRsacCity', label: "Ville d'immatriculation RSAC" },
  { key: 'advisorAddress', label: 'Adresse professionnelle du conseiller' },
];

/** « Autre acheteur » : saisie libre, sans ajout aux Biens potentiels. */
export const ACHETEUR_LIBRE = '__autre__';

export function GeneralInfoForm({
  value,
  onChange,
  onNext,
  acheteurs,
  onChoisirAcheteur,
}: {
  value: GeneralInfo;
  onChange: (v: GeneralInfo) => void;
  onNext: () => void;
  /** Outil ouvert depuis l'espace conseiller : ses acheteurs en cours (les biens s'ajoutent à ses Biens potentiels). */
  acheteurs?: SessionEvolys['acheteurs'];
  onChoisirAcheteur?: (acheteur: SessionEvolys['acheteurs'][number] | null) => void;
}) {
  const avecListe = !!acheteurs && acheteurs.length > 0;
  // Avec la liste, le nom du client vient de l'acheteur choisi (sauf « Autre acheteur »).
  const saisieLibre = !avecListe || value.acheteurId === ACHETEUR_LIBRE;
  const champs = saisieLibre ? fields : fields.filter((f) => f.key !== 'clientFirstName' && f.key !== 'clientLastName');
  return (
    <div className="max-w-lg mx-auto bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-semibold mb-1">Informations générales</h2>
      <p className="text-sm text-slate-500 mb-4">Saisies une seule fois. Le logo Evolys est déjà intégré.</p>
      {avecListe && (
        <label className="mb-3 block text-sm">
          <span className="text-slate-600">Acheteur</span>
          <select
            className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
            value={value.acheteurId ?? ''}
            onChange={(e) => onChoisirAcheteur?.(acheteurs!.find((a) => a.id === e.target.value) ?? null)}
          >
            <option value="" disabled>
              Choisir l'acheteur
            </option>
            {acheteurs!.map((a) => (
              <option key={a.id} value={a.id}>
                {[a.prenom, a.nom].filter(Boolean).join(' ')}
              </option>
            ))}
            <option value={ACHETEUR_LIBRE}>Autre acheteur (saisie libre, sans Biens potentiels)</option>
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        {champs.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="text-slate-600">{f.label}</span>
            <input
              type={f.type || 'text'}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={value[f.key] ?? ''}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <button onClick={onNext} className="mt-6 w-full bg-evolys text-white rounded-lg py-2.5 font-medium">
        Continuer
      </button>
    </div>
  );
}
