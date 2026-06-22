import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GeneralInfo, Listing, Settings } from '../src/types/index.ts';
import { computeGlobalCost } from './notaryFees.ts';

const execFileAsync = promisify(execFile);
sharp.cache(false); // pas de cache libvips : empreinte mémoire constante sur 150+ photos

/**
 * Largeur max des photos dans le PDF. 1000px = net à l'écran ET fiable en mémoire :
 * 1500px faisait planter le rendu (OOM/502) sur le conteneur 512 Mo dès ~58 photos.
 * Pour monter la résolution, il faudrait plus de RAM (plan Render Standard 2 Go).
 */
const PHOTO_MAX_WIDTH = 1000;
const PHOTO_QUALITY = 80;

/**
 * Redimensionne une photo (max 1600px, auto-orientée via EXIF) en data URI JPEG.
 * Allège fortement le rendu Puppeteer (CPU/mémoire) sans perte visible à l'impression.
 */
async function photoDataUri(p: string): Promise<string> {
  if (!p || !fs.existsSync(p)) return '';
  try {
    const buf = await sharp(p)
      .rotate() // applique l'orientation EXIF (photos prises au téléphone)
      .resize({ width: PHOTO_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: PHOTO_QUALITY })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return fileDataUri(p); // repli : image brute si sharp échoue
  }
}

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

function listingHtml(l: Listing, index: number, s: Settings, advisorFirstName: string, photoUris: Map<string, string>): string {
  const c = computeGlobalCost(l, s);
  const photos = l.photos
    .map((ph) => photoUris.get(ph))
    .filter(Boolean)
    .map((uri) => `<img class="photo" src="${uri}"/>`)
    .join('');
  const features = l.features.map((f) => `<span class="chip">${f}</span>`).join('');

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
    </table>
    ${l.advisorComment ? `<div class="comment"><strong>Le commentaire de votre conseiller ${advisorFirstName} :</strong> ${l.advisorComment}</div>` : ''}
  </section>`;
}

const htmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PAGE_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Quattrocento:wght@400;700&family=Quattrocento+Sans:wght@400;700&display=swap');
    @page { size: A4; }
    * { box-sizing: border-box; font-family: 'Quattrocento Sans', Helvetica, Arial, sans-serif; color: #1b2733; }
    h1, h2 { font-family: 'Quattrocento', Georgia, serif; }
    .cover { height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    .cover img { max-width: 240px; margin-bottom: 32px; }
    .cover h1 { font-size: 26px; color: #00286E; }
    .cover .advisor { margin-top: 24px; font-size: 14px; color: #44566b; }
    h2 { color: #00286E; font-size: 20px; margin-bottom: 2px; }
    .loc { color: #44566b; margin-bottom: 10px; }
    .gallery { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
    .photo { width: 100%; height: auto; border-radius: 8px; break-inside: avoid; page-break-inside: avoid; }
    .specs span, .chip { display: inline-block; background: #DDF3FF; border-radius: 4px; padding: 3px 8px; margin: 2px; font-size: 12px; }
    .desc { font-size: 13px; line-height: 1.5; margin: 12px 0; }
    table.cost { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; break-inside: avoid; page-break-inside: avoid; }
    table.cost td { padding: 6px 8px; border-bottom: 1px solid #e3e9ee; }
    table.cost td:last-child { text-align: right; }
    table.cost .total td { font-weight: 700; color: #00286E; border-top: 2px solid #00286E; border-bottom: none; font-size: 16px; }
    .comment { margin-top: 12px; font-size: 13px; background: #f7f9fb; border-left: 3px solid #FF9A41; padding: 8px 12px; break-inside: avoid; page-break-inside: avoid; }`;

/** Enveloppe un fragment de corps dans un document HTML complet (le pied de page est géré par Puppeteer). */
function wrapDocument(bodyInner: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><style>${PAGE_STYLE}</style></head>
  <body>${bodyInner}</body></html>`;
}

function coverHtml(info: GeneralInfo): string {
  const logo = logoDataUri();
  const date = new Date().toLocaleDateString('fr-FR');
  const advisor = `${info.advisorFirstName} ${info.advisorLastName}`;
  const client = `${info.clientFirstName} ${info.clientLastName}`;
  return `<div class="cover">
      ${logo ? `<img src="${logo}"/>` : ''}
      <h1>Sélection de biens pour ${client}</h1>
      <div class="advisor">
        Votre conseiller : ${advisor}<br/>
        ${info.advisorPhone} — ${info.advisorEmail}<br/>${date}
      </div>
    </div>`;
}

/** Rend un fragment HTML en buffer PDF (une page neuve, fermée après pour libérer sa mémoire). */
async function renderSection(browser: import('puppeteer').Browser, html: string, footerHtml: string): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    // Images en data URI (aucun réseau) ; 'load' + timeout large = robuste sur conteneur limité.
    await page.setContent(html, { waitUntil: 'load', timeout: 120000 });
    // Attend le chargement des polices Google Fonts, borné pour ne jamais bloquer.
    await Promise.race([
      page.evaluate(() => (document as any).fonts?.ready),
      new Promise((r) => setTimeout(r, 5000)),
    ]).catch(() => {});
    // Pied de page natif Puppeteer : il occupe la marge basse réservée, donc ne se
    // superpose jamais au contenu (contrairement à un position:fixed).
    return Buffer.from(await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:8px; color:#6b7a89; width:100%; text-align:center; font-family:Helvetica,Arial,sans-serif;">${footerHtml}</div>`,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    }));
  } finally {
    await page.close();
  }
}

/**
 * Fusionne des PDF déjà sur disque en un seul fichier.
 * Priorité à `pdfunite` (poppler) : outil C qui assemble en streaming, mémoire quasi
 * nulle → tient à 150+ photos sur un conteneur 512 Mo. Repli `pdf-lib` si pdfunite
 * est absent (ex. dev local), acceptable car la RAM y est large.
 */
async function mergePdfs(files: string[], outFile: string): Promise<Buffer> {
  try {
    await execFileAsync('pdfunite', [...files, outFile]);
    return fs.readFileSync(outFile);
  } catch {
    const merged = await PDFDocument.create();
    for (const f of files) {
      const doc = await PDFDocument.load(fs.readFileSync(f));
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    return Buffer.from(await merged.save());
  }
}

export async function generatePdf(info: GeneralInfo, listings: Listing[], s: Settings): Promise<Buffer> {
  const advisor = `${info.advisorFirstName} ${info.advisorLastName}`;
  const footer = htmlEscape(`${advisor} — ${info.advisorPhone} — ${info.advisorEmail} — Evolys`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolys-pdf-'));
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    // Chaque section (couverture + chaque annonce) est rendue puis écrite sur DISQUE,
    // jamais accumulée en RAM. La fusion finale se fait sur disque (pdfunite). Résultat :
    // le pic mémoire ne dépasse jamais une seule annonce, quel que soit le nombre total.
    const files: string[] = [];
    const writeSection = (idx: number, buf: Buffer) => {
      const fp = path.join(tmpDir, `s${String(idx).padStart(3, '0')}.pdf`);
      fs.writeFileSync(fp, buf);
      files.push(fp);
    };

    writeSection(0, await renderSection(browser, wrapDocument(coverHtml(info)), footer));

    for (let i = 0; i < listings.length; i++) {
      const l = listings[i];
      // Photos de CETTE annonce uniquement, redimensionnées juste avant son rendu.
      const entries = await Promise.all(l.photos.map(async (p) => [p, await photoDataUri(p)] as const));
      const photoUris = new Map(entries);
      const section = listingHtml(l, i + 1, s, info.advisorFirstName, photoUris);
      writeSection(i + 1, await renderSection(browser, wrapDocument(section), footer));
    }

    return await mergePdfs(files, path.join(tmpDir, 'merged.pdf'));
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
