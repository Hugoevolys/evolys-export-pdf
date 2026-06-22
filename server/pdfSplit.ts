import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface RawPhotoPage {
  pageIndex: number;
  imagePaths: string[];
}

export interface RawListing {
  textPageIndex: number;
  text: string;
  photoPages: RawPhotoPage[];
}

/**
 * Découpe un PDF moteur immo en annonces + extrait les images.
 * Délègue à server/pdf_extract.py (PyMuPDF) — robuste pour l'extraction d'images.
 * Prérequis : `pip install pymupdf`.
 */
export function splitPdf(pdfPath: string, outDir: string): RawListing[] {
  fs.mkdirSync(outDir, { recursive: true });
  const script = path.join(process.cwd(), 'server/pdf_extract.py');
  const stdout = execFileSync('python3', [script, pdfPath, outDir], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf-8',
  });
  return JSON.parse(stdout) as RawListing[];
}
