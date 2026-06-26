import puppeteer from 'puppeteer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EstimationData } from '../src/types/index.ts';

// ---------- Charte Evolys ----------
export const NAVY = '#00286E';
const NAVY_DARK = '#001B4A';
export const LIGHT = '#DDF3FF';
const BLUE = '#6DCAFF';
export const ACCENT = '#FF9A41';

// ---------- Mentions legales Evolys (fixes) ----------
export const EVOLYS_LEGAL_NAME = 'SAS ARM IMMO';
export const EVOLYS_LEGAL_ADDRESS = "809 rue de Croixmare, 76510 Saint-Nicolas-d'Aliermont";
export const EVOLYS_SIREN = '927 684 944';
export const EVOLYS_CARD = 'CPI76022025000000001';
export const EVOLYS_REP = 'M. MAHIEUX Axel';

// ---------- Formatage ----------
export const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const eurM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const m2cap = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (s = '') => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

function statutClass(tone: string): string {
  if (tone === 'neg') return 'st-neg';
  if (tone === 'pos') return 'st-pos';
  return 'st-neutral';
}

/** Logo Evolys blanc (pour la banniere navy) en data URI. */
export function logoWhiteDataUri(): string {
  const p = path.join(process.cwd(), 'server/assets/evolys-logo-white.png');
  if (!fs.existsSync(p)) return '';
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
}

// ---------- Sections HTML ----------
/** En-tete (letterhead) repete sur CHAQUE page via Puppeteer headerTemplate. */
function headerHtml(d: EstimationData): string {
  const logo = logoWhiteDataUri();
  const left = logo
    ? `<img src="${logo}" style="height:28px;"/>`
    : `<span style="font-size:15px;font-weight:bold;">${esc(d.advisor.company)}</span>`;
  const right = `<div style="text-align:right; line-height:1.25;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:13px; font-weight:bold; letter-spacing:.5px;">ESTIMATION DE LOYER</div>
      <div style="font-size:8px; opacity:.85;">${esc(d.advisor.advisorName)}${d.advisor.role ? ' &middot; ' + esc(d.advisor.role) : ''}</div>
    </div>`;
  return `<div style="width:100%; box-sizing:border-box; background:${NAVY}; color:#fff; padding:9px 34px; display:flex; align-items:center; justify-content:space-between; font-family:Helvetica,Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact;">${left}${right}</div>`;
}

/** Intro de la 1re page (sous le letterhead) : sous-titre + ligne client. */
function introHtml(d: EstimationData): string {
  const sub = d.furnished ? 'Location longue durée - logement meublé' : 'Location longue durée - logement nu';
  return `
  <div class="sub-chip">${esc(sub)}</div>
  ${d.advisor.client ? `<div class="attn">Estimation établie à l'attention de <strong>${esc(d.advisor.client)}</strong> par ${esc(d.advisor.advisorName)}.</div>` : ''}`;
}

function bienHtml(d: EstimationData): string {
  return `<div class="bien"><strong>Bien estimé :</strong> ${rich(d.bienEstime)}</div>`;
}

function sectionTitle(n: number, label: string): string {
  return `<h2 class="sec"><span class="sec-n">${n}.</span> ${esc(label)}</h2>`;
}

function regulatoryHtml(d: EstimationData): string {
  const rows = d.regulatory
    .map(
      (r) => `<tr>
        <td class="critere">${esc(r.critere)}</td>
        <td class="statut ${statutClass(r.tone)}">${esc(r.statut)}</td>
        <td class="detail">${rich(r.detail)}</td>
      </tr>`,
    )
    .join('');
  const note = d.regulatoryNote
    ? `<div class="note"><span class="sq"></span>${rich(d.regulatoryNote)}</div>`
    : '';
  return `
  <table class="grid reg">
    <thead><tr><th>Critère</th><th>Statut</th><th>Détail</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>${note}`;
}

function ceilingHtml(d: EstimationData): string {
  if (!d.ceilingRows?.length) return '';
  const rows = d.ceilingRows
    .map(
      (r) => `<tr>
      <td class="epoque">${esc(r.epoque)}</td>
      <td>${eurM2(r.loyerRefM2)}</td>
      <td>${eurM2(r.plafondMajoreM2)}</td>
      <td>${eurM2(r.loyerMinoreM2)}</td>
      <td>${euro(r.loyerRefSurface)}</td>
      <td class="hl">${euro(r.plafondLegalSurface)}</td>
      <td>${euro(r.plancherSurface)}</td>
    </tr>`,
    )
    .join('');
  return `
  ${sectionTitle(2, d.ceilingTitle || "Plafond légal d'encadrement")}
  ${d.ceilingIntro ? `<p class="para">${rich(d.ceilingIntro)}</p>` : ''}
  <table class="grid ceil">
    <thead><tr>
      <th>Époque de construction</th>
      <th>Loyer de réf. (€/m²)</th>
      <th>Plafond majoré (€/m²)</th>
      <th>Loyer minoré (€/m²)</th>
      <th>Loyer de réf.</th>
      <th>Plafond légal</th>
      <th>Plancher</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${d.ceilingLecture ? `<div class="caption">${rich(d.ceilingLecture)}</div>` : ''}`;
}

function marketHtml(d: EstimationData, n: number): string {
  const m = d.market;
  const card = (cls: string, label: string, val: number, perM2: number) => `
    <div class="card ${cls}">
      <div class="card-label">${label}</div>
      <div class="card-val">${euro(val)}</div>
      <div class="card-cap">~${m2cap(perM2)} €/m² - HC / mois</div>
    </div>`;
  return `
  ${sectionTitle(n, 'Estimation du loyer de marché' + (d.furnished ? ' (meublé, longue durée)' : ' (longue durée)'))}
  <div class="cards">
    ${card('low', 'ESTIMATION BASSE', m.basse, m.basseM2)}
    ${card('mid', 'LOYER MOYEN ESTIMÉ', m.moyen, m.moyenM2)}
    ${card('high', 'ESTIMATION HAUTE', m.haute, m.hauteM2)}
  </div>
  ${m.paragraph ? `<p class="para">${rich(m.paragraph)}</p>` : ''}`;
}

function methodologyHtml(d: EstimationData, n: number): string {
  const srcNames = (d.sources || []).map((s) => esc(s.source)).filter(Boolean).join(' · ');
  return `
  ${sectionTitle(n, 'Méthodologie, sources et fiabilité des données')}
  ${srcNames ? `<p class="para"><strong>Sources croisées :</strong> ${srcNames}.</p>` : ''}
  ${d.fiabilite ? `<div class="caption">${rich(d.fiabilite)}</div>` : ''}
  <div class="warn"><strong>Avertissement.</strong> ${rich(d.disclaimer)}</div>`;
}

// ---------- Document complet ----------
function buildHtml(d: EstimationData): string {
  const encadre = d.variant === 'encadre';
  let secN = 1;
  const reg = `${sectionTitle(secN++, "Situation réglementaire de l'adresse")}${regulatoryHtml(d)}`;
  const ceil = encadre ? ceilingHtml(d) : '';
  if (encadre) secN++; // section plafond = n 2
  const market = marketHtml(d, secN++);
  const method = methodologyHtml(d, secN++);

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
  <style>${CSS}</style></head>
  <body>
    <div class="content">
      ${introHtml(d)}
      ${bienHtml(d)}
      ${reg}
      ${ceil}
      ${market}
      ${method}
    </div>
  </body></html>`;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Quattrocento:wght@400;700&family=Quattrocento+Sans:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Quattrocento Sans', Helvetica, Arial, sans-serif; color: #1b2733; font-size: 11px; }
  h1, h2, .banner-title { font-family: 'Quattrocento', Georgia, serif; }
  .content { padding: 16px 34px 8px; }

  /* Intro 1re page (sous le letterhead repete) */
  .sub-chip { display: inline-block; background: ${NAVY}; color: #fff; padding: 4px 10px; border-radius: 3px; font-size: 11px; }
  .attn { font-size: 10px; color: #44566b; margin-top: 8px; }

  /* Bien estime */
  .bien { background: ${LIGHT}; border-left: 4px solid ${NAVY}; padding: 10px 12px; font-size: 11px; margin: 16px 0 18px; }

  /* Titres de section */
  h2.sec { color: ${NAVY}; font-size: 16px; font-weight: 700; padding-bottom: 5px; border-bottom: 1.5px solid ${NAVY}; margin: 18px 0 12px; break-after: avoid; }
  h2.sec .sec-n { margin-right: 4px; }

  p.para { font-size: 11px; line-height: 1.55; margin: 10px 0; }

  /* Tables generiques */
  table.grid { width: 100%; border-collapse: collapse; margin-top: 4px; break-inside: avoid; }
  table.grid th { background: ${NAVY}; color: #fff; font-size: 10px; font-weight: 700; padding: 7px 8px; text-align: center; }
  table.grid td { border-bottom: 1px solid #cfe2f2; padding: 7px 8px; font-size: 10.5px; text-align: center; vertical-align: top; }
  table.grid td.left, table.grid td.detail, table.grid td.critere, table.grid td.epoque { text-align: left; }
  table.grid td.critere { font-weight: 700; width: 18%; }
  table.grid td.detail { font-size: 10px; line-height: 1.45; color: #2c3a49; }

  /* Statut colore */
  td.statut { font-weight: 700; width: 12%; }
  .st-neg { color: #C0392B; }
  .st-pos { color: #1E8E7E; }
  .st-neutral { color: ${NAVY}; }

  /* Note section 1 */
  .note { font-size: 9.5px; color: #4a5765; line-height: 1.5; margin: 8px 0 4px; }
  .note .sq { display: inline-block; width: 7px; height: 7px; background: ${NAVY}; margin-right: 6px; vertical-align: middle; }

  /* Grille encadrement */
  table.ceil th { font-size: 9px; padding: 6px 4px; }
  table.ceil td { font-size: 10px; padding: 6px 4px; }
  table.ceil td.hl { font-weight: 700; color: ${NAVY}; background: ${LIGHT}; }

  .caption { font-size: 9px; color: #5a6775; line-height: 1.5; margin: 8px 0; }

  /* Cartes marche */
  .cards { display: flex; gap: 12px; margin: 6px 0 12px; }
  .card { flex: 1; border-radius: 6px; padding: 14px 10px; text-align: center; border: 1px solid #d5e6f4; }
  .card-label { font-size: 9.5px; letter-spacing: .4px; color: #5a6775; }
  .card-val { font-size: 27px; font-weight: 700; margin: 8px 0 6px; font-family: 'Quattrocento', Georgia, serif; }
  .card-cap { font-size: 9px; color: #6a7682; }
  .card.low { background: #f6fbff; }
  .card.low .card-val { color: #44566b; }
  .card.mid { background: ${LIGHT}; border-color: ${BLUE}; }
  .card.mid .card-val { color: ${NAVY}; }
  .card.high { background: #EAF6EF; border-color: #cfe7d9; }
  .card.high .card-val { color: #2E8B57; }

  /* Avertissement */
  .warn { margin-top: 12px; font-size: 9.5px; line-height: 1.55; background: #FFF6EC; border: 1px solid #FAD9B0; border-left: 4px solid ${ACCENT}; padding: 9px 12px; color: #6b5535; break-inside: avoid; }
`;

function footerTemplate(d: EstimationData): string {
  const left = `${esc(d.advisor.company)} - Estimation locative - ${esc(d.footerAddress)}`;
  const name = [d.advisor.advisorName, d.advisor.advisorLastName].filter(Boolean).join(' ').trim();
  const company = `Evolys - ${EVOLYS_LEGAL_NAME}, ${EVOLYS_LEGAL_ADDRESS} - SIREN ${EVOLYS_SIREN} - Carte professionnelle ${EVOLYS_CARD} - représentée par ${EVOLYS_REP}`;
  const conseiller = name
    ? `Estimation établie par ${esc(name)}, ${esc(d.advisor.role || 'chasseur immobilier')}${d.advisor.rsac ? ` - RSAC ${esc(d.advisor.rsac)}` : ''}`
    : '';
  return `<div style="width:100%; color:#fff; background:${NAVY}; box-sizing:border-box; font-family: Helvetica, Arial, sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
    <div style="font-size:6px; opacity:.8; text-align:center; padding:4px 16px 0; line-height:1.35;">${company}</div>
    ${conseiller ? `<div style="font-size:6px; opacity:.8; text-align:center; padding:1px 16px 0; line-height:1.35;">${conseiller}</div>` : ''}
    <div style="font-size:7.5px; padding:2px 16px 5px; display:flex; justify-content:space-between;">
      <span>${left}</span>
      <span>Page <span class="pageNumber"></span> - établi le ${esc(d.advisor.date)}</span>
    </div>
  </div>`;
}

/** Genere le PDF (Buffer) a partir des donnees d'estimation. */
export async function generatePdf(d: EstimationData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(d), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerHtml(d),
      footerTemplate: footerTemplate(d),
      margin: { top: '78px', bottom: '58px', left: '0', right: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
