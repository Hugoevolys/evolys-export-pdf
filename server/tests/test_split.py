#!/usr/bin/env python3
"""Tests de non-régression du découpeur (server/pdf_extract.py).
Lance : npm test   (ou python3 server/tests/test_split.py)
Chaque fixture de tests/fixtures/ doit avoir son entrée dans expected.json, et inversement.
"""
import os, sys, json, glob, shutil, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from pdf_extract import split  # noqa: E402

FIELDS = {  # clé attendue -> (source, clé)
    "cities": ("header", "city"), "postalCodes": ("header", "postalCode"),
    "prices": ("header", "price"), "titles": ("header", "title"),
    "rooms": ("header", "rooms"), "surfaces": ("header", "surface"), "dpe": ("header", "dpe"),
}


def check(name, exp, res):
    errs = []
    L, rep = res["listings"], res["report"]
    if exp.get("error"):
        if not rep.get("error"):
            errs.append(f"aurait dû être refusé, {len(L)} annonce(s) trouvée(s)")
        return errs
    if rep.get("error"):
        return [f"refusé à tort : {rep['error']}"]
    starts = [l["textPageIndex"] for l in L]
    if starts != exp["starts"]:
        return [f"débuts d'annonce {starts} au lieu de {exp['starts']}"]
    if "photos" in exp:
        got = [sum(len(p["imagePaths"]) for p in l["photoPages"]) for l in L]
        if got != exp["photos"]:
            errs.append(f"photos {got} au lieu de {exp['photos']}")
    for key, (src, field) in FIELDS.items():
        if key in exp:
            got = [(l.get(src) or {}).get(field) for l in L]
            if got != exp[key]:
                errs.append(f"{key} {got} au lieu de {exp[key]}")
    if "warn" in exp:
        got = [bool(l.get("splitWarning")) for l in L]
        if got != exp["warn"]:
            errs.append(f"avertissements {got} au lieu de {exp['warn']} : {[l.get('splitWarning') for l in L]}")
    if "reportWarnings" in exp and len(rep["warnings"]) != exp["reportWarnings"]:
        errs.append(f"{len(rep['warnings'])} alerte(s) globale(s) au lieu de {exp['reportWarnings']} : {rep['warnings']}")
    return errs


def main():
    expected = {k: v for k, v in json.load(open(os.path.join(HERE, "expected.json"))).items()
                if not k.startswith("_")}
    fixtures = {os.path.relpath(p, os.path.join(HERE, "fixtures"))
                for p in glob.glob(os.path.join(HERE, "fixtures", "*", "*.pdf"))}
    failures = 0
    for name in sorted(fixtures | set(expected)):
        if name not in expected:
            print(f"✗ {name} : pas d'entrée dans expected.json"); failures += 1; continue
        if name not in fixtures:
            print(f"✗ {name} : fixture absente (lancer build_fixtures.py)"); failures += 1; continue
        out = tempfile.mkdtemp()
        try:
            errs = check(name, expected[name], split(os.path.join(HERE, "fixtures", name), out))
        except Exception as e:
            errs = [f"plantage : {e!r}"]
        finally:
            shutil.rmtree(out, ignore_errors=True)
        print(("✓ " if not errs else "✗ ") + name + "".join(f"\n    {e}" for e in errs))
        failures += bool(errs)
    print(f"\n{len(expected) - failures}/{len(expected)} OK")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
