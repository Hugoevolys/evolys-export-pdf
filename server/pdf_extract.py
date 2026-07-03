#!/usr/bin/env python3
"""Découpe un PDF moteur immo en annonces + extrait les images.
Usage: python pdf_extract.py <pdf> <outDir>
Sort un JSON sur stdout :
  [{ "textPageIndex": int, "text": str,
     "photoPages": [{ "pageIndex": int, "imagePaths": [str] }] }]

Découpage : une nouvelle annonce commence sur une page qui contient le GROS TITRE
(le texte le plus gros du document : le nom du bien). Les pages photos et les
descriptions qui débordent sur plusieurs pages (corps de texte, plus petit) restent
rattachées à l'annonce en cours. Repli sur un seuil de longueur de texte si le PDF
n'a pas de titre nettement plus gros que le corps.
"""
import sys, os, json, fitz
from collections import Counter

TEXT_THRESHOLD = 120     # repli : caractères -> page "texte" d'annonce
TITLE_MIN_DELTA = 1.0    # le titre doit être >= corps + 1pt pour utiliser la police
TITLE_TOL = 0.5          # tolérance d'égalité de taille (arrondis)

def page_sizes(page):
    """Tailles de police (arrondies) des spans non vides de la page."""
    sizes = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l.get("spans", []):
                if s["text"].strip():
                    sizes.append(round(s["size"], 1))
    return sizes

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

    # 1) Analyse des tailles de police sur tout le document.
    per_page_max, all_sizes = [], []
    for idx in range(doc.page_count):
        sizes = page_sizes(doc[idx])
        per_page_max.append(max(sizes) if sizes else 0.0)
        all_sizes.extend(sizes)

    title_size = max(all_sizes) if all_sizes else 0.0
    body_size = Counter(all_sizes).most_common(1)[0][0] if all_sizes else 0.0
    # On utilise la taille de police seulement si un titre se distingue nettement.
    use_font = title_size >= body_size + TITLE_MIN_DELTA

    # 2) Découpage.
    listings = []
    current = None
    for idx in range(doc.page_count):
        page = doc[idx]
        text = page.get_text().strip()
        imgs = extract_images(doc, page, out_dir, idx)

        if use_font:
            # Nouvelle annonce ssi la page contient le gros titre.
            is_new = per_page_max[idx] >= title_size - TITLE_TOL
        else:
            is_new = len(text) >= TEXT_THRESHOLD

        if is_new:
            current = {"textPageIndex": idx, "text": text,
                       "photoPages": [{"pageIndex": idx, "imagePaths": imgs}]}
            listings.append(current)
        elif current is not None:
            # Page rattachée à l'annonce en cours (photos + description qui déborde).
            if text:
                current["text"] += "\n" + text
            current["photoPages"].append({"pageIndex": idx, "imagePaths": imgs})

    print(json.dumps(listings, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
