"""Gera js/brazil-geo.js a partir de dados do Natural Earth (domínio público).

Fontes (baixe e extraia antes de rodar):
  - Estados do Brasil: pacote npm `datamaps` (MIT) -> src/js/data/bra.topo.json e bra.json
  - Países vizinhos:   pacote npm `world-atlas` (ISC) -> countries-50m.json

Uso:
  python3 tools/build-geo.py bra.topo.json bra.json countries-50m.json > js/brazil-geo.js

A projeção (equiretangular com correção de cos 15°) precisa ser a mesma de js/map.js.
"""
import json
import math
import sys

COS = math.cos(math.radians(15))
LNG0, LAT0 = -76.0, 7.0          # canto superior esquerdo da área do mapa
LNG1, LAT1 = -32.0, -35.0        # canto inferior direito
TOL = 0.06                       # tolerância de simplificação (unidades do mapa ≈ 0,006°)

NAMES = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia", "CE": "Ceará",
    "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso",
    "MS": "Mato Grosso do Sul", "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
    "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo",
    "SE": "Sergipe", "TO": "Tocantins",
}


def proj(lng, lat):
    return ((lng - LNG0) * COS * 10, (LAT0 - lat) * 10)


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append(proj(x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def dp(pts, tol):
    """Douglas–Peucker mantendo as pontas (fronteiras compartilhadas continuam idênticas)."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-12
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            x0, y0 = pts[i]
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm if (dx or dy) else math.hypot(x0 - x1, y0 - y1)
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def ring(arcs, idxs):
    pts = []
    for i in idxs:
        seg = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(seg if not pts else seg[1:])
    return pts


def polygons(geom):
    if geom["type"] == "Polygon":
        return [geom["arcs"]]
    if geom["type"] == "MultiPolygon":
        return geom["arcs"]
    return []


def fmt(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def path(rings):
    parts = []
    for r in rings:
        if len(r) < 3:
            continue
        parts.append("M" + "L".join(f"{fmt(x)},{fmt(y)}" for x, y in r) + "Z")
    return "".join(parts)


def bbox(r):
    xs, ys = [p[0] for p in r], [p[1] for p in r]
    return min(xs), min(ys), max(xs), max(ys)


def main(bra_path, bra_geojson_path, world_path):
    W, H = proj(LNG1, LAT1)
    by_name = {v: k for k, v in NAMES.items()}
    labels = {}
    for f in json.load(open(bra_geojson_path))["features"]:
        p = f["properties"]
        labels[by_name[p["name"]]] = proj(p["longitude"], p["latitude"])

    bra = json.load(open(bra_path))
    arcs = [dp(a, TOL) for a in decode_arcs(bra)]
    states = []
    for g in bra["objects"]["bra"]["geometries"]:
        uf = by_name[g["properties"]["name"]]
        rings = []
        for poly in polygons(g):
            for r in poly:
                pts = ring(arcs, r)
                x0, y0, x1, y1 = bbox(pts)
                if (x1 - x0) * (y1 - y0) < 0.05:  # ilhotas minúsculas
                    continue
                rings.append(pts)
        lx, ly = labels[uf]
        states.append({"uf": uf, "name": NAMES[uf], "d": path(rings), "lx": round(lx, 1), "ly": round(ly, 1)})
    states.sort(key=lambda s: s["uf"])

    world = json.load(open(world_path))
    warcs = [dp(a, TOL * 2) for a in decode_arcs(world)]
    neighbors = []
    for g in world["objects"]["countries"]["geometries"]:
        if g.get("id") == "076":  # Brasil (desenhado pelos estados)
            continue
        rings = []
        for poly in polygons(g):
            pts = ring(warcs, poly[0])
            x0, y0, x1, y1 = bbox(pts)
            if x1 - x0 > 300 or x1 < -40 or y1 < -40 or x0 > W + 40 or y0 > H + 40 or (x1 - x0) * (y1 - y0) < 0.5:
                continue
            rings.append(pts)
        if rings:
            neighbors.append(path(rings))

    out = {
        "width": round(W, 1),
        "height": round(H, 1),
        "states": states,
        "neighbors": "".join(neighbors),
    }
    print("// Gerado por tools/build-geo.py — dados: Natural Earth (domínio público).")
    print("window.BRAZIL_GEO = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
