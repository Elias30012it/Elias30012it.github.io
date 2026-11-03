"""Baixa as trilhas do Brasil mapeadas no OpenStreetMap e gera js/trails-osm.js.

O que entra:
  - relações route=hiking / route=foot (trilhas oficiais e travessias mapeadas como rota);
  - caminhos (highway=path/footway/track) cujo nome começa com "Trilha", "Travessia" ou "Caminho".

Para cada trilha o script calcula a distância pela geometria, escolhe um ponto de referência
sobre o traçado, descobre o estado (pelo contorno dos estados) e a cidade (sede municipal mais
próxima dentro do estado, base do IBGE em data/municipios.csv).

Uso (precisa de acesso a overpass-api.de):
  python3 tools/fetch-osm-trails.py > js/trails-osm.js
  python3 tools/fetch-osm-trails.py --save-raw osm.json > js/trails-osm.js   # guarda a resposta bruta
  python3 tools/fetch-osm-trails.py --input osm.json > js/trails-osm.js      # reprocessa sem baixar

Dados © colaboradores do OpenStreetMap, licença ODbL — a atribuição aparece no site.
"""
import argparse
import csv
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

QUERY = """
[out:json][timeout:900][maxsize:1073741824];
area["ISO3166-1"="BR"][admin_level=2]->.br;
(
  relation["route"~"^(hiking|foot)$"](area.br);
  way["highway"~"^(path|footway|track|bridleway)$"]["name"~"^(trilha|travessia|caminho) ",i](area.br);
);
out tags geom;
"""

SAC = {
    "hiking": "Fácil",
    "mountain_hiking": "Moderada",
    "demanding_mountain_hiking": "Difícil",
    "alpine_hiking": "Difícil",
    "demanding_alpine_hiking": "Difícil",
    "difficult_alpine_hiking": "Difícil",
}

KEYWORDS = [
    ("cachoeira", "cachoeira"), ("salto", "cachoeira"), ("pico", "pico"), ("morro", "morro"), ("pedra", "pedra"),
    ("serra", "serra"), ("praia", "praia"), ("travessia", "travessia"), ("caminho", "caminho"), ("mirante", "mirante"),
    ("lagoa", "lagoa"), ("rio ", "rio"), ("gruta", "gruta"), ("canyon", "cânion"), ("cânion", "cânion"), ("parque", "parque"),
]

COS = math.cos(math.radians(15))
LNG0, LAT0 = -76.0, 7.0  # mesma projeção de js/map.js e tools/build-geo.py


# ---------------------------------------------------------------- download
def fetch(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for url in ENDPOINTS:
        for attempt in range(3):
            try:
                print(f"Consultando {url} (tentativa {attempt + 1})…", file=sys.stderr)
                req = urllib.request.Request(url, data=data, headers={"User-Agent": "pumping-life-trails/1.0"})
                with urllib.request.urlopen(req, timeout=960) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001 — servidor público, falhas são esperadas
                last = e
                print(f"  falhou: {e}", file=sys.stderr)
                time.sleep(5 * (attempt + 1))
    raise SystemExit(f"Nenhum servidor Overpass respondeu: {last}")


# ---------------------------------------------------------------- geometria
def hav(a, b):
    lat1, lng1 = a
    lat2, lng2 = b
    r = math.pi / 180
    h = math.sin((lat2 - lat1) * r / 2) ** 2 + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin((lng2 - lng1) * r / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def lines_of(el):
    """Lista de polilinhas [(lat, lng), ...] de um caminho ou relação."""
    if el["type"] == "way":
        return [[(p["lat"], p["lon"]) for p in el.get("geometry", []) if p]]
    out = []
    for m in el.get("members", []):
        if m.get("type") == "way" and m.get("geometry") and m.get("role", "") not in ("stop", "platform"):
            out.append([(p["lat"], p["lon"]) for p in m["geometry"] if p])
    return out


def length_km(lines):
    return sum(hav(a, b) for line in lines for a, b in zip(line, line[1:]))


def anchor(lines):
    """Ponto do traçado mais próximo do centro — fica sempre em cima da trilha."""
    pts = [p for line in lines for p in line]
    cy = sum(p[0] for p in pts) / len(pts)
    cx = sum(p[1] for p in pts) / len(pts)
    return min(pts, key=lambda p: (p[0] - cy) ** 2 + (p[1] - cx) ** 2)


# ---------------------------------------------------------------- estados e cidades
def load_states(path="js/brazil-geo.js"):
    src = open(path, encoding="utf-8").read()
    geo = json.loads(src[src.index("{"): src.rindex("}") + 1])
    states = []
    for s in geo["states"]:
        rings = []
        for part in s["d"].split("M")[1:]:
            pts = [tuple(map(float, xy.split(","))) for xy in part.rstrip("Z").split("L")]
            rings.append(pts)
        xs = [x for r in rings for x, _ in r]
        ys = [y for r in rings for _, y in r]
        states.append((s["uf"], rings, (min(xs), min(ys), max(xs), max(ys))))
    return states


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def state_of(lat, lng, states):
    x, y = (lng - LNG0) * COS * 10, (LAT0 - lat) * 10
    for uf, rings, (x0, y0, x1, y1) in states:
        if x0 <= x <= x1 and y0 <= y <= y1 and sum(in_ring(x, y, r) for r in rings) % 2 == 1:
            return uf
    return None


def load_cities(path="data/municipios.csv"):
    by_uf = {}
    allc = []
    for r in csv.DictReader(open(path, encoding="utf-8")):
        c = (r["nome"], r["uf"], float(r["latitude"]), float(r["longitude"]))
        by_uf.setdefault(r["uf"], []).append(c)
        allc.append(c)
    return by_uf, allc


def nearest_city(lat, lng, uf, by_uf, allc):
    pool = by_uf.get(uf) or allc
    return min(pool, key=lambda c: (c[2] - lat) ** 2 + ((c[3] - lng) * math.cos(math.radians(lat))) ** 2)


# ---------------------------------------------------------------- tags
def clean_name(n):
    n = re.sub(r"\s+", " ", n).strip()
    return n[0].upper() + n[1:] if n else n


def number(v):
    m = re.search(r"\d+(?:[.,]\d+)?", v or "")
    return float(m.group().replace(",", ".")) if m else None


def hours_from(tag, km):
    if tag:
        m = re.match(r"^(\d+):(\d{2})", tag)
        if m:
            return int(m.group(1)) + int(m.group(2)) / 60
        n = number(tag)
        if n:
            return n
    return max(0.5, round(km / 3.0 * 2) / 2)  # ~3 km/h em trilha, arredondado para meia hora


def difficulty(tags, km):
    if tags.get("sac_scale") in SAC:
        return SAC[tags["sac_scale"]], False
    if km < 5:
        return "Fácil", True
    if km < 12:
        return "Moderada", True
    return "Difícil", True


def keywords(name):
    low = name.lower() + " "
    seen = []
    for k, tag in KEYWORDS:
        if k in low and tag not in seen:
            seen.append(tag)
    return seen[:3]


# ---------------------------------------------------------------- processamento
def process(raw):
    states = load_states()
    by_uf, allc = load_cities()
    elements = raw.get("elements", [])

    # caminhos que já fazem parte de uma rota não entram de novo sozinhos
    in_routes = {m["ref"] for el in elements if el["type"] == "relation" for m in el.get("members", []) if m.get("type") == "way"}

    candidates = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name:pt") or tags.get("name")
        if not name:
            continue
        if el["type"] == "way" and el["id"] in in_routes:
            continue
        lines = [ln for ln in lines_of(el) if len(ln) >= 2]
        if not lines:
            continue
        km = number(tags.get("distance")) or length_km(lines)
        if km < 0.3 or km > 1500:
            continue
        lat, lng = anchor(lines)
        candidates.append({"el": el, "tags": tags, "name": clean_name(name), "km": km, "lat": lat, "lng": lng})

    # Caminhos com o mesmo nome e próximos (um trecho por "way" no OSM) viram uma trilha só.
    merged = []
    for c in sorted(candidates, key=lambda c: (c["el"]["type"] != "relation", c["name"].lower())):
        twin = next((m for m in merged if m["name"].lower() == c["name"].lower() and hav((m["lat"], m["lng"]), (c["lat"], c["lng"])) < 3), None)
        if twin and c["el"]["type"] == "way":
            if twin["el"]["type"] == "way":
                twin["km"] += c["km"]
            continue
        merged.append(c)

    out = []
    for c in merged:
        uf = state_of(c["lat"], c["lng"], states)
        if not uf:
            continue  # fora do território (fronteira imprecisa ou mar)
        city = nearest_city(c["lat"], c["lng"], uf, by_uf, allc)
        tags = c["tags"]
        diff, estimated = difficulty(tags, c["km"])
        el = c["el"]
        item = {
            "id": f"osm-{el['type'][0]}{el['id']}",
            "name": c["name"],
            "city": city[0],
            "uf": uf,
            "lat": round(c["lat"], 5),
            "lng": round(c["lng"], 5),
            "km": round(c["km"], 1),
            "hours": round(hours_from(tags.get("duration"), c["km"]), 1),
            "difficulty": diff,
            "tags": keywords(c["name"]),
            "osm": f"{el['type']}/{el['id']}",
        }
        asc = number(tags.get("ascent"))
        if asc:
            item["elevation"] = round(asc)
        if estimated:
            item["diffEstimated"] = 1
        desc = tags.get("description:pt") or tags.get("description")
        if desc:
            item["desc"] = desc.strip()[:400]
        if tags.get("operator"):
            item["operator"] = tags["operator"][:80]
        out.append(item)

    out.sort(key=lambda t: (t["uf"], t["city"], t["name"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", help="usar uma resposta do Overpass já salva em vez de baixar")
    ap.add_argument("--save-raw", help="salvar a resposta bruta do Overpass neste arquivo")
    args = ap.parse_args()

    raw = json.load(open(args.input, encoding="utf-8")) if args.input else fetch(QUERY)
    if args.save_raw:
        json.dump(raw, open(args.save_raw, "w", encoding="utf-8"))
    trails = process(raw)
    stamp = raw.get("osm3s", {}).get("timestamp_osm_base", "")
    print(f"{len(trails)} trilhas processadas.", file=sys.stderr)
    print("// Gerado por tools/fetch-osm-trails.py — © colaboradores do OpenStreetMap (ODbL).")
    print(f"window.OSM_TRAILS_DATE = {json.dumps(stamp)};")
    print("window.OSM_TRAILS = " + json.dumps(trails, ensure_ascii=False, separators=(",", ":")) + ";")


if __name__ == "__main__":
    main()
