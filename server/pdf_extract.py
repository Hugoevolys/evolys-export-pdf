#!/usr/bin/env python3
"""Découpe un PDF MoteurImmo en annonces, extrait les images et lit les données fiables.
Usage: python pdf_extract.py <pdf> <outDir>
Sort un JSON sur stdout :
  { "listings": [{ "textPageIndex": int, "text": str,
                   "photoPages": [{ "pageIndex": int, "imagePaths": [str] }],
                   "header"?: { title, city, postalCode, price, pricePerM2, rooms, bedrooms,
                                surface, landSurface, dpe, ges },
                   "splitWarning"?: str }],
    "report": { "pages": int, "listings": int, "method": "entete"|"repli", "warnings": [str] } }

Principe (refonte du 16/11/2026, après 3 bugs successifs de découpage) :
- Une fiche MoteurImmo a une structure FIXE : titre (1 à 4 lignes, ponctuation libre),
  puis la ligne d'en-tête « Ville (CP) - prix€ (x€/m²) », puis un bloc de
  caractéristiques (« 3 pièces », « 2 chambres », « 60 m² », « DPE : D »…).
- Début d'annonce = en-tête dans les 6 premières lignes de la page. Plus aucune règle
  sur la ponctuation du titre (c'est elle qui avait cassé le 16/11).
- Ville, code postal, prix et caractéristiques sont lus ici, de façon déterministe :
  le serveur les impose à la place de la lecture IA.
- Rien n'est jamais jeté en silence : page orpheline, en-tête vu mais non retenu,
  annonce sans photo ou anormalement chargée → avertissement visible du conseiller.
- Repli (PDF qui n'a aucun en-tête MoteurImmo) : gros titre, puis longueur de texte,
  avec avertissement global.
"""
import sys, os, re, json, hashlib, unicodedata
import fitz

HEADER_SEARCH = 6        # l'en-tête est dans les 6 premières lignes (titre sur 1 à 5 lignes)
TEXT_THRESHOLD = 120     # repli : caractères -> page "texte" d'annonce
TITLE_MIN_DELTA = 1.0    # repli : le titre doit être >= corps + 1pt
TITLE_TOL = 0.5
MIN_IMAGE_BYTES = 8000   # en dessous : icônes, logos
MAX_PHOTOS = 45          # au-delà : deux annonces probablement fusionnées

NUM = r"\d[\d ]*(?:[.,]\d+)?"
# « Précy-sur-Marne (77410) - 243 000€ (4 050€/m²) » — ligne entière, prix facultatif.
HEADER_RE = re.compile(
    r"^(?P<city>[^()]{2,80}?) \((?P<cp>\d{5}|2[AB]\d{3})\)"
    r"(?: ?- ?(?P<price>" + NUM + r") ?€(?: \((?P<ppm>" + NUM + r") ?€/m²\))?)?$"
)

FACTS = [
    ("rooms", re.compile(r"^(\d+) pièces?$")),
    ("bedrooms", re.compile(r"^(\d+) chambres?$")),
    ("surface", re.compile(r"^(" + NUM + r") m²$")),
    ("landSurface", re.compile(r"^terrain de (" + NUM + r") m²$")),
    ("dpe", re.compile(r"^DPE ?: ?([A-G])$")),
    ("ges", re.compile(r"^GES ?: ?([A-G])$")),
]


def norm(line):
    """Espaces insécables/fines → espace ; tirets typographiques et césure → « - »."""
    line = line.replace("\xad", "-").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", line).strip()


def to_num(s):
    if s is None:
        return None
    s = s.replace(" ", "").replace(",", ".")
    try:
        v = float(s)
    except ValueError:
        return None
    return int(v) if v.is_integer() else v


def page_lines(text):
    return [norm(l) for l in text.split("\n") if norm(l)]


def parse_header(lines):
    """Retourne les données de l'en-tête si la page est une fiche MoteurImmo, sinon None."""
    for k in range(min(len(lines), HEADER_SEARCH)):
        m = HEADER_RE.match(lines[k])
        if not m:
            continue
        data = {
            "title": " ".join(lines[:k]).strip() or None,
            "city": m.group("city").strip(),
            "postalCode": m.group("cp"),
            "price": to_num(m.group("price")),
            "pricePerM2": to_num(m.group("ppm")),
        }
        # Bloc de caractéristiques : lignes courtes juste sous l'en-tête.
        facts = 0
        for line in lines[k + 1:k + 40]:
            if len(line) > 70:  # début de la description
                break
            for key, rx in FACTS:
                fm = rx.match(line)
                if fm and key not in data:
                    data[key] = to_num(fm.group(1)) if key not in ("dpe", "ges") else fm.group(1)
                    facts += 1
        # Sans prix, une ligne « Ville (CP) » seule pourrait venir d'une description :
        # on exige alors le bloc de caractéristiques.
        if data["price"] is None and facts < 2:
            continue
        return data
    return None


def page_sizes(page):
    sizes = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l.get("spans", []):
                if s["text"].strip():
                    sizes.append(round(s["size"], 1))
    return sizes


def fallback_starts(doc, texts):
    """Repli pour un PDF sans en-tête MoteurImmo : gros titre, sinon longueur de texte."""
    per_page_max, all_sizes = [], []
    for idx in range(doc.page_count):
        sizes = page_sizes(doc[idx])
        per_page_max.append(max(sizes) if sizes else 0.0)
        all_sizes.extend(sizes)
    if all_sizes:
        title_size = max(all_sizes)
        body_size = max(set(all_sizes), key=all_sizes.count)
        if title_size >= body_size + TITLE_MIN_DELTA:
            return {i for i in range(doc.page_count) if per_page_max[i] >= title_size - TITLE_TOL}
    return {i for i, t in enumerate(texts) if len(t) >= TEXT_THRESHOLD}


def extract_images(doc, page, out_dir, page_index, seen):
    """Images de la page. `seen` = empreintes déjà gardées pour l'annonce en cours :
    MoteurImmo répète les premières photos (mosaïque + galerie)."""
    paths = []
    for i, img in enumerate(page.get_images(full=True)):
        try:
            info = doc.extract_image(img[0])
        except Exception:
            continue
        data = info["image"]
        if len(data) < MIN_IMAGE_BYTES:
            continue
        digest = hashlib.sha1(data).hexdigest()
        if digest in seen:
            continue
        seen.add(digest)
        fp = os.path.join(out_dir, f"p{page_index}_img{i}.{info.get('ext', 'png')}")
        with open(fp, "wb") as f:
            f.write(data)
        paths.append(fp)
    return paths


def warn(listing, msg):
    listing["splitWarning"] = (listing.get("splitWarning", "") + " " + msg).strip()


def split(pdf_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    texts = [doc[i].get_text().strip() for i in range(doc.page_count)]
    lines = [page_lines(t) for t in texts]
    headers = {i: h for i in range(doc.page_count) if (h := parse_header(lines[i]))}

    report = {"pages": doc.page_count, "listings": 0,
              "method": "entete" if headers else "repli", "warnings": []}
    # Sélection Evolys déjà générée, re-déposée par erreur à la place de l'export MoteurImmo.
    if any(ls and unicodedata.normalize("NFC", ls[0]).lower().startswith("sélection de biens pour")
           for ls in lines[:2]):
        report["error"] = ("Ce PDF est une sélection Evolys déjà générée, pas un export "
                           "MoteurImmo : dépose le PDF exporté depuis MoteurImmo.")
        return {"listings": [], "report": report}
    starts = set(headers) if headers else fallback_starts(doc, texts)
    if not headers:
        report["warnings"].append(
            "Ce PDF n'a pas le format habituel MoteurImmo : le découpage est approximatif, "
            "vérifie chaque annonce et ses photos.")

    listings, current, seen = [], None, set()
    for idx in range(doc.page_count):
        page, text = doc[idx], texts[idx]
        is_new = idx in starts
        orphan = current is None and not is_new
        if orphan and not (text or page.get_images()):
            continue  # page blanche avant la 1re annonce : rien à garder
        if orphan and headers and not page.get_images():
            # Page de garde / récapitulatif sans photo avant la 1re fiche : écartée, mais dit.
            report["warnings"].append(
                f"Page {idx + 1} écartée : pas une fiche d'annonce (« {lines[idx][0][:60]} »).")
            continue
        if orphan:
            is_new = True
        if is_new:
            seen = set()
        imgs = extract_images(doc, page, out_dir, idx, seen)

        if is_new:
            current = {"textPageIndex": idx, "text": text,
                       "photoPages": [{"pageIndex": idx, "imagePaths": imgs}]}
            if idx in headers:
                current["header"] = headers[idx]
            if orphan and headers:
                warn(current, f"Début d'annonce non reconnu (page {idx + 1} du PDF) : "
                              "vérifie le titre, le prix et les photos.")
            listings.append(current)
        else:
            if text:
                current["text"] += "\n" + text
                # Une ligne d'en-tête complète « Ville (CP) - prix€ » sur une page rattachée
                # (plus bas que d'habitude) = annonce peut-être ratée.
                if headers and any((m := HEADER_RE.match(l)) and m.group("price") for l in lines[idx]):
                    msg = (f"La page {idx + 1} du PDF ressemble à une autre annonce mais a été "
                           "rattachée à celle-ci : vérifie et retire les photos en trop.")
                    warn(current, msg)
                    report["warnings"].append(msg)
            current["photoPages"].append({"pageIndex": idx, "imagePaths": imgs})

    for l in listings:
        n = sum(len(p["imagePaths"]) for p in l["photoPages"])
        if n == 0:
            warn(l, "Aucune photo trouvée pour cette annonce.")
        elif n > MAX_PHOTOS:
            warn(l, f"{n} photos : deux annonces ont peut-être été fusionnées, vérifie.")

    report["listings"] = len(listings)
    if not listings:
        report["error"] = "Aucune annonce trouvée dans ce PDF (pages vides ou illisibles)."
    return {"listings": listings, "report": report}


if __name__ == "__main__":
    print(json.dumps(split(sys.argv[1], sys.argv[2]), ensure_ascii=False))
