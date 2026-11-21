import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';

import { splitPdf } from './pdfSplit.ts';
import { extractListing } from './extract.ts';
import { generatePdf, generatePdfsParAnnonce } from './pdfGenerate.ts';
import { getSettings, setSettings } from './settings.ts';
import { ErreurErp, deposerErp, erpConfigure, renouvelerErp, sessionErp } from './erp.ts';
import { listingProblems } from '../src/lib/validate.ts';
import type { Listing } from '../src/types/index.ts';

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',') }));
app.use(express.json({ limit: '50mb' }));

const BUILD = 'annonce-manuelle'; // marqueur de version (vérif déploiement)
app.get('/health', (_req, res) => res.json({ status: 'ok', build: BUILD, ts: new Date().toISOString() }));

const TMP = path.join(process.cwd(), 'server/tmp');
fs.mkdirSync(TMP, { recursive: true });
const upload = multer({ dest: path.join(process.cwd(), 'server/uploads') });

// 1) Upload du PDF -> découpe + extraction + nettoyage photos
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'PDF manquant' });
    const uploadId = path.basename(req.file.path);
    const workDir = path.join(TMP, uploadId);
    const { listings: raws, report } = splitPdf(req.file.path, workDir);
    console.log(`[upload] ${req.file.originalname} : ${report.pages} pages, ${report.listings} annonces, méthode ${report.method}` +
      (report.warnings.length ? `, alertes : ${report.warnings.join(' | ')}` : '') + (report.error ? `, ERREUR : ${report.error}` : ''));
    if (report.error) return res.status(400).json({ error: `${req.file.originalname} : ${report.error}` });

    // 3 annonces lues en parallèle : plus rapide, sans saturer l'API.
    const listings: Listing[] = new Array(raws.length);
    let next = 0;
    const worker = async () => {
      while (next < raws.length) {
        const i = next++;
        const raw = raws[i];
        const listing = await extractListing(raw);
        // Photos source insérées telles quelles (aucune retouche).
        listing.photos = raw.photoPages.flatMap((pg) => pg.imagePaths);
        if (raw.splitWarning) listing.splitWarning = [listing.splitWarning, raw.splitWarning].filter(Boolean).join(' ');
        listings[i] = listing;
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    res.json({ uploadId, listings, report: { ...report, fileName: req.file.originalname } });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 2) Photos d'une annonce ajoutée à la main (21/11/2026 : annonce trouvée hors
//    MoteurImmo, ex. Meilleurs Agents). Rangées dans le dossier de travail, comme
//    les photos extraites des PDF : même aperçu, même PDF, même dépôt ERP.
const FORMATS_PHOTO: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const uploadPhotos = multer({
  dest: path.join(process.cwd(), 'server/uploads'),
  limits: { fileSize: 15 * 1024 * 1024, files: 40 },
});
app.post('/api/photos', uploadPhotos.array('photos', 40), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) return res.status(400).json({ error: 'Aucune photo reçue.' });
  const refusees = files.filter((f) => !FORMATS_PHOTO[f.mimetype]);
  if (refusees.length) {
    files.forEach((f) => fs.rmSync(f.path, { force: true }));
    return res.status(400).json({
      error: `Format non pris en charge : ${refusees.map((f) => f.originalname).join(', ')}. Utilise des photos JPG, PNG ou WebP (une capture d'écran convient).`,
    });
  }
  const dossier = path.join(TMP, `manuel-${randomUUID()}`);
  fs.mkdirSync(dossier, { recursive: true });
  const chemins = files.map((f, i) => {
    const dest = path.join(dossier, `photo-${String(i + 1).padStart(2, '0')}${FORMATS_PHOTO[f.mimetype]}`);
    fs.renameSync(f.path, dest);
    return dest;
  });
  console.log(`[photos] ${chemins.length} photo(s) ajoutée(s) à la main`);
  res.json({ photos: chemins });
});

// 3) Générer le PDF final
app.post('/api/generate', async (req, res) => {
  try {
    const { generalInfo, listings } = req.body;
    // Garde-fou : jamais d'annonce illisible ou à 0 € dans un PDF client.
    const blocking = (listings as Listing[])
      .map((l, i) => ({ i, problems: listingProblems(l) }))
      .filter((x) => x.problems.length);
    if (blocking.length) {
      return res.status(400).json({
        error: blocking.map((x) => `Annonce ${x.i + 1} : ${x.problems.join(' ; ')}`).join('\n'),
      });
    }
    const pdf = await generatePdf(generalInfo, listings, getSettings());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="selection-evolys.pdf"');
    res.send(pdf);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Sert une image nettoyée (aperçu UI). Restreint au dossier de travail tmp.
app.get('/api/file', (req, res) => {
  const fp = String(req.query.path || '');
  if (!fp.startsWith(TMP)) return res.status(403).end();
  if (!fs.existsSync(fp)) return res.status(404).end();
  res.sendFile(fp);
});

// 5) Espace client Evolys (18/11/2026) : utilisé seulement quand l'outil a
//    été ouvert depuis l'espace conseiller avec un jeton. Le jeton voyage dans
//    le corps des requêtes, jamais dans l'adresse (absent des journaux).

function repondreErreurErp(res: express.Response, e: any) {
  if (e instanceof ErreurErp) return res.status(e.statut).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: "La publication n'a pas pu aboutir. Réessayez dans un instant." });
}

app.post('/api/erp/session', async (req, res) => {
  if (!erpConfigure()) return res.status(503).json({ error: 'Liaison avec Evolys non configurée.' });
  try {
    res.json(await sessionErp(String(req.body?.jeton ?? '')));
  } catch (e) {
    repondreErreurErp(res, e);
  }
});

app.post('/api/erp/renouveler', async (req, res) => {
  if (!erpConfigure()) return res.status(503).json({ error: 'Liaison avec Evolys non configurée.' });
  try {
    res.json(await renouvelerErp(String(req.body?.jeton ?? '')));
  } catch (e) {
    repondreErreurErp(res, e);
  }
});

// Dépôt dans les « Biens potentiels » du conseiller (20/11/2026) : un PDF par
// annonce est généré ici, rien n'est publié chez le client.
app.post('/api/erp/deposer', async (req, res) => {
  if (!erpConfigure()) return res.status(503).json({ error: 'Liaison avec Evolys non configurée.' });
  try {
    const { jeton, contactId, cle, listings, generalInfo } = req.body ?? {};
    if (!Array.isArray(listings) || !listings.length) return res.status(400).json({ error: 'Aucune annonce à déposer.' });
    const settings = getSettings();
    const pdfsParAnnonce = await generatePdfsParAnnonce(generalInfo, listings as Listing[], settings);
    const resultat = await deposerErp({
      jeton: String(jeton ?? ''),
      contactId: String(contactId ?? ''),
      cle: String(cle ?? ''),
      listings: listings as Listing[],
      settings,
      pdfsParAnnonce,
      dossierTravail: TMP,
    });
    console.log(`[erp] ${resultat?.biens ?? '?'} bien(s) déposé(s)${resultat?.dejaDeposes ? ' (déjà déposés)' : ''}`);
    res.json(resultat);
  } catch (e) {
    repondreErreurErp(res, e);
  }
});

// 4) Settings
app.get('/api/settings', (_req, res) => res.json(getSettings()));
app.put('/api/settings', (req, res) => res.json(setSettings(req.body)));

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Evolys backend sur http://localhost:${PORT}`));
