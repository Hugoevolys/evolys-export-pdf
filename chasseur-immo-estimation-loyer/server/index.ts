import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { research } from './research.ts';
import { sectorResearch } from './sectorResearch.ts';
import { generatePdf } from './pdfGenerate.ts';

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',') }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// 1) Recherche : fiche du bien -> EstimationData (relu ensuite par le conseiller).
app.post('/api/estimate', async (req, res) => {
  try {
    const { property, advisor } = req.body;
    if (!property?.address) return res.status(400).json({ error: 'Fiche bien incomplete (adresse).' });
    const data = await research(property, advisor);
    res.json(data);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 2) Generation : EstimationData (valide) -> PDF.
app.post('/api/generate', async (req, res) => {
  try {
    const data = req.body;
    if (!data?.market) return res.status(400).json({ error: 'Donnees d estimation manquantes.' });
    const pdf = await generatePdf(data);
    const slug = String(data.footerAddress || 'estimation').replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="estimation_loyer_${slug}.pdf"`);
    res.send(pdf);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 3) Prix moyen du secteur : { city, propertyType, surface } -> SectorEstimate (affichage, pas de PDF).
app.post('/api/sector', async (req, res) => {
  try {
    const input = req.body;
    if (!input?.city || !input?.surface) return res.status(400).json({ error: 'Indiquez au moins la ville et la surface.' });
    const data = await sectorResearch(input);
    res.json(data);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Backend estimation loyer sur http://localhost:${PORT}`));
