"""Baixa as trilhas do Brasil mapeadas no OpenStreetMap e gera js/trails-osm.js.

O que entra:
  - relações route=hiking / route=foot (trilhas oficiais e travessias mapeadas como rota);
  - caminhos (highway=path/footway/track) cujo nome começa com "Trilha", "Travessia" ou "Caminho".

Para cada trilha o script calcula a distância pela geometria, escolhe um ponto de referência
sobre o traçado, descobre o estado (pelo contorno dos estados) e a cidade (sede municipal mais
próxima dentro do estado, base do IBGE em data/municipios.csv).

Fontes (escolha com --source):
  qlever   (padrão) consultas SPARQL sobre o OSM inteiro, da Univ. de Freiburg (qlever.dev). Também informa
           em quais municípios cada trilha está (código IBGE), o que dá a cidade exata.
  overpass a API Overpass (overpass-api.de); alguns servidores recusam conexões vindas de nuvem.

Uso:
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

MIN_KM = 0.4
# Nomes que descrevem um tipo de caminho e não identificam uma trilha.
GENERIC = re.compile(
    r"^(acesso\b|trilha( de| da)? (liga[cç][aã]o|caminhada|alternativa|desconhecida|ecol[oó]gica|secund[aá]ria|principal|interna|"
    r"sem nome|particular|privada|de servi[cç]o|interpretativa|suspensa|nova|velha|antiga)\b|trilha$|caminho$|[a-z]?\s?\d+$)",
    re.I)
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


# ---------------------------------------------------------------- QLever
QLEVER_URL = "https://qlever.dev/api/osm-planet"
PREFIXES = """PREFIX osmrel: <https://www.openstreetmap.org/relation/>
PREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>
PREFIX ogc: <http://www.opengis.net/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX osm2rdf: <https://osm2rdf.cs.uni-freiburg.de/rdf#>
"""
TAGS = ["name:pt", "sac_scale", "distance", "ascent", "duration", "description", "description:pt", "operator", "highway", "route"]

# Rotas (relações) de caminhada que tocam o Brasil. route=foot só entra com nome de trilha/caminho.
Q_ROUTES = """SELECT ?el ?name ?route ?wkt WHERE {
  osmrel:59470 ogc:sfIntersects ?el .
  ?el osmkey:type "route" ; osmkey:route ?route ; osmkey:name ?name .
  FILTER(?route = "hiking" || (?route = "foot" && REGEX(?name, "(trilha|caminho|travessia|circuito|rota|passos|peregrin)", "i")))
  ?el geo:hasGeometry/geo:asWKT ?wkt .
}"""
# Caminhos com nome de trilha, e trilhas com escala de dificuldade (sac_scale), dentro do Brasil.
WAY_FILTER = """osmrel:59470 ogc:sfContains ?el .
  ?el osmkey:highway ?hw ; osmkey:name ?name .
  OPTIONAL { ?el osmkey:sac_scale ?sac }
  FILTER(
    (?hw IN ("path", "footway", "bridleway", "track") && REGEX(?name, "^(trilha|travessia) ", "i"))
    || (?hw = "path" && REGEX(?name, "^caminho ", "i"))
    || (?hw = "path" && BOUND(?sac))
  )"""
Q_WAYS = "SELECT ?el ?name ?len ?wkt WHERE {\n  " + WAY_FILTER + "\n  ?el osm2rdf:length ?len ; geo:hasGeometry/geo:asWKT ?wkt .\n}"
Q_WAY_CITIES = "SELECT ?el ?ibge WHERE {\n  " + WAY_FILTER + """
  ?el ogc:sfIntersects ?m . ?m osmkey:admin_level "8" ; osmkey:IBGE:GEOCODIGO ?ibge .
}"""
Q_ROUTE_CITIES = """SELECT ?el ?ibge WHERE {
  osmrel:59470 ogc:sfIntersects ?el .
  ?el osmkey:type "route" ; osmkey:route ?route .
  FILTER(?route IN ("hiking", "foot"))
  ?el ogc:sfIntersects ?m . ?m osmkey:admin_level "8" ; osmkey:IBGE:GEOCODIGO ?ibge .
}"""


def tags_query(kind):
    sel = " ".join(f"?t{i}" for i in range(len(TAGS)))
    opt = "\n".join(f'  OPTIONAL {{ ?el osmkey:{t} ?t{i} }}' for i, t in enumerate(TAGS))
    base = WAY_FILTER if kind == "way" else 'osmrel:59470 ogc:sfIntersects ?el . ?el osmkey:type "route" ; osmkey:route ?route . FILTER(?route IN ("hiking", "foot"))'
    return f"SELECT ?el {sel} WHERE {{\n  {base}\n{opt}\n}}"


def sparql(query):
    data = urllib.parse.urlencode({"query": PREFIXES + query}).encode()
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(QLEVER_URL, data=data, headers={
                "Accept": "application/sparql-results+json", "User-Agent": "pumping-life-trails/1.0"})
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.load(r)["results"]["bindings"]
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  QLever falhou ({e}); nova tentativa…", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise SystemExit(f"QLever não respondeu: {last}")


def wkt_lines(wkt):
    """Todas as sequências de coordenadas de um WKT (LINESTRING, MULTI*, GEOMETRYCOLLECTION)."""
    lines = []
    for grp in re.findall(r"\(([^()]+)\)", wkt):
        pts = []
        for pair in grp.split(","):
            xy = pair.split()
            if len(xy) >= 2:
                pts.append({"lat": float(xy[1]), "lon": float(xy[0])})
        if len(pts) >= 2:
            lines.append(pts)
    return lines


def fetch_qlever():
    """Monta uma resposta no mesmo formato da Overpass, com extras _len_km e _ibge."""
    def osm_id(uri):
        kind, num = uri.rsplit("/", 2)[-2:]
        return kind, int(num)

    elements = {}
    print("QLever: rotas de caminhada…", file=sys.stderr)
    for b in sparql(Q_ROUTES):
        kind, i = osm_id(b["el"]["value"])
        el = elements.setdefault((kind, i), {"type": kind, "id": i, "tags": {"name": b["name"]["value"], "route": b["route"]["value"]}, "members": []})
        el["members"] += [{"type": "way", "ref": 0, "role": "", "geometry": ln} for ln in wkt_lines(b["wkt"]["value"])]
    print("QLever: caminhos com nome de trilha…", file=sys.stderr)
    for b in sparql(Q_WAYS):
        kind, i = osm_id(b["el"]["value"])
        lines = wkt_lines(b["wkt"]["value"])
        if not lines:
            continue
        elements[(kind, i)] = {"type": kind, "id": i, "tags": {"name": b["name"]["value"]}, "geometry": lines[0],
                               "_len_km": float(b["len"]["value"]) / 1000}
    print("QLever: etiquetas (dificuldade, descrição…)…", file=sys.stderr)
    for kind in ("relation", "way"):
        for b in sparql(tags_query("way" if kind == "way" else "route")):
            key = osm_id(b["el"]["value"])
            if key in elements:
                for n, t in enumerate(TAGS):
                    if f"t{n}" in b:
                        elements[key]["tags"].setdefault(t, b[f"t{n}"]["value"])
    print("QLever: municípios de cada trilha…", file=sys.stderr)
    for q in (Q_ROUTE_CITIES, Q_WAY_CITIES):
        for b in sparql(q):
            key = osm_id(b["el"]["value"])
            if key in elements:
                elements[key].setdefault("_ibge", []).append(b["ibge"]["value"])
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {"osm3s": {"timestamp_osm_base": stamp, "source": "qlever"}, "elements": list(elements.values())}


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
    by_uf, allc, by_code = {}, [], {}
    for r in csv.DictReader(open(path, encoding="utf-8")):
        c = (r["nome"], r["uf"], float(r["latitude"]), float(r["longitude"]))
        by_uf.setdefault(r["uf"], []).append(c)
        allc.append(c)
        by_code[r["codigo_ibge"]] = c
    return by_uf, allc, by_code


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
    by_uf, allc, by_code = load_cities()
    elements = raw.get("elements", [])

    # caminhos que já fazem parte de uma rota não entram de novo sozinhos
    in_routes = {m["ref"] for el in elements if el["type"] == "relation" for m in el.get("members", []) if m.get("type") == "way"}
    # (sem os ids dos membros, como no QLever: compara o traçado — células de ~110 m)
    cell = lambda lat, lon: (round(lat * 900), round(lon * 900))
    route_cells = set()
    for el in elements:
        if el["type"] == "relation":
            for ln in lines_of(el):
                for la, lo in ln:
                    cx, cy = cell(la, lo)
                    route_cells.update((cx + dx, cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))

    def inside_route(lines):
        pts = [p for ln in lines for p in ln]
        return bool(route_cells) and sum(cell(*p) in route_cells for p in pts) >= 0.6 * len(pts)

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
        if el["type"] == "way" and inside_route(lines):
            continue
        km = number(tags.get("distance")) or el.get("_len_km") or length_km(lines)
        if km > 1500:
            continue
        lat, lng = anchor(lines)
        if re.match(r"^(rua|avenida|travessa|estrada|rodovia)\b", name, re.I) or GENERIC.search(name):
            continue  # vias urbanas, estradas e nomes genéricos que não identificam uma trilha
        candidates.append({"el": el, "tags": tags, "name": clean_name(name), "km": km, "lat": lat, "lng": lng})

    # Trechos com o mesmo nome encadeados (cada um a menos de 4 km de outro do grupo) são uma trilha só.
    # Se o grupo tem uma rota (relação), fica a rota; senão os trechos somam a distância.
    by_name = {}
    for c in candidates:
        by_name.setdefault(c["name"].lower(), []).append(c)
    merged = []
    for group in by_name.values():
        parent = list(range(len(group)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                if hav((group[i]["lat"], group[i]["lng"]), (group[j]["lat"], group[j]["lng"])) < 4:
                    parent[find(i)] = find(j)
        clusters = {}
        for i, c in enumerate(group):
            clusters.setdefault(find(i), []).append(c)
        for cl in clusters.values():
            rel = [c for c in cl if c["el"]["type"] == "relation"]
            if rel:
                merged.append(max(rel, key=lambda c: c["km"]))
                continue
            main = max(cl, key=lambda c: c["km"])
            main = dict(main, km=sum(c["km"] for c in cl))
            merged.append(main)
    merged = [c for c in merged if c["km"] >= MIN_KM]

    out = []
    for c in merged:
        # Cidade: entre os municípios que a trilha cruza (IBGE), o de sede mais próxima do ponto de referência.
        known = [by_code[x] for x in set(c["el"].get("_ibge", [])) if x in by_code]
        if known:
            city = min(known, key=lambda m: (m[2] - c["lat"]) ** 2 + ((m[3] - c["lng"]) * math.cos(math.radians(c["lat"]))) ** 2)
            uf = city[1]
        else:
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
    ap.add_argument("--source", choices=["qlever", "overpass"], default="qlever")
    ap.add_argument("--input", help="usar uma resposta já salva (--save-raw) em vez de baixar")
    ap.add_argument("--save-raw", help="salvar a resposta bruta do Overpass neste arquivo")
    args = ap.parse_args()

    if args.input:
        raw = json.load(open(args.input, encoding="utf-8"))
    else:
        raw = fetch_qlever() if args.source == "qlever" else fetch(QUERY)
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
