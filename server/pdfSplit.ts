import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { SplitReport } from '../src/types/index.ts';

export interface RawPhotoPage {
  pageIndex: number;
  imagePaths: string[];
}

/** Données lues telles quelles dans la fiche MoteurImmo (fiables, priment sur l'IA). */
export interface RawHeader {
  title: string | null;
  city: string;
  postalCode: string;
  price: number | null;
  pricePerM2: number | null;
  rooms?: number;
  bedrooms?: number;
  surface?: number;
  landSurface?: number;
  dpe?: string;
  ges?: string;
}

export interface RawListing {
  textPageIndex: number;
  text: string;
  photoPages: RawPhotoPage[];
  header?: RawHeader;
  /** Découpage incertain (non bloquant) : affiché au conseiller. */
  splitWarning?: string;
}

/**
 * Découpe un PDF MoteurImmo en annonces + extrait les images.
 * Délègue à server/pdf_extract.py (PyMuPDF). Prérequis : `pip install pymupdf`.
 */
export function splitPdf(pdfPath: string, outDir: string): { listings: RawListing[]; report: SplitReport } {
  fs.mkdirSync(outDir, { recursive: true });
  const script = path.join(process.cwd(), 'server/pdf_extract.py');
  let stdout: string;
  try {
    stdout = execFileSync('python3', [script, pdfPath, outDir], {
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf-8',
    });
  } catch (e: any) {
    console.error('[split] échec python :', e.stderr || e.message);
    throw new Error("Ce PDF n'a pas pu être lu (fichier abîmé ou protégé ?). Réexporte-le depuis MoteurImmo.");
  }
  return JSON.parse(stdout);
}
