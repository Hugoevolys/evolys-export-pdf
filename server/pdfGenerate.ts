import puppeteer from 'puppeteer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneralInfo, Listing, Settings } from '../src/types/index.ts';
import { computeGlobalCost } from './notaryFees.ts';

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function fileDataUri(p: string, fallbackMime = 'image/png'): string {
  if (!p || !fs.existsSync(p)) return '';
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : fallbackMime;
  return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

function logoDataUri(): string {
  return fileDataUri(path.join(process.cwd(), 'server/assets/evolys-logo.png'));
}

function listingHtml(l: Listing, index: number, s: Settings): string {
  const c = computeGlobalCost(l, s);
  const photos = l.photos.slice(0, 6).map((ph) => `<img class="photo" src="${fileDataUri(ph)}"/>`).join('');
  const features = l.features.map((f) => `<span class="chip">${f}</span>`).join('');
  const negoLine =
    c.negotiationFee != null
      ? `<tr class="nego"><td>Honoraires de négociation (20% du montant négocié, indicatif)</td><td>${euro(c.negotiationFee)}</td></tr>`
      : `<tr class="nego"><td colspan="2">Honoraires de négociation : 20% du montant négocié</td></tr>`;

  return `
  <section class="listing">
    <h2>Annonce ${index} — ${l.title}</h2>
    <div class="loc">${l.city} ${l.postalCode ? '(' + l.postalCode + ')' : ''}</div>
    <div class="gallery">${photos}</div>
    <div class="specs">
      <span>${l.surface} m²</span><span>${l.rooms} pièces</span><span>${l.bedrooms} ch.</span>
      ${l.landSurface ? `<span>terrain ${l.landSurface} m²</span>` : ''}
      ${l.dpe ? `<span>DPE ${l.dpe}</span>` : ''}${l.ges ? `<span>GES ${l.ges}</span>` : ''}
    </div>
    <div class="chips">${features}</div>
    <p class="desc">${l.description}</p>
    <table class="cost">
      <tr><td>Prix d'achat net</td><td>${euro(c.netSellerPrice)}</td></tr>
      <tr><td>Commission Evolys</td><td>${euro(c.commission)}</td></tr>
      <tr><td>Frais de notaire (est.)</td><td>${euro(c.notary)}</td></tr>
      <tr class="total"><td>COÛT GLOBAL</td><td>${euro(c.total)}</td></tr>
      ${negoLine}
    </table>
    ${l.advisorComment ? `<div class="comment"><strong>Commentaire du conseiller :</strong> ${l.advisorComment}</div>` : ''}
  </section>`;
}

export function buildHtml(info: GeneralInfo, listings: Listing[], s: Settings): string {
  const logo = logoDataUri();
  const date = new Date().toLocaleDateString('fr-FR');
  const advisor = `${info.advisorFirstName} ${info.advisorLastName}`;
  const client = `${info.clientFirstName} ${info.clientLastName}`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Quattrocento:wght@400;700&family=Quattrocento+Sans:wght@400;700&display=swap');
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; font-family: 'Quattrocento Sans', Helvetica, Arial, sans-serif; color: #1b2733; }
    h1, h2 { font-family: 'Quattrocento', Georgia, serif; }
    .cover { height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    .cover img { max-width: 240px; margin-bottom: 32px; }
    .cover h1 { font-size: 26px; color: #00286E; }
    .cover .advisor { margin-top: 24px; font-size: 14px; color: #44566b; }
    .listing { page-break-before: always; }
    h2 { color: #00286E; font-size: 20px; margin-bottom: 2px; }
    .loc { color: #44566b; margin-bottom: 10px; }
    .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; }
    .photo { width: 100%; height: 110px; object-fit: cover; border-radius: 6px; }
    .specs span, .chip { display: inline-block; background: #DDF3FF; border-radius: 4px; padding: 3px 8px; margin: 2px; font-size: 12px; }
    .desc { font-size: 13px; line-height: 1.5; margin: 12px 0; }
    table.cost { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
    table.cost td { padding: 6px 8px; border-bottom: 1px solid #e3e9ee; }
    table.cost td:last-child { text-align: right; }
    table.cost .total td { font-weight: 700; color: #00286E; border-top: 2px solid #00286E; border-bottom: none; font-size: 16px; }
    table.cost .nego td { font-size: 12px; color: #44566b; font-style: italic; }
    .comment { margin-top: 12px; font-size: 13px; background: #f7f9fb; border-left: 3px solid #FF9A41; padding: 8px 12px; }
    .footer { position: fixed; bottom: 6mm; left: 0; right: 0; text-align: center; font-size: 11px; color: #6b7a89; }
  </style></head><body>
    <div class="cover">
      ${logo ? `<img src="${logo}"/>` : ''}
      <h1>Sélection de biens pour ${client}</h1>
      <div class="advisor">
        Votre conseiller : ${advisor}<br/>
        ${info.advisorPhone} — ${info.advisorEmail}<br/>${date}
      </div>
    </div>
    ${listings.map((l, i) => listingHtml(l, i + 1, s)).join('')}
    <div class="footer">${advisor} — ${info.advisorPhone} — ${info.advisorEmail} — Evolys</div>
  </body></html>`;
}

export async function generatePdf(info: GeneralInfo, listings: Listing[], s: Settings): Promise<Buffer> {
  const html = buildHtml(info, listings, s);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
  } finally {
    await browser.close();
  }
}
