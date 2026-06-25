import * as fs from 'node:fs';
import * as path from 'node:path';
import { generatePdf } from './pdfGenerate.ts';
import { LYON_ENCADRE, ROUEN_LIBRE } from './sampleData.ts';

// Genere 2 PDF de test (avec / sans encadrement) sans appeler l'API.
const out = path.join(process.cwd(), 'server/tmp');
fs.mkdirSync(out, { recursive: true });

for (const [name, data] of [['lyon_encadre', LYON_ENCADRE], ['rouen_libre', ROUEN_LIBRE]] as const) {
  const pdf = await generatePdf(data);
  const fp = path.join(out, `test_${name}.pdf`);
  fs.writeFileSync(fp, pdf);
  console.log('PDF ecrit :', fp, `(${pdf.length} octets)`);
}
