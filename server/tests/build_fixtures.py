#!/usr/bin/env python3
"""Fabrique les PDF de test du découpeur (server/tests/fixtures/).

Deux familles :
- real/ : vrais exports MoteurImmo envoyés par des conseillers, ALLÉGÉS (chaque photo
  remplacée par une image de bruit de même identité : deux photos identiques restent
  identiques, pour tester le dédoublonnage). Ajout : `python3 build_fixtures.py --real <pdf> <nom>`.
- synth/ : cas pièges fabriqués de toutes pièces (un par bug passé ou redouté).

Règle d'équipe : chaque PDF qui pose problème en prod devient une fixture réelle
+ une entrée dans expected.json, AVANT de corriger.
"""
import sys, os, random, hashlib
import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures")
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"  # sans elle, « € » sort mal


def noise_jpeg(seed, size=66):  # ~10 Ko : au-dessus du seuil « icône » de 8 Ko
    rnd = random.Random(seed)
    samples = bytes(rnd.getrandbits(8) for _ in range(size * size * 3))
    pix = fitz.Pixmap(fitz.csRGB, size, size, samples, False)
    return pix.tobytes("jpeg")


# ---------- vrais PDF allégés ----------

def lighten(src, dst):
    doc = fitz.open(src)
    by_digest, done = {}, set()
    for page in doc:
        for img in page.get_images(full=True):
            xref = img[0]
            if xref in done:
                continue
            done.add(xref)
            try:
                data = doc.extract_image(xref)["image"]
            except Exception:
                continue
            if len(data) < 8000:
                continue  # icône : laissée telle quelle (filtrée par le découpeur)
            d = hashlib.sha1(data).hexdigest()
            if d not in by_digest:
                by_digest[d] = noise_jpeg(d)
            page.replace_image(xref, stream=by_digest[d])
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    doc.save(dst, garbage=4, deflate=True)


# ---------- cas synthétiques ----------

class Doc:
    def __init__(self):
        self.doc = fitz.open()
        self.seed = 0

    def text_page(self, lines, photos=0, size=11):
        page = self.doc.new_page()
        page.insert_font(fontname="arial", fontfile=ARIAL)
        y = 50
        for i, line in enumerate(lines):
            fs = 16 if i == 0 and size == 11 else size
            page.insert_text((40, y), line, fontname="arial", fontsize=fs)
            y += fs + 6
        self._photos(page, photos, y + 10)
        return page

    def photo_page(self, n=2):
        self._photos(self.doc.new_page(), n, 40)

    def blank_page(self):
        self.doc.new_page()

    def _photos(self, page, n, y):
        for k in range(n):
            self.seed += 1
            x0 = 40 + (k % 2) * 260
            y0 = y + (k // 2) * 200
            page.insert_image(fitz.Rect(x0, y0, x0 + 240, y0 + 180), stream=noise_jpeg(f"s{self.seed}"))

    def save(self, name):
        os.makedirs(os.path.join(FIX, "synth"), exist_ok=True)
        self.doc.subset_fonts()  # police réduite aux glyphes utilisés
        self.doc.save(os.path.join(FIX, "synth", name), garbage=4, deflate=True)


FACTS = ["3 pièces", "2 chambres", "60 m²", "terrain de 103 m²", "DPE : D", "GES : A",
         "jardin", "prix moyen : 3 130€/m²", "écart : 29%"]
DESC = ["Belle maison lumineuse, proche des commodités, avec un jardin exposé sud et un garage",
        "attenant. Aucun travaux à prévoir, idéal pour une famille ou un premier achat."]


def listing(d, title_lines, header, photos_pages=2, facts=FACTS):
    d.text_page(title_lines + [header] + facts + DESC, photos=4)
    for _ in range(photos_pages):
        d.photo_page(2)


def build_synth():
    # 1. Titres avec ponctuation de fin (bug du 16/11 : « St-Paul. »), deux-points, !, ?
    d = Doc()
    listing(d, ["Maison T5 avec vue mer St-Paul."], "Saint-Paul (97460) - 330 000€ (2 870€/m²)")
    listing(d, ["Exclusivité :"], "Dole (39100) - 239 000€ (3 187€/m²)")
    listing(d, ["Coup de cœur !"], "Évans (39700) - 199 000€ (1 990€/m²)")
    listing(d, ["Pourquoi attendre ?"], "Damparis (39500) - 150 000€ (1 500€/m²)")
    d.save("titres-ponctuation.pdf")

    # 2. Titre long sur 3 lignes + Corse (2A) + prix au m² décimal
    d = Doc()
    listing(d, ["Au coeur du Guillaume: 187m2 sur 707m2 de terrain, un bien pour celui",
                "qui sait quoi en faire, avec dépendance et grand garage, à rénover,",
                "proche de toutes commodités"], "Ajaccio (2A004) - 345 000€ (1 845,5€/m²)")
    listing(d, ["Appartement T3"], "Bastia (2B033) - 210 000€")
    d.save("titre-long-corse.pdf")

    # 3. En-tête sans prix (accepté seulement avec le bloc de caractéristiques)
    d = Doc()
    listing(d, ["Maison de village"], "Précy-sur-Marne (77410)")
    listing(d, ["Longère"], "Couilly-Pont-aux-Dames (77860)")
    d.save("entete-sans-prix.pdf")

    # 4. Page blanche + page de garde avant la 1re annonce
    d = Doc()
    d.blank_page()
    d.text_page(["Ma recherche MoteurImmo du 16/11", "3 résultats"], size=11)
    listing(d, ["Maison 4 pièces"], "Dole (39100) - 239 000€ (3 187€/m²)")
    listing(d, ["Ferme"], "Évans (39700) - 239 000€ (3 187€/m²)")
    d.save("page-de-garde.pdf")

    # 5. Description qui déborde sur la page suivante + « Ville (CP) - prix€ » cité
    #    au milieu d'une description : ni l'un ni l'autre ne doit couper l'annonce.
    d = Doc()
    listing(d, ["Maison 3 pièces 60 m²"], "Précy-sur-Marne (77410) - 243 000€ (4 050€/m²)", photos_pages=0)
    d.text_page(["suite de la description : la maison voisine, vendue l'an dernier à",
                 "Précy-sur-Marne (77410) - 260 000€, confirme les prix du secteur. Jardin clos,",
                 "garage, chauffage au gaz."] + DESC, photos=0, size=11)
    d.photo_page(2)
    listing(d, ["Maison de ville"], "Couilly-Pont-aux-Dames (77860) - 239 000€ (3 187€/m²)")
    d.save("description-debordante.pdf")

    # 6. Sélection Evolys re-déposée par erreur
    d = Doc()
    d.text_page(["Sélection de biens pour Jean Dupont", "Votre conseiller : Paul", "22/06/2026"])
    d.text_page(["Annonce 1, Maison 3 pièces", "Précy-sur-Marne (77410)", "60 m²"], photos=2)
    d.save("selection-evolys.pdf")

    # 7. PDF qui n'est pas au format MoteurImmo : repli + avertissement global
    d = Doc()
    for t in ["Maison à vendre centre-ville", "Appartement lumineux avec balcon"]:
        d.text_page([t] + DESC * 2, photos=2, size=11)
        d.photo_page(2)
    d.save("hors-format.pdf")

    # 8. En-tête en 8e ligne (titre interminable) : non retenu, mais signalé
    d = Doc()
    listing(d, ["Maison 4 pièces"], "Dole (39100) - 239 000€ (3 187€/m²)")
    listing(d, [f"Ligne de titre numéro {k}" for k in range(1, 8)], "Évans (39700) - 239 000€")
    d.save("titre-trop-long.pdf")

    # 9. PDF entièrement vide
    d = Doc()
    d.blank_page()
    d.blank_page()
    d.save("vide.pdf")


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--real":
        lighten(sys.argv[2], os.path.join(FIX, "real", sys.argv[3] + ".pdf"))
    else:
        build_synth()
