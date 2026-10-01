#!/usr/bin/env python3
"""Découpe un PDF moteur immo en annonces + extrait les images.
Usage: python pdf_extract.py <pdf> <outDir>
Sort un JSON sur stdout :
  [{ "textPageIndex": int, "text": str,
     "photoPages": [{ "pageIndex": int, "imagePaths": [str] }],
     "splitWarning"?: str }]

Découpage (une nouvelle annonce commence sur la page d'en-tête du bien) :
1. Règle principale = la LIGNE D'EN-TÊTE MoteurImmo, qui doit être à la fois :
   - en haut de page, juste sous le titre (1 à 3 lignes courtes, sans fin de phrase) ;
   - la ligne entière au format « Ville (12345) » + éventuellement
     « - 239 000€ (3 187€/m²) », rien d'autre. Un code postal cité dans une phrase
     de description ne passe donc pas.
2. Repli si aucune page n'a cette ligne : le GROS TITRE (texte le plus gros du
   document), puis un seuil de longueur de texte.
3. Contrôle croisé : si en-tête et gros titre ne s'accordent pas sur une page,
   l'annonce concernée reçoit un `splitWarning` (affiché au conseiller, non bloquant).
Les pages photos et les descriptions qui débordent restent rattachées à l'annonce en cours.
"""
import sys, os, re, json, hashlib, fitz
from collections import Counter

TEXT_THRESHOLD = 120     # repli : caractères -> page "texte" d'annonce
TITLE_MIN_DELTA = 1.0    # le titre doit être >= corps + 1pt pour utiliser la police
TITLE_TOL = 0.5          # tolérance d'égalité de taille (arrondis)
HEADER_MAX_LINE = 3      # l'en-tête est au plus en 4e ligne (titre long sur 3 lignes)
TITLE_MAX_LEN = 120      # une ligne de titre au-dessus de l'en-tête reste courte
SENTENCE_END = (".", ",", ";", ":", "!", "?")

# « Précy-sur-Marne (77410) - 243 000€ (4 050€/m²) » — ligne entière, prix facultatif.
HEADER_RE = re.compile(
    r"^[^()\n]{2,80} \((?:\d{5}|2[AB]\d{3})\)"
    r"(?: [-–—\xad] [\d ]+ ?€(?: \([\d ]+ ?€/m²\))?)?$"
)

def has_header(text):
    """Vrai si la ligne d'en-tête MoteurImmo est en haut de la page, sous le titre."""
    # Espaces insécables / fines (fréquents dans les prix) ramenés à un espace simple.
    lines = [re.sub(r"\s+", " ", l).strip() for l in text.split("\n") if l.strip()]
    for k in range(1, min(len(lines), HEADER_MAX_LINE + 1)):
        if HEADER_RE.match(lines[k]):
            # Tout ce qui est au-dessus doit ressembler à un titre : lignes courtes, pas de
            # fin de phrase. Écarte une page de description qui déborde (« … écoles. »).
            return all(len(t) <= TITLE_MAX_LEN and not t.endswith(SENTENCE_END) for t in lines[:k])
    return False

def page_sizes(page):
    """Tailles de police (arrondies) des spans non vides de la page."""
    sizes = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l.get("spans", []):
                if s["text"].strip():
                    sizes.append(round(s["size"], 1))
    return sizes

def extract_images(doc, page, out_dir, page_index, seen):
    """Extrait les images de la page. `seen` = empreintes déjà gardées pour l'annonce
    en cours : MoteurImmo répète les premières photos (mosaïque + galerie), on ne
    garde chaque photo identique qu'une fois."""
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
        digest = hashlib.sha1(data).hexdigest()
        if digest in seen:
            continue
        seen.add(digest)
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

    # 2) Pages de début d'annonce selon chaque règle.
    texts = [doc[idx].get_text().strip() for idx in range(doc.page_count)]
    header_starts = {idx for idx, t in enumerate(texts) if has_header(t)}
    if use_font:
        fallback_starts = {idx for idx in range(doc.page_count)
                           if per_page_max[idx] >= title_size - TITLE_TOL}
    else:
        fallback_starts = {idx for idx, t in enumerate(texts) if len(t) >= TEXT_THRESHOLD}
    starts = header_starts or fallback_starts
    # Pages où les deux règles divergent (seulement si le gros titre est exploitable).
    disputed = (header_starts ^ fallback_starts) if (header_starts and use_font) else set()

    # 3) Découpage.
    listings = []
    current = None
    seen = set()
    for idx in range(doc.page_count):
        page = doc[idx]
        text = texts[idx]
        is_new = idx in starts

        if is_new:
            seen = set()  # dédoublonnage des photos remis à zéro à chaque annonce
        imgs = extract_images(doc, page, out_dir, idx, seen)

        if is_new:
            current = {"textPageIndex": idx, "text": text,
                       "photoPages": [{"pageIndex": idx, "imagePaths": imgs}]}
            listings.append(current)
        elif current is not None:
            # Page rattachée à l'annonce en cours (photos + description qui déborde).
            if text:
                current["text"] += "\n" + text
            current["photoPages"].append({"pageIndex": idx, "imagePaths": imgs})

        if idx in disputed and current is not None:
            current["splitWarning"] = (
                "Découpage incertain : vérifie que toutes les photos appartiennent bien à ce bien "
                f"(page {idx + 1} du PDF source)."
            )

    print(json.dumps(listings, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
