import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { splitPdf } from './pdfSplit.ts';
import { extractListing } from './extract.ts';
import { generatePdf } from './pdfGenerate.ts';
import { getSettings, setSettings } from './settings.ts';

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',') }));
app.use(express.json({ limit: '50mb' }));

const BUILD = 'legal-v2'; // marqueur de version (vérif déploiement)
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
    const raws = splitPdf(req.file.path, workDir);

    const listings = [];
    for (const raw of raws) {
      const listing = await extractListing(raw);
      // Photos source insérées telles quelles (aucune retouche).
      listing.photos = raw.photoPages.flatMap((pg) => pg.imagePaths);
      listings.push(listing);
    }
    res.json({ uploadId, listings });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 3) Générer le PDF final
app.post('/api/generate', async (req, res) => {
  try {
    const { generalInfo, listings } = req.body;
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

// 4) Settings
app.get('/api/settings', (_req, res) => res.json(getSettings()));
app.put('/api/settings', (req, res) => res.json(setSettings(req.body)));

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Evolys backend sur http://localhost:${PORT}`));
