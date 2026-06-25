import type { GeneralInfo } from '@/types';

const fields: { key: keyof GeneralInfo; label: string; type?: string }[] = [
  { key: 'clientFirstName', label: 'Prénom du client' },
  { key: 'clientLastName', label: 'Nom du client' },
  { key: 'advisorFirstName', label: 'Prénom du conseiller' },
  { key: 'advisorLastName', label: 'Nom du conseiller' },
  { key: 'advisorPhone', label: 'Téléphone du conseiller', type: 'tel' },
  { key: 'advisorEmail', label: 'Email du conseiller', type: 'email' },
  { key: 'advisorRsac', label: 'N° RSAC du conseiller' },
];

export function GeneralInfoForm({
  value,
  onChange,
  onNext,
}: {
  value: GeneralInfo;
  onChange: (v: GeneralInfo) => void;
  onNext: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-semibold mb-1">Informations générales</h2>
      <p className="text-sm text-slate-500 mb-4">Saisies une seule fois. Le logo Evolys est déjà intégré.</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="text-slate-600">{f.label}</span>
            <input
              type={f.type || 'text'}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={value[f.key]}
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
