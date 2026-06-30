import puppeteer from 'puppeteer';
import type { WorksEstimate } from '../src/types/index.ts';
import {
  NAVY, LIGHT, ACCENT, euro, esc, logoWhiteDataUri, EVOLYS_LEGAL_LINE,
} from './pdfGenerate.ts';

const todayFr = () => new Date().toLocaleDateString('fr-FR');

function headerHtml(): string {
  const logo = logoWhiteDataUri();
  const left = logo ? `<img src="${logo}" style="height:28px;"/>` : `<span style="font-size:15px;font-weight:bold;">Evolys</span>`;
  return `<div style="width:100%; box-sizing:border-box; background:${NAVY}; color:#fff; padding:9px 34px; display:flex; align-items:center; justify-content:space-between; font-family:Helvetica,Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
    ${left}
    <div style="font-family:Georgia,'Times New Roman',serif; font-size:13px; font-weight:bold; letter-spacing:.5px;">ESTIMATION DES TRAVAUX</div>
  </div>`;
}

function footerHtml(): string {
  return `<div style="width:100%; color:#fff; background:${NAVY}; box-sizing:border-box; font-family:Helvetica,Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
    <div style="font-size:6px; opacity:.8; text-align:center; padding:4px 16px 0; line-height:1.35;">${EVOLYS_LEGAL_LINE}</div>
    <div style="font-size:7.5px; padding:2px 16px 5px; display:flex; justify-content:space-between;">
      <span>Evolys - Estimation de travaux (indicative, hors devis)</span>
      <span>Page <span class="pageNumber"></span> - établi le ${esc(todayFr())}</span>
    </div>
  </div>`;
}

function linesHtml(d: WorksEstimate): string {
  const rows = (d.lines || []).map((l) => `<tr>
    <td class="lot">${esc(l.lot)}</td>
    <td class="left">${esc(l.poste)}</td>
    <td>${esc(l.quantite)}</td>
    <td>${esc(l.pu)}</td>
    <td class="num">${euro(l.sousTotal)}</td>
  </tr>`).join('');
  return `<table class="grid">
    <thead><tr><th>Lot</th><th>Poste</th><th>Quantité</th><th>P.U.</th><th class="num">Sous-total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function energyHtml(d: WorksEstimate): string {
  if (!d.energy) return '';
  const rows = (d.energy.lines || []).map((l) => `<tr>
    <td class="left">${esc(l.type)}</td>
    <td class="left">${esc(l.equipement || '')}</td>
    <td class="num">${euro(l.cout)}</td>
  </tr>`).join('');
  return `
  <h2 class="sec">Rénovation énergétique — DPE Wizard</h2>
  <p class="para">Scénario : <strong>${esc(d.energy.scenario)}</strong>${d.energy.dpeGain ? ` · DPE ${esc(d.energy.dpeGain)}` : ''}</p>
  <table class="grid">
    <thead><tr><th>Poste énergie</th><th>Équipement</th><th class="num">Coût</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td class="left" colspan="2"><strong>Total rénovation énergétique</strong></td><td class="num"><strong>${euro(d.energy.total)}</strong></td></tr></tfoot>
  </table>
  ${d.energy.note ? `<div class="caption">${esc(d.energy.note)}</div>` : ''}`;
}

function buildHtml(d: WorksEstimate): string {
  const hyp = (d.hypotheses || []).map((h) => `<li>${esc(h)}</li>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><style>${CSS}</style></head><body>
  <div class="content">
    ${d.recap ? `<div class="bien"><strong>Bien :</strong> ${esc(d.recap)}</div>` : ''}

    <div class="cards">
      <div class="card main">
        <div class="card-label">${d.energy ? 'TRAVAUX (HORS ÉNERGIE)' : 'TOTAL PROJET ESTIMÉ'}</div>
        <div class="card-val">${euro(d.totalProjet)}</div>
        <div class="card-cap">fourchette ${euro(d.fourchetteBasse)} – ${euro(d.fourchetteHaute)}</div>
      </div>
      <div class="card">
        <div class="card-label">COÛT TRAVAUX AU M²</div>
        <div class="card-val alt">${euro(d.coutM2)}</div>
        <div class="card-cap">${esc(d.positionnement)}</div>
      </div>
    </div>

    <h2 class="sec">Détail par poste</h2>
    ${linesHtml(d)}

    <table class="synth">
      <tr><td>Sous-total travaux</td><td class="num">${euro(d.sousTotalTravaux)}</td></tr>
      <tr><td>Coefficient régional${d.regionalZone ? ` (${esc(d.regionalZone)})` : ''}</td><td class="num">× ${esc(String(d.regionalCoef))}</td></tr>
      <tr><td>Provision pour aléas</td><td class="num">+ ${esc(String(d.provisionAleasPct))} %</td></tr>
      <tr class="tot"><td><strong>${d.energy ? 'Total travaux (hors énergie)' : 'Total projet'}</strong></td><td class="num"><strong>${euro(d.totalProjet)}</strong></td></tr>
    </table>

    ${energyHtml(d)}

    ${d.energy ? `<div class="general"><span>TOTAL GÉNÉRAL (travaux + énergie)</span><span>${euro(d.totalGeneral)}</span></div>` : ''}

    ${hyp ? `<h2 class="sec">Hypothèses &amp; réserves</h2><ul class="hyp">${hyp}</ul>` : ''}

    <div class="warn"><strong>Note.</strong> ${esc(d.disclaimer)}</div>
  </div>
  </body></html>`;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Quattrocento:wght@400;700&family=Quattrocento+Sans:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Quattrocento Sans', Helvetica, Arial, sans-serif; color: #1b2733; font-size: 11px; }
  h2 { font-family: 'Quattrocento', Georgia, serif; }
  .content { padding: 16px 34px 8px; }
  .bien { background: ${LIGHT}; border-left: 4px solid ${NAVY}; padding: 10px 12px; font-size: 11px; margin: 0 0 16px; }
  h2.sec { color: ${NAVY}; font-size: 15px; font-weight: 700; padding-bottom: 5px; border-bottom: 1.5px solid ${NAVY}; margin: 16px 0 10px; break-after: avoid; }
  p.para { font-size: 11px; line-height: 1.5; margin: 8px 0; }

  .cards { display: flex; gap: 12px; margin: 4px 0 6px; }
  .card { flex: 1; border-radius: 6px; padding: 14px 12px; border: 1px solid #d5e6f4; background: #f6fbff; }
  .card.main { background: ${NAVY}; border-color: ${NAVY}; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card-label { font-size: 9px; letter-spacing: .4px; color: #5a6775; }
  .card.main .card-label { color: rgba(255,255,255,.7); }
  .card-val { font-size: 26px; font-weight: 700; margin: 6px 0 4px; font-family: 'Quattrocento', Georgia, serif; }
  .card.main .card-val { color: #fff; }
  .card-val.alt { color: ${NAVY}; }
  .card-cap { font-size: 9px; color: #6a7682; line-height: 1.4; }
  .card.main .card-cap { color: rgba(255,255,255,.75); }

  table.grid { width: 100%; border-collapse: collapse; margin: 4px 0 8px; break-inside: avoid; }
  table.grid th { background: ${NAVY}; color: #fff; font-size: 9px; font-weight: 700; padding: 6px 8px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.grid td { border-bottom: 1px solid #cfe2f2; padding: 6px 8px; font-size: 9.5px; vertical-align: top; }
  table.grid td.left { text-align: left; }
  table.grid td.lot { color: #5a6775; font-size: 9px; }
  table.grid th.num, table.grid td.num { text-align: right; white-space: nowrap; }
  table.grid tfoot td { border-top: 1.5px solid ${NAVY}; border-bottom: none; }

  table.synth { width: 55%; margin: 6px 0 8px auto; border-collapse: collapse; }
  table.synth td { padding: 4px 8px; font-size: 11px; border-bottom: 1px solid #e3e8ee; }
  table.synth td.num { text-align: right; white-space: nowrap; }
  table.synth tr.tot td { border-top: 1.5px solid ${NAVY}; border-bottom: none; color: ${NAVY}; font-size: 13px; }

  .general { display: flex; justify-content: space-between; align-items: center; background: ${NAVY}; color: #fff; padding: 10px 14px; border-radius: 6px; margin: 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .general span:last-child { font-family: 'Quattrocento', Georgia, serif; font-size: 18px; }

  ul.hyp { margin: 6px 0 6px 18px; font-size: 9.5px; color: #2c3a49; line-height: 1.5; }
  .caption { font-size: 9px; color: #5a6775; line-height: 1.5; margin: 6px 0; }
  .warn { margin-top: 12px; font-size: 9.5px; line-height: 1.55; background: #FFF6EC; border: 1px solid #FAD9B0; border-left: 4px solid ${ACCENT}; padding: 9px 12px; color: #6b5535; break-inside: avoid; }
`;

/** Genere le PDF (Buffer) d'une estimation de travaux. */
export async function generateWorksPdf(d: WorksEstimate): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(d), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerHtml(),
      footerTemplate: footerHtml(),
      margin: { top: '62px', bottom: '52px', left: '0', right: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
