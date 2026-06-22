#!/usr/bin/env python3
"""Découpe un PDF moteur immo en annonces + extrait les images.
Usage: python pdf_extract.py <pdf> <outDir>
Sort un JSON sur stdout :
  [{ "textPageIndex": int, "text": str,
     "photoPages": [{ "pageIndex": int, "imagePaths": [str] }] }]
Heuristique : une page avec un bloc de texte descriptif (>= seuil) ouvre une
annonce ; les pages suivantes peu/pas texte = pages photos de cette annonce.
"""
import sys, os, json, fitz

TEXT_THRESHOLD = 120  # caractères -> page "texte" d'annonce

def extract_images(doc, page, out_dir, page_index):
    paths = []
    for i, img in enumerate(page.get_images(full=True)):
        xref = img[0]
        try:
            info = doc.extract_image(xref)
        except Exception:
            continue
        ext = info.get("ext", "png")
        data = info["image"]
        # ignorer les vignettes minuscules (icônes)
        if len(data) < 8000:
            continue
        name = f"p{page_index}_img{i}.{ext}"
        fp = os.path.join(out_dir, name)
        with open(fp, "wb") as f:
            f.write(data)
        paths.append(fp)
    return paths

def main(pdf_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    listings = []
    current = None
    for idx in range(doc.page_count):
        page = doc[idx]
        text = page.get_text().strip()
        imgs = extract_images(doc, page, out_dir, idx)
        if len(text) >= TEXT_THRESHOLD:
            current = {"textPageIndex": idx, "text": text,
                       "photoPages": [{"pageIndex": idx, "imagePaths": imgs}]}
            listings.append(current)
        elif current is not None:
            current["photoPages"].append({"pageIndex": idx, "imagePaths": imgs})
    print(json.dumps(listings, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
