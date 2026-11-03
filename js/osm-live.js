// Busca trilhas no OpenStreetMap direto do navegador (API Overpass, que aceita CORS).
// Mesmo processamento de tools/fetch-osm-trails.py, para uma região menor.
(function () {
  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  const SAC = {
    hiking: "Fácil", mountain_hiking: "Moderada", demanding_mountain_hiking: "Difícil",
    alpine_hiking: "Difícil", demanding_alpine_hiking: "Difícil", difficult_alpine_hiking: "Difícil",
  };
  const KEYWORDS = [["cachoeira", "cachoeira"], ["salto", "cachoeira"], ["pico", "pico"], ["morro", "morro"], ["pedra", "pedra"],
    ["serra", "serra"], ["praia", "praia"], ["travessia", "travessia"], ["mirante", "mirante"], ["lagoa", "lagoa"], ["gruta", "gruta"]];
  const CACHE_KEY = "pumping-life:osm-cache:v1";
  const CACHE_DAYS = 7;

  function query(filter) {
    return `[out:json][timeout:90];
(
  relation["route"~"^(hiking|foot)$"]${filter};
  way["highway"~"^(path|footway|track|bridleway)$"]["name"~"^(trilha|travessia|caminho) ",i]${filter};
);
out tags geom;`;
  }

  async function overpass(q, signal) {
    let last;
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: q }), signal });
        if (res.ok) return await res.json();
        last = new Error(`HTTP ${res.status}`);
      } catch (e) {
        if (e.name === "AbortError") throw e;
        last = e;
      }
    }
    throw last || new Error("sem resposta");
  }

  const rad = Math.PI / 180;
  function hav(a, b) {
    const h = Math.sin((b[0] - a[0]) * rad / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin((b[1] - a[1]) * rad / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function linesOf(el) {
    const pts = (g) => (g || []).filter(Boolean).map((p) => [p.lat, p.lon]);
    if (el.type === "way") return [pts(el.geometry)];
    return (el.members || []).filter((m) => m.type === "way" && m.geometry && !["stop", "platform"].includes(m.role)).map((m) => pts(m.geometry));
  }
  const lengthKm = (lines) => lines.reduce((s, l) => s + l.slice(1).reduce((t, p, i) => t + hav(l[i], p), 0), 0);
  function anchor(lines) {
    const pts = lines.flat();
    const cy = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cx = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return pts.reduce((best, p) => ((p[0] - cy) ** 2 + (p[1] - cx) ** 2 < (best[0] - cy) ** 2 + (best[1] - cx) ** 2 ? p : best));
  }
  const numberOf = (v) => { const m = String(v || "").match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(",", ".")) : null; };
  function hoursOf(tag, km) {
    const m = String(tag || "").match(/^(\d+):(\d{2})/);
    if (m) return +m[1] + +m[2] / 60;
    return numberOf(tag) || Math.max(0.5, Math.round((km / 3) * 2) / 2);
  }

  function process(raw, cities, ufFilter) {
    const els = raw.elements || [];
    const inRoutes = new Set(els.filter((e) => e.type === "relation").flatMap((e) => (e.members || []).filter((m) => m.type === "way").map((m) => m.ref)));
    const cand = [];
    for (const el of els) {
      const tags = el.tags || {};
      const name = (tags["name:pt"] || tags.name || "").replace(/\s+/g, " ").trim();
      if (!name || (el.type === "way" && inRoutes.has(el.id))) continue;
      const lines = linesOf(el).filter((l) => l.length >= 2);
      if (!lines.length) continue;
      const km = numberOf(tags.distance) || lengthKm(lines);
      if (km < 0.3 || km > 1500) continue;
      cand.push({ el, tags, name: name[0].toUpperCase() + name.slice(1), km, at: anchor(lines) });
    }
    cand.sort((a, b) => (a.el.type !== "relation") - (b.el.type !== "relation") || a.name.localeCompare(b.name));
    const merged = [];
    for (const c of cand) {
      const twin = merged.find((m) => m.name.toLowerCase() === c.name.toLowerCase() && hav(m.at, c.at) < 3);
      if (twin && c.el.type === "way") { if (twin.el.type === "way") twin.km += c.km; continue; }
      merged.push(c);
    }
    const out = [];
    for (const c of merged) {
      const [lat, lng] = c.at;
      const pool = ufFilter ? cities.filter((x) => x.uf === ufFilter) : cities;
      const cosLat = Math.cos(lat * rad);
      let city = pool[0], best = Infinity;
      for (const x of pool) {
        const d = (x.lat - lat) ** 2 + ((x.lng - lng) * cosLat) ** 2;
        if (d < best) { best = d; city = x; }
      }
      if (!city || best > 1.2) continue; // longe de qualquer município brasileiro (fora do país)
      const sac = SAC[c.tags.sac_scale];
      const t = {
        id: `osm-${c.el.type[0]}${c.el.id}`,
        name: c.name,
        city: city.name,
        uf: city.uf,
        lat: +lat.toFixed(5),
        lng: +lng.toFixed(5),
        km: +c.km.toFixed(1),
        hours: +hoursOf(c.tags.duration, c.km).toFixed(1),
        difficulty: sac || (c.km < 5 ? "Fácil" : c.km < 12 ? "Moderada" : "Difícil"),
        tags: KEYWORDS.filter(([k]) => (c.name.toLowerCase() + " ").includes(k)).map(([, v]) => v).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3),
        osm: `${c.el.type}/${c.el.id}`,
      };
      const asc = numberOf(c.tags.ascent);
      if (asc) t.elevation = Math.round(asc);
      if (!sac) t.diffEstimated = 1;
      const desc = c.tags["description:pt"] || c.tags.description;
      if (desc) t.desc = desc.trim().slice(0, 400);
      if (c.tags.operator) t.operator = c.tags.operator.slice(0, 80);
      out.push(t);
    }
    return out;
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (_) { return {}; }
  }
  function writeCache(key, trails) {
    try {
      const c = readCache();
      c[key] = { at: Date.now(), trails };
      // guarda só as 12 regiões mais recentes
      const keys = Object.keys(c).sort((a, b) => c[b].at - c[a].at).slice(0, 12);
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, c[k]]))));
    } catch (_) { /* armazenamento cheio ou bloqueado */ }
  }

  async function load(key, q, cities, uf, signal) {
    const hit = readCache()[key];
    if (hit && Date.now() - hit.at < CACHE_DAYS * 864e5) return hit.trails;
    const trails = process(await overpass(q, signal), cities, uf);
    writeCache(key, trails);
    return trails;
  }

  window.OsmLive = {
    around(lat, lng, km, cities, signal) {
      const r = Math.round(Math.min(km, 80) * 1000);
      return load(`a:${lat.toFixed(2)},${lng.toFixed(2)},${r}`, query(`(around:${r},${lat},${lng})`), cities, null, signal);
    },
    state(uf, cities, signal) {
      return load(`s:${uf}`, `[out:json][timeout:120];area["ISO3166-2"="BR-${uf}"]->.a;` + query("(area.a)").replace("[out:json][timeout:90];", ""), cities, uf, signal);
    },
  };
})();
