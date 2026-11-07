(function () {
  const { state, save, uid } = window.Store;
  const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  // Catálogo: trilhas da curadoria + trilhas do OpenStreetMap (js/trails-osm.js).
  // Uma trilha do OSM a menos de 2 km de uma da curadoria e com palavras do nome em comum é a mesma trilha.
  const STOP = new Set(["trilha", "da", "do", "de", "dos", "das", "caminho", "travessia"]);
  const words = (n) => norm(n).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
  function hav(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const STATE_NAMES = window.UF_NAMES;
  const DIFF_CLASS = { "Fácil": "easy", "Moderada": "medium", "Difícil": "hard" };

  // Toda trilha passa por aqui antes de ser usada: dados do OpenStreetMap, da busca ao vivo e do
  // navegador (localStorage) são externos. Campos inválidos descartam a trilha ou viram um valor seguro.
  const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
  const text = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  function cleanTrail(t, source) {
    if (!t || typeof t !== "object") return null;
    const id = typeof t.id === "string" && /^[a-z0-9-]{1,60}$/.test(t.id) ? t.id : null;
    const name = text(t.name, 140), city = text(t.city, 80);
    if (!id || !name || !city || !STATE_NAMES[t.uf] || !finite(t.lat, -35, 6) || !finite(t.lng, -75, -28) || !finite(t.km, 0.05, 2000)) return null;
    return {
      id, name, city, uf: t.uf, lat: t.lat, lng: t.lng, km: t.km,
      hours: finite(t.hours, 0.1, 500) ? t.hours : Math.max(0.5, Math.round((t.km / 3) * 2) / 2),
      difficulty: DIFF_CLASS[t.difficulty] ? t.difficulty : "Moderada",
      elevation: finite(t.elevation, 1, 9000) ? Math.round(t.elevation) : null,
      tags: Array.isArray(t.tags) ? t.tags.filter((x) => typeof x === "string").slice(0, 3).map((x) => x.slice(0, 24)) : [],
      desc: text(t.desc, 400),
      operator: text(t.operator, 80),
      osm: typeof t.osm === "string" && /^(way|relation|node)\/\d{1,12}$/.test(t.osm) ? t.osm : "",
      diffEstimated: !!t.diffEstimated,
      source,
    };
  }
  const sameTrail = (c, o) => hav(c, o) < 2 && words(c.name).some((w) => words(o.name).includes(w));
  const curated = window.TRAILS.map((t) => cleanTrail(t, "curadoria")).filter(Boolean);
  const osm = (window.OSM_TRAILS || []).map((t) => cleanTrail(t, "osm")).filter((o) => o && !curated.some((c) => sameTrail(c, o)));
  const TRAILS = curated.concat(osm);
  const trailById = Object.create(null);
  TRAILS.forEach((t) => { trailById[t.id] = t; });
  Object.values(state.knownTrails).forEach((raw) => {
    const t = cleanTrail(raw, "osm");
    if (t && !trailById[t.id]) { TRAILS.push(t); trailById[t.id] = t; }
  });

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;
  const todayISO = () => window.Store.localISO();

  // ---------- Página sem zoom (o zoom fica só dentro do mapa) ----------
  document.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0", "_"].includes(e.key)) e.preventDefault();
  });
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1 && !e.target.closest(".map")) e.preventDefault(); }, { passive: false });

  // ---------- Utilitários de UI ----------
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function ask(message, okLabel) {
    return new Promise((resolve) => {
      const dlg = $("#confirmDialog");
      $("#confirmMsg").textContent = message;
      $("#confirmOk").textContent = okLabel;
      dlg.returnValue = "";
      dlg.onclose = () => resolve(dlg.returnValue === "ok");
      dlg.showModal();
    });
  }

  function duration(h) {
    if (h >= 24) return `${Math.round(h / 24)} dias`;
    return `${num(h)} h`;
  }

  function fmtDate(iso, opts = { weekday: "short", day: "2-digit", month: "short" }) {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", opts);
  }

  $$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

  // ---------- Usuário ----------
  const me = () => state.user?.name || null;

  function renderProfileBtn() {
    const name = me();
    $("#profileBtn").textContent = name ? name.slice(0, 1).toUpperCase() : "Entrar";
    $("#profileBtn").classList.toggle("avatar", !!name);
    $("#profileBtn").title = name ? `${name} — editar perfil` : "Criar perfil";
  }

  let afterProfile = null;
  function openProfile(cb) {
    afterProfile = cb || null;
    $("#pfName").value = state.user?.name || "";
    $("#pfCity").value = state.user?.city || "";
    $("#profileDialog").showModal();
  }
  function requireUser(then) { if (me()) then(); else openProfile(then); }

  $("#profileBtn").addEventListener("click", () => openProfile());
  $("#profileForm").addEventListener("submit", (e) => {
    const name = $("#pfName").value.trim();
    if (!name) { e.preventDefault(); return; }
    state.user = { name, city: $("#pfCity").value.trim() };
    save();
    renderProfileBtn();
    renderAll();
    toast(`Perfil salvo. Olá, ${name}.`);
    const cb = afterProfile; afterProfile = null;
    if (cb) setTimeout(cb, 0);
  });

  // ---------- Abas ----------
  const VIEWS = ["explorar", "agenda", "comunidade", "loja"];
  function route() {
    const tab = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "explorar";
    VIEWS.forEach((v) => { $(`#view-${v}`).hidden = v !== tab; });
    $$(".tabs a").forEach((a) => a.toggleAttribute("aria-current", a.dataset.tab === tab));
    window.FX.tabIndicator($(".tabs"));
    if (tab === "explorar") setTimeout(() => mapView?.refresh(), 0);
  }
  window.addEventListener("hashchange", route);

  // ---------- Geografia ----------
  const distanceKm = hav;

  // Municípios do IBGE: "nome|UF|lat|lng|capital;..."
  let citiesCache = null;
  const cities = () => citiesCache || (citiesCache = window.MUNICIPIOS.split(";").map((r) => {
    const [name, uf, lat, lng, cap] = r.split("|");
    return { name, uf, lat: +lat, lng: +lng, capital: cap === "1", key: norm(name), full: norm(`${name}, ${uf}`) };
  }));
  const POPULAR = ["sao paulo, sp", "rio de janeiro, rj", "belo horizonte, mg", "curitiba, pr", "florianopolis, sc",
    "brasilia, df", "porto alegre, rs", "salvador, ba", "goiania, go", "campinas, sp"];
  const cleanQuery = (q) => norm(q).replace(/\s*[-–\/]\s*([a-z]{2})$/, ", $1");

  function cityMatches(query, limit = 12) {
    const q = cleanQuery(query);
    if (!q) {
      // Sem texto: a cidade do perfil primeiro, depois as capitais mais buscadas.
      const own = state.user?.city ? cityMatches(state.user.city, 1) : [];
      const popular = POPULAR.map((k) => cities().find((c) => c.full === k)).filter(Boolean);
      return own.concat(popular.filter((c) => !own.includes(c))).slice(0, limit);
    }
    const starts = [], contains = [];
    for (const c of cities()) {
      if (c.full.startsWith(q) || c.key.startsWith(q)) starts.push(c);
      else if (c.key.includes(q)) contains.push(c);
    }
    const rank = (a, b) => (b.capital - a.capital) || a.name.length - b.name.length;
    return starts.sort(rank).concat(contains.sort(rank)).slice(0, limit);
  }

  function localCity(query) {
    const q = cleanQuery(query);
    const hit = cities().find((c) => c.full === q) || cityMatches(query, 1)[0];
    return hit ? { lat: hit.lat, lng: hit.lng, label: `${hit.name}, ${hit.uf}` } : null;
  }

  async function geocode(query) {
    const local = localCity(query);
    if (local) return local;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const [hit] = await res.json();
        if (hit) return { lat: +hit.lat, lng: +hit.lon, label: hit.display_name.split(",").slice(0, 2).join(",") };
      }
    } catch (_) { /* sem rede: só a lista local */ }
    return null;
  }

  // ---------- Explorar ----------
  let origin = null;
  let mapView = null;

  function upcomingCount(trailId) {
    const today = todayISO();
    return state.events.filter((e) => e.trailId === trailId && e.date >= today).length;
  }

  function fillStateFilter() {
    const counts = {};
    TRAILS.forEach((t) => { counts[t.uf] = (counts[t.uf] || 0) + 1; });
    $("#stateFilter").innerHTML = '<option value="">Todos os estados</option>' + Object.keys(counts)
      .sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]))
      .map((uf) => `<option value="${uf}">${esc(STATE_NAMES[uf])} (${counts[uf]})</option>`).join("");
  }

  function fillCityFilter() {
    const uf = $("#stateFilter").value;
    const prev = $("#cityFilter").value;
    const cities = {};
    TRAILS.filter((t) => !uf || t.uf === uf).forEach((t) => { const k = `${t.city}|${t.uf}`; cities[k] = (cities[k] || 0) + 1; });
    $("#cityFilter").innerHTML = '<option value="">Todas as cidades</option>' + Object.keys(cities)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => { const [c, u] = k.split("|"); return `<option value="${esc(k)}">${esc(c)}${uf ? "" : ` – ${u}`} (${cities[k]})</option>`; }).join("");
    $("#cityFilter").value = cities[prev] ? prev : "";
  }

  function setStateFilter(uf) {
    $("#stateFilter").value = uf || "";
    fillCityFilter();
    mapView?.selectState(uf || null);
    renderTrails();
    if (uf && !origin) loadLive({ kind: "state", uf });
  }

  function filteredTrails() {
    const uf = $("#stateFilter").value;
    const city = $("#cityFilter").value;
    const diff = $("#difficulty").value;
    const radius = +$("#radius").value;
    const q = norm($("#nameFilter").value);
    return TRAILS
      .map((t) => ({ ...t, dist: origin ? distanceKm(origin, t) : null }))
      .filter((t) => !uf || t.uf === uf)
      .filter((t) => !city || `${t.city}|${t.uf}` === city)
      .filter((t) => !diff || t.difficulty === diff)
      .filter((t) => !q || norm(`${t.name} ${t.city} ${t.tags.join(" ")}`).includes(q))
      .filter((t) => !origin || t.dist <= radius);
  }

  function groupTrails(list) {
    const states = new Map();
    list.forEach((t) => {
      if (!states.has(t.uf)) states.set(t.uf, new Map());
      const cities = states.get(t.uf);
      if (!cities.has(t.city)) cities.set(t.city, []);
      cities.get(t.city).push(t);
    });
    const minDist = (arr) => Math.min(...arr.map((t) => t.dist));
    const byName = (a, b) => a.name.localeCompare(b.name);
    return [...states.entries()].map(([uf, cities]) => {
      const cityList = [...cities.entries()].map(([city, trails]) => ({
        city, trails: trails.sort(origin ? (a, b) => a.dist - b.dist : byName), near: origin ? minDist(trails) : 0,
      })).sort(origin ? (a, b) => a.near - b.near : (a, b) => a.city.localeCompare(b.city));
      return { uf, cities: cityList, count: cityList.reduce((n, c) => n + c.trails.length, 0), near: origin ? Math.min(...cityList.map((c) => c.near)) : 0 };
    }).sort(origin ? (a, b) => a.near - b.near : (a, b) => b.count - a.count || STATE_NAMES[a.uf].localeCompare(STATE_NAMES[b.uf]));
  }

  let rowIdx = 0;
  function trailRow(t) {
    const n = upcomingCount(t.id);
    return `
      <li style="--i:${Math.min(rowIdx++, 24)}">
        <button class="trail" type="button" data-id="${t.id}">
          <i class="blaze ${DIFF_CLASS[t.difficulty]}" title="${t.difficulty}"></i>
          <span class="trail-main">
            <span class="trail-name">${esc(t.name)}</span>
            <span class="trail-meta"><span>${num(t.km)} km</span>${t.elevation ? `<span>↑ ${num(t.elevation)} m</span>` : ""}<span>${duration(t.hours)}</span><span class="diff-${DIFF_CLASS[t.difficulty]}">${t.difficulty}${t.diffEstimated ? '<abbr title="Dificuldade estimada pela distância">*</abbr>' : ""}</span></span>
          </span>
          <span class="trail-side">
            ${t.dist != null ? `<span class="dist">${num(Math.round(t.dist))} km</span>` : ""}
            ${n ? `<span class="sched">${plural(n, "saída", "saídas")}</span>` : ""}
          </span>
        </button>
      </li>`;
  }

  const PAGE = 120;
  let shown = PAGE;

  function stateChips(list) {
    const counts = {};
    list.forEach((t) => { counts[t.uf] = (counts[t.uf] || 0) + 1; });
    return `<div class="state-chips" role="group" aria-label="Filtrar por estado">${Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
      .map((uf) => `<button class="state-chip" type="button" data-uf="${uf}" title="${esc(STATE_NAMES[uf])}"><span class="uf-plate sm">${uf}</span>${num(counts[uf])}</button>`).join("")}</div>`;
  }

  function renderTrails(resetPage = true) {
    if (resetPage) shown = PAGE;
    const list = filteredTrails();
    const radius = +$("#radius").value;
    $("#radiusLabel").textContent = `${num(radius)} km`;

    const where = $("#cityFilter").value ? $("#cityFilter").value.replace("|", ", ")
      : $("#stateFilter").value ? STATE_NAMES[$("#stateFilter").value] : "Brasil";
    $("#resultCount").innerHTML = `<strong>${plural(list.length, "trilha", "trilhas")}</strong> · ${esc(where)}`
      + (origin ? ` · até ${num(radius)} km de ${esc(origin.label)}` : "");
    const filtered = $("#stateFilter").value || $("#cityFilter").value || $("#difficulty").value || $("#nameFilter").value || origin;
    $("#clearFilters").hidden = !filtered;

    let budget = shown;
    rowIdx = 0;
    const groups = groupTrails(list).map((g) => {
      const cities = [];
      for (const c of g.cities) {
        if (budget <= 0) break;
        cities.push({ ...c, trails: c.trails.slice(0, budget) });
        budget -= c.trails.length;
      }
      return { ...g, cities };
    }).filter((g) => g.cities.length);
    const rest = list.length - shown;

    $("#trailGroups").innerHTML = !list.length
      ? `<div class="empty"><p>Nenhuma trilha com esses filtros.</p><p class="muted">${origin ? "Aumente o raio de distância ou " : ""}troque o estado ou a cidade.</p></div>`
      : (!$("#stateFilter").value && !$("#cityFilter").value ? stateChips(list) : "") + groups.map((g) => `
      <section class="state-group">
        <header class="state-head">
          <span class="uf-plate">${g.uf}</span>
          <h2>${esc(STATE_NAMES[g.uf])}</h2>
          <span class="state-count">${plural(g.count, "trilha", "trilhas")} · ${plural(g.cities.length, "cidade", "cidades")}</span>
        </header>
        ${g.cities.map((c) => `
          <div class="city-group">
            <h3 class="city-name">${esc(c.city)}</h3>
            <ul class="trail-list">${c.trails.map(trailRow).join("")}</ul>
          </div>`).join("")}
      </section>`).join("")
      + (rest > 0 ? `<button id="moreTrails" class="btn btn-ghost more" type="button">Mostrar mais ${num(Math.min(PAGE, rest))} (faltam ${num(rest)})</button>` : "");

    mapView?.setVisible(new Set(list.map((t) => t.id)));
  }

  function renderStats() {
    const ufs = new Set(TRAILS.map((t) => t.uf)).size;
    const cities = new Set(TRAILS.map((t) => `${t.city}|${t.uf}`)).size;
    const upcoming = state.events.filter((e) => e.date >= todayISO()).length;
    const first = !renderStats.done;
    const n = (v) => first ? `<b data-count="${v}">0</b>` : `<b>${num(v)}</b>`;
    $("#catalogStats").innerHTML = `<span>${n(TRAILS.length)} trilhas</span><span>${n(cities)} cidades</span><span>${n(ufs)} estados</span><span>${n(upcoming)} saídas agendadas</span>`;
    if (first) { renderStats.done = true; window.FX.countUp($("#catalogStats")); }
  }

  // ---------- Destaques: trilha do dia e carrossel ----------
  const art = (t, opts) => window.FX.landscape(t.id, opts);
  function trailOfDay() {
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
    return curated[day % curated.length];
  }

  function renderHero() {
    if (!$("#heroTopo").firstChild) {
      $("#heroTopo").innerHTML = window.FX.contours("pumping-life");
      window.FX.pauseOffscreen($(".hero"));
    }
    const t = trailOfDay();
    $("#trailOfDay").innerHTML = `
      <div class="day-art">${art(t, { tall: true })}</div>
      <div class="day-body">
        <span class="day-sign">Trilha do dia</span>
        <h2>${esc(t.name)}</h2>
        <p class="eyebrow"><span class="uf-plate sm">${t.uf}</span> ${esc(t.city)}</p>
        <p class="day-stats"><span>${num(t.km)} km</span><span>↑ ${num(t.elevation)} m</span><span>${duration(t.hours)}</span><span class="diff-${DIFF_CLASS[t.difficulty]}"><i class="blaze ${DIFF_CLASS[t.difficulty]}"></i>${t.difficulty}</span></p>
        <div class="day-actions">
          <button class="btn" type="button" data-open="${t.id}">Ver trilha</button>
          <button class="btn btn-ghost on-art" type="button" data-schedule-id="${t.id}">Agendar</button>
        </div>
      </div>`;
    const list = curated.slice().sort((a, b) => upcomingCount(b.id) - upcomingCount(a.id) || a.name.localeCompare(b.name));
    $("#featuredList").innerHTML = list.map((t, i) => {
      const n = upcomingCount(t.id);
      return `
      <li style="--i:${i}">
        <button class="feat-card" type="button" data-open="${t.id}">
          <span class="feat-art">${art(t)}<span class="feat-km">${num(t.km)} km</span>${n ? `<span class="feat-badge">${plural(n, "saída", "saídas")}</span>` : ""}</span>
          <span class="feat-body">
            <span class="feat-place"><span class="uf-plate sm">${t.uf}</span>${esc(t.city)}</span>
            <span class="feat-name">${esc(t.name)}</span>
            <span class="feat-meta"><i class="blaze ${DIFF_CLASS[t.difficulty]}"></i>${t.difficulty} · ↑ ${num(t.elevation)} m · ${duration(t.hours)}</span>
          </span>
        </button>
      </li>`;
    }).join("");
  }

  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) { openTrail(open.dataset.open); return; }
    const sch = e.target.closest("[data-schedule-id]");
    if (sch) { openEventForm(sch.dataset.scheduleId); return; }
    const sc = e.target.closest("[data-scroll]");
    if (sc) {
      const list = $("#featuredList");
      list.scrollBy({ left: +sc.dataset.scroll * Math.max(280, list.clientWidth * 0.8), behavior: window.FX.reduce() ? "auto" : "smooth" });
    }
  });

  function setOrigin(o) {
    origin = o;
    $("#locStatus").textContent = `Ordenando por distância a partir de ${o.label}.`;
    mapView?.setOrigin(o, +$("#radius").value);
    renderTrails();
    loadLive({ kind: "around", o });
  }

  // ---------- Trilhas do OpenStreetMap carregadas na hora ----------
  // Usado enquanto js/trails-osm.js estiver vazio: busca as trilhas da região escolhida direto no OSM.
  const HAS_STATIC_OSM = (window.OSM_TRAILS || []).length > 0;
  const IN_PREVIEW = (() => { try { return window.top !== window.self; } catch (_) { return true; } })();
  let liveCtrl = null, lastLive = null;
  const loadedStates = new Set();

  function osmStatus(html, kind = "") {
    const el = $("#osmStatus");
    el.hidden = !html;
    el.className = `osm-status ${kind}`;
    el.innerHTML = html || "";
  }

  function addTrails(list) {
    const fresh = list.map((o) => cleanTrail(o, "osm")).filter((o) => o && !trailById[o.id] && !curated.some((c) => sameTrail(c, o)));
    fresh.forEach((t) => { TRAILS.push(t); trailById[t.id] = t; });
    if (fresh.length) {
      mapView?.addTrails(fresh);
      const uf = $("#stateFilter").value;
      fillStateFilter(); $("#stateFilter").value = uf;
      fillCityFilter(); fillTrailSelects(); renderStats(); renderTrails(false);
    }
    return fresh.length;
  }

  async function loadLive(req) {
    if (HAS_STATIC_OSM || !window.OsmLive) return;
    if (req.kind === "state" && loadedStates.has(req.uf)) return;
    liveCtrl?.abort();
    liveCtrl = new AbortController();
    lastLive = req;
    const where = req.kind === "state" ? STATE_NAMES[req.uf] : `até ${num(Math.min(+$("#radius").value, 80))} km de ${req.o.label}`;
    osmStatus(`<span class="spinner" aria-hidden="true"></span> Buscando trilhas do OpenStreetMap em ${esc(where)}…`, "loading");
    try {
      const list = req.kind === "state"
        ? await window.OsmLive.state(req.uf, cities(), liveCtrl.signal)
        : await window.OsmLive.around(req.o.lat, req.o.lng, +$("#radius").value, cities(), liveCtrl.signal);
      if (req.kind === "state") loadedStates.add(req.uf);
      const n = addTrails(list);
      osmStatus(list.length
        ? `${plural(list.length, "trilha encontrada", "trilhas encontradas")} no OpenStreetMap em ${esc(where)}${n ? "" : " (já estavam na lista)"}.`
        : `O OpenStreetMap não tem trilhas mapeadas em ${esc(where)}.`, "ok");
    } catch (e) {
      if (e.name === "AbortError") return;
      osmStatus(IN_PREVIEW
        ? "Esta prévia não tem acesso a sites externos, então mostra só as trilhas da curadoria. No site publicado, as trilhas do OpenStreetMap da região aparecem aqui."
        : `O OpenStreetMap não respondeu agora. <button class="link" type="button" data-retry>Tentar de novo</button>`, "error");
    }
  }

  $("#osmStatus").addEventListener("click", (e) => { if (e.target.closest("[data-retry]") && lastLive) loadLive(lastLive); });

  $("#locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) { $("#locStatus").textContent = "Este navegador não informa a localização. Digite sua cidade."; return; }
    $("#locStatus").textContent = "Obtendo sua localização…";
    navigator.geolocation.getCurrentPosition(
      (p) => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, label: "sua localização" }),
      () => { $("#locStatus").textContent = "Não foi possível acessar sua localização. Digite sua cidade."; },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });

  $("#searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    acOpen(false);
    const q = $("#cityInput").value.trim();
    if (!q) return;
    $("#locStatus").textContent = "Buscando…";
    const o = await geocode(q);
    if (o) setOrigin(o);
    else $("#locStatus").textContent = `Não encontramos “${q}”. Escolha uma cidade da lista de sugestões.`;
  });

  // ---------- Autocompletar de cidades ----------
  const acInput = $("#cityInput"), acList = $("#cityListbox");
  let acItems = [], acIndex = -1;
  const fold = (s) => [...s].map((ch) => ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || ch).join("");

  function highlight(name, query) {
    const q = fold(query.split(",")[0].trim());
    const i = q ? fold(name).indexOf(q) : -1;
    if (i < 0) return esc(name);
    return esc(name.slice(0, i)) + "<mark>" + esc(name.slice(i, i + q.length)) + "</mark>" + esc(name.slice(i + q.length));
  }

  function acOpen(open) {
    acList.hidden = !open;
    acInput.setAttribute("aria-expanded", String(open));
    if (!open) { acIndex = -1; acInput.removeAttribute("aria-activedescendant"); }
  }

  function acRender() {
    const q = acInput.value;
    acItems = cityMatches(q, 8);
    if (!acItems.length) {
      acList.innerHTML = `<li class="combo-empty">Nenhuma cidade encontrada</li>`;
      acOpen(true);
      return;
    }
    acList.innerHTML = (q.trim() ? "" : '<li class="combo-head" role="presentation">Mais buscadas</li>') + acItems.map((c, i) => `
      <li role="option" id="ac-${i}" data-i="${i}" aria-selected="${i === acIndex}">
        <span class="combo-name">${highlight(c.name, q)}</span>
        <span class="combo-state">${esc(STATE_NAMES[c.uf])}</span>
        <span class="uf-plate sm">${c.uf}</span>
      </li>`).join("");
    if (acIndex >= 0) acInput.setAttribute("aria-activedescendant", `ac-${acIndex}`);
    acOpen(true);
  }

  function acChoose(c) {
    acInput.value = `${c.name}, ${c.uf}`;
    acOpen(false);
    setOrigin({ lat: c.lat, lng: c.lng, label: `${c.name}, ${c.uf}` });
  }

  acInput.addEventListener("input", () => { acIndex = -1; acRender(); });
  acInput.addEventListener("focus", acRender);
  acInput.addEventListener("blur", () => setTimeout(() => acOpen(false), 120));
  acInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (acList.hidden) acRender();
      if (!acItems.length) return;
      acIndex = (acIndex + (e.key === "ArrowDown" ? 1 : -1) + acItems.length) % acItems.length;
      acRender();
      $(`#ac-${acIndex}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && !acList.hidden && acIndex >= 0) {
      e.preventDefault();
      acChoose(acItems[acIndex]);
    } else if (e.key === "Escape" && !acList.hidden) {
      e.preventDefault(); // no campo de busca, o Esc do navegador apagaria o texto e reabriria a lista
      acOpen(false);
    }
  });
  acList.addEventListener("mousedown", (e) => {
    const li = e.target.closest("[data-i]");
    if (!li) return;
    e.preventDefault();
    acChoose(acItems[+li.dataset.i]);
  });

  $("#radius").addEventListener("input", () => {
    if (origin) mapView?.setRadius(+$("#radius").value);
    renderTrails();
  });
  $("#radius").addEventListener("change", () => { if (origin) mapView?.setOrigin(origin, +$("#radius").value); });
  $("#stateFilter").addEventListener("change", () => setStateFilter($("#stateFilter").value));
  $("#cityFilter").addEventListener("change", () => {
    const v = $("#cityFilter").value;
    if (v && !$("#stateFilter").value) { setStateFilter(v.split("|")[1]); $("#cityFilter").value = v; renderTrails(); return; }
    renderTrails();
  });
  $("#difficulty").addEventListener("change", renderTrails);
  $("#nameFilter").addEventListener("input", renderTrails);
  $("#clearFilters").addEventListener("click", () => {
    $("#difficulty").value = ""; $("#nameFilter").value = ""; $("#cityFilter").value = "";
    origin = null; $("#locStatus").textContent = ""; $("#cityInput").value = "";
    closeRoute();
    mapView?.clearOrigin();
    setStateFilter("");
  });

  $("#trailGroups").addEventListener("click", (e) => {
    const b = e.target.closest(".trail");
    if (b) { openTrail(b.dataset.id); return; }
    const st = e.target.closest(".state-chip");
    if (st) { setStateFilter(st.dataset.uf); return; }
    if (e.target.closest("#moreTrails")) { shown += PAGE; renderTrails(false); }
  });

  function openTrail(id) {
    const t = trailById[id];
    if (!t) { toast("Essa trilha não está mais no catálogo."); return; }
    const today = todayISO();
    const evs = state.events.filter((e) => e.trailId === id && e.date >= today).sort(byDate);
    const dist = origin ? `<span>${num(Math.round(distanceKm(origin, t)))} km de ${esc(origin.label)}</span>` : "";
    const dlg = $("#trailDialog");
    dlg.innerHTML = `
      <div class="detail-art">
        ${art(t, { tall: true })}
        <div class="signpost" aria-hidden="true">
          <span class="sign-board"><span class="sign-name">${esc(t.name.length > 34 ? t.name.slice(0, 32) + "…" : t.name)}</span><span class="sign-km">${num(t.km)} km</span></span>
          <span class="sign-post"></span>
        </div>
        <button class="icon-btn detail-close" type="button" data-close aria-label="Fechar">×</button>
      </div>
      <div class="form trail-detail">
        <p class="eyebrow"><span class="uf-plate sm">${t.uf}</span> ${esc(t.city)} · ${esc(STATE_NAMES[t.uf])}</p>
        <h2>${esc(t.name)}</h2>
        <p class="detail-tags"><span class="pill diff-${DIFF_CLASS[t.difficulty]}"><i class="blaze ${DIFF_CLASS[t.difficulty]}"></i>${t.difficulty}${t.diffEstimated ? " (estimada)" : ""}</span>${t.tags.map((x) => `<span class="pill">${esc(x)}</span>`).join("")}${dist}</p>
        ${t.desc ? `<p>${esc(t.desc)}</p>` : ""}
        <dl class="facts">
          <div><dt>Distância</dt><dd>${num(t.km)} km</dd></div>
          <div><dt>Ganho de elevação</dt><dd>${t.elevation ? `${num(t.elevation)} m` : "—"}</dd></div>
          <div><dt>Duração ${t.source === "osm" ? "estimada" : "média"}</dt><dd>${duration(t.hours)}</dd></div>
        </dl>
        ${t.source === "osm" && t.osm ? `<p class="source-note">Traçado mapeado por voluntários no <a href="https://www.openstreetmap.org/${t.osm}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.${t.diffEstimated ? " Dificuldade estimada pela distância." : ""}${t.operator ? ` Gestão: ${esc(t.operator)}.` : ""} Confira as condições antes de ir.</p>` : ""}
        <h3>Próximas saídas</h3>
        ${evs.length ? `<ul class="mini-events">${evs.map((e) => `<li><b>${fmtDate(e.date)}</b> às ${esc(e.time)} · ${e.attendees.length}/${e.slots} pessoas · com ${esc(e.host)}</li>`).join("")}</ul>` : '<p class="muted">Nenhuma saída agendada. Agende a primeira.</p>'}
        ${trailGear(t)}
        <div class="actions">
          <button class="btn btn-ghost" type="button" data-route>Como chegar</button>
          <button class="btn btn-ghost" type="button" data-close>Fechar</button>
          <button class="btn" type="button" data-schedule>Agendar esta trilha</button>
        </div>
      </div>`;
    dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
    $("[data-schedule]", dlg).addEventListener("click", () => { dlg.close(); openEventForm(id); });
    $("[data-route]", dlg).addEventListener("click", () => { dlg.close(); openRoute(t); });
    dlg.showModal();
  }

  // ---------- Mapa: Leaflet com mapas abertos; se não carregar (ou no arquivo único), o mapa próprio em SVG ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src; el.onload = resolve; el.onerror = () => reject(new Error(src));
      document.head.appendChild(el);
    });
  }

  // Aplica ao mapa recém-criado o estado atual da página (filtros, origem, estado escolhido).
  function syncMap() {
    renderTrails(false);
    if (routeState && origin) setTimeout(computeRoute, 0);
    if (origin) mapView.setOrigin(origin, +$("#radius").value);
    else if ($("#stateFilter").value) mapView.selectState($("#stateFilter").value);
  }

  let svgStarted = false;
  async function useSvgMap(reason) {
    if (svgStarted) return;
    svgStarted = true;
    if (!window.BRAZIL_GEO) await loadScript("js/brazil-geo.js");
    if (!window.createSvgMap) await loadScript("js/map.js");
    mapView = window.createSvgMap($("#map"), TRAILS, {
      diffClass: DIFF_CLASS,
      onPick: openTrail,
      onState: (uf) => setStateFilter($("#stateFilter").value === uf ? "" : uf),
    });
    syncMap();
    if (reason) console.warn("Mapa online indisponível (" + reason + "); usando o mapa próprio.");
    // Aviso: este mapa não tem ruas. No arquivo único (link do Claude), aponta para o site completo.
    const note = document.createElement("p");
    note.className = "map-note";
    note.innerHTML = window.PL_FORCE_SVG
      ? 'Mapa simplificado, sem ruas. <a href="https://elias30012it.github.io/" target="_blank" rel="noopener noreferrer">Abrir com ruas e relevo</a>'
      : "Não deu para carregar o mapa com ruas agora. Mostrando o mapa simplificado.";
    $("#map").appendChild(note);
  }

  async function initMap() {
    if (window.PL_FORCE_SVG || !window.createLeafletMap) return useSvgMap();
    $("#map").innerHTML = '<p class="map-loading">Carregando mapa…</p>';
    try {
      const lm = await window.createLeafletMap($("#map"), TRAILS, {
        diffClass: DIFF_CLASS, onPick: openTrail,
        onFail: (why) => { mapView = null; useSvgMap(why); },
      });
      if (svgStarted) return; // o mapa online falhou enquanto carregava
      mapView = lm;
      syncMap();
    } catch (e) {
      useSvgMap(e.message);
    }
  }

  // ---------- Como chegar: rota dentro do site (OpenStreetMap) ----------
  const MODES = { car: "Carro", bike: "Bicicleta", foot: "A pé" };
  let routeState = null, routeCtrl = null;
  const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${num(Math.round(m / 100) / 10)} km`);
  function fmtTime(s) {
    const min = Math.max(1, Math.round(s / 60));
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), rest = min % 60;
    return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h${rest ? ` ${String(rest).padStart(2, "0")} min` : ""}`;
  }

  function routeHead(t) {
    return `
      <header class="route-head">
        <div><p class="eyebrow">Como chegar</p><h2>${esc(t.name)}</h2><p class="muted">${esc(t.city)}, ${t.uf}</p></div>
        <button class="icon-btn" type="button" data-route-close aria-label="Fechar rota">×</button>
      </header>
      <div class="route-modes" role="group" aria-label="Meio de transporte">${Object.entries(MODES).map(([k, v]) =>
        `<button type="button" class="chip${routeState.mode === k ? " active" : ""}" data-mode="${k}" aria-pressed="${routeState.mode === k}">${v}</button>`).join("")}</div>`;
  }

  function renderRoute(body) {
    const panel = $("#routePanel");
    panel.hidden = false;
    panel.innerHTML = routeHead(routeState.trail) + body;
  }

  function askStart() {
    renderRoute(`
      <p>De onde você vai sair?</p>
      <div class="route-start">
        <button class="btn" type="button" data-route-locate>Usar minha localização</button>
        <form class="route-city" data-route-city>
          <label class="sr-only" for="routeCity">Cidade de saída</label>
          <input id="routeCity" type="search" list="routeCities" placeholder="Ou digite a cidade, ex.: Campinas, SP" autocomplete="off" />
          <datalist id="routeCities"></datalist>
          <button class="btn btn-ghost" type="submit">Traçar</button>
        </form>
      </div>
      <p class="route-msg" hidden></p>`);
  }

  async function computeRoute() {
    const { trail, mode } = routeState;
    routeCtrl?.abort();
    routeCtrl = new AbortController();
    renderRoute(`<p class="route-loading"><span class="spinner" aria-hidden="true"></span> Calculando rota de ${esc(MODES[mode].toLowerCase())} saindo de ${esc(origin.label)}…</p>`);
    try {
      const r = await window.Routing.getRoute(origin, trail, mode, routeCtrl.signal);
      mapView?.showRoute?.(r.line, origin, trail);
      renderRoute(`
        <div class="route-summary">
          <div><strong>${fmtDist(r.distance)}</strong><span>distância</span></div>
          <div><strong>${fmtTime(r.duration)}</strong><span>tempo estimado</span></div>
        </div>
        <p class="route-from">Saindo de <b>${esc(origin.label)}</b> · <button class="link" type="button" data-route-change>trocar</button></p>
        <details class="route-steps">
          <summary>Ver passo a passo (${r.steps.length})</summary>
          <ol>${r.steps.map((s) => `<li><span>${esc(s.text)}</span>${s.last ? "" : `<small>${fmtDist(s.distance)}</small>`}</li>`).join("")}</ol>
        </details>
        <p class="route-credit">Rota calculada pelo OpenStreetMap (OSRM/FOSSGIS). O destino é o ponto da trilha mais próximo de uma estrada ou caminho; confira as condições antes de sair.</p>`);
      $("#map").scrollIntoView({ behavior: window.FX.reduce() ? "auto" : "smooth", block: "start" });
    } catch (e) {
      if (e.name === "AbortError") return;
      const msg = e.code === "NoRoute"
        ? `Não há caminho de ${MODES[mode].toLowerCase()} até essa trilha (pode ser numa ilha ou sem estrada próxima).`
        : IN_PREVIEW
          ? "Esta prévia não acessa sites externos, então não calcula rotas. Abra o site completo para ver o caminho."
          : "O serviço de rotas não respondeu agora. Tente de novo em instantes.";
      renderRoute(`<p class="route-msg error">${esc(msg)}</p>
        <p class="route-from">Saindo de <b>${esc(origin.label)}</b> · <button class="link" type="button" data-route-change>trocar</button> · <button class="link" type="button" data-route-retry>tentar de novo</button></p>`);
    }
  }

  function openRoute(t) {
    routeState = { trail: t, mode: routeState?.mode || "car" };
    location.hash = "#explorar";
    if (origin) computeRoute(); else askStart();
    $("#routePanel").scrollIntoView({ behavior: window.FX.reduce() ? "auto" : "smooth", block: "nearest" });
  }

  function closeRoute() {
    routeCtrl?.abort();
    routeState = null;
    mapView?.clearRoute?.();
    $("#routePanel").hidden = true;
    $("#routePanel").innerHTML = "";
  }

  $("#routePanel").addEventListener("click", (e) => {
    if (e.target.closest("[data-route-close]")) { closeRoute(); return; }
    const m = e.target.closest("[data-mode]");
    if (m && routeState) { routeState.mode = m.dataset.mode; origin ? computeRoute() : askStart(); return; }
    if (e.target.closest("[data-route-change]")) { askStart(); return; }
    if (e.target.closest("[data-route-retry]")) { computeRoute(); return; }
    if (e.target.closest("[data-route-locate]")) {
      const msg = $("#routePanel .route-msg");
      if (!navigator.geolocation) { msg.hidden = false; msg.textContent = "Este navegador não informa a localização. Digite a cidade."; return; }
      msg.hidden = false; msg.textContent = "Obtendo sua localização…";
      navigator.geolocation.getCurrentPosition(
        (p) => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, label: "sua localização" }); computeRoute(); },
        () => { msg.textContent = "Não foi possível acessar sua localização. Digite a cidade."; },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  });
  $("#routePanel").addEventListener("input", (e) => {
    if (e.target.id !== "routeCity") return;
    $("#routeCities").innerHTML = cityMatches(e.target.value, 8).map((c) => `<option value="${esc(c.name)}, ${c.uf}">`).join("");
  });
  $("#routePanel").addEventListener("submit", async (e) => {
    if (!e.target.closest("[data-route-city]")) return;
    e.preventDefault();
    const q = $("#routeCity").value.trim();
    if (!q) return;
    const o = await geocode(q);
    if (!o) { const msg = $("#routePanel .route-msg"); msg.hidden = false; msg.textContent = `Não encontramos “${q}”. Escolha uma cidade da lista.`; return; }
    $("#cityInput").value = o.label;
    setOrigin(o);
    computeRoute();
  });

  // ---------- Agenda ----------
  let eventFilter = "upcoming";
  const byDate = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

  function countdown(iso) {
    const days = Math.round((new Date(iso + "T12:00:00") - new Date(todayISO() + "T12:00:00")) / 864e5);
    if (days < 0) return '<span class="t-count past">realizada</span>';
    const txt = days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
    return `<span class="t-count${days <= 1 ? " soon" : ""}">${txt}</span>`;
  }

  function renderEvents() {
    const today = todayISO();
    const name = me();
    let list = state.events.slice();
    if (eventFilter === "upcoming") list = list.filter((e) => e.date >= today).sort(byDate);
    if (eventFilter === "past") list = list.filter((e) => e.date < today).sort((a, b) => byDate(b, a));
    if (eventFilter === "mine") list = list.filter((e) => name && e.attendees.includes(name)).sort(byDate);

    $("#eventList").innerHTML = list.length ? list.map((e) => {
      const t = trailById[e.trailId];
      if (!t) return "";
      const joined = name && e.attendees.includes(name);
      const full = e.attendees.length >= e.slots;
      const past = e.date < today;
      const isHost = name && e.host === name;
      const left = e.slots - e.attendees.length;
      let action = "";
      if (!past) {
        if (isHost) action = `<button class="btn btn-ghost btn-sm danger" data-act="cancel" data-id="${esc(e.id)}">Cancelar saída</button>`;
        else if (joined) action = `<button class="btn btn-ghost btn-sm" data-act="leave" data-id="${esc(e.id)}">Desistir</button>`;
        else action = `<button class="btn btn-sm" data-act="join" data-id="${esc(e.id)}" ${full ? "disabled" : ""}>${full ? "Lotado" : "Participar"}</button>`;
      }
      return `
      <li class="event${past ? " past" : ""}">
        <div class="ticket">
          <span class="t-week">${fmtDate(e.date, { weekday: "short" }).replace(".", "")}</span>
          <span class="t-day">${fmtDate(e.date, { day: "2-digit" })}</span>
          <span class="t-month">${fmtDate(e.date, { month: "short" }).replace(".", "")}</span>
          <span class="t-time">${esc(e.time)}</span>
          ${countdown(e.date)}
        </div>
        <div class="event-body">
          <p class="eyebrow"><span class="uf-plate sm">${t.uf}</span> ${esc(t.city)}</p>
          <h3><button class="link-title" type="button" data-trail="${t.id}">${esc(t.name)}</button></h3>
          <p class="event-meta"><span class="diff-${DIFF_CLASS[t.difficulty]}"><i class="blaze ${DIFF_CLASS[t.difficulty]}"></i>${t.difficulty}</span><span>${num(t.km)} km</span><span>Encontro: ${esc(e.meet)}</span></p>
          ${e.desc ? `<p class="event-desc">${esc(e.desc)}</p>` : ""}
          <div class="attendees">
            <span class="avatars">${e.attendees.slice(0, 6).map((a) => `<span class="av" title="${esc(a)}">${esc(a[0].toUpperCase())}</span>`).join("")}</span>
            <span class="muted">${e.attendees.length}/${e.slots} confirmados${!past && !full ? ` · ${plural(left, "vaga", "vagas")}` : ""} · organizado por ${esc(e.host)}</span>
          </div>
        </div>
        <div class="event-action">${action}</div>
      </li>`;
    }).join("") : `<li class="empty"><p>${eventFilter === "mine" ? "Você ainda não participa de nenhuma saída." : eventFilter === "past" ? "Nenhuma saída passada." : "Nenhuma saída agendada."}</p></li>`;
  }

  $$(".seg-btn").forEach((b) => b.addEventListener("click", () => {
    $$(".seg-btn").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-selected", x === b); });
    eventFilter = b.dataset.filter;
    renderEvents();
  }));

  $("#eventList").addEventListener("click", (e) => {
    const link = e.target.closest("[data-trail]");
    if (link) { openTrail(link.dataset.trail); return; }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const ev = state.events.find((x) => x.id === btn.dataset.id);
    if (!ev) return;
    requireUser(async () => {
      const name = me();
      if (btn.dataset.act === "join" && !ev.attendees.includes(name) && ev.attendees.length < ev.slots) {
        ev.attendees.push(name); toast("Presença confirmada.");
      } else if (btn.dataset.act === "leave") {
        ev.attendees = ev.attendees.filter((a) => a !== name); toast("Você saiu desta saída.");
      } else if (btn.dataset.act === "cancel") {
        if (!(await ask("Cancelar esta saída? Todos os participantes perdem a vaga.", "Cancelar saída"))) return;
        state.events = state.events.filter((x) => x.id !== ev.id); toast("Saída cancelada.");
      }
      save(); renderAll();
    });
  });

  function openEventForm(trailId) {
    requireUser(() => {
      ensureTrailSelects();
      $("#evTrail").value = trailId || $("#evTrail").value || TRAILS[0].id;
      const min = todayISO();
      $("#evDate").min = min;
      if (!$("#evDate").value || $("#evDate").value < min) $("#evDate").value = min;
      $("#eventDialog").showModal();
    });
  }
  $("#newEventBtn").addEventListener("click", () => openEventForm());

  function rememberTrail(id) {
    const t = trailById[id];
    if (t && t.source === "osm" && !(window.OSM_TRAILS || []).some((x) => x.id === id)) state.knownTrails[id] = t;
  }

  $("#eventForm").addEventListener("submit", () => {
    const name = me();
    rememberTrail($("#evTrail").value);
    state.events.push({
      id: uid(),
      trailId: $("#evTrail").value,
      date: $("#evDate").value,
      time: $("#evTime").value,
      slots: Math.min(50, Math.max(2, Math.round(+$("#evSlots").value) || 2)),
      meet: $("#evMeet").value.trim().slice(0, 120),
      desc: $("#evDesc").value.trim().slice(0, 500),
      host: name,
      attendees: [name],
    });
    save();
    $("#eventForm").reset();
    $("#evTime").value = "07:00"; $("#evSlots").value = 10;
    toast("Trilha agendada. Convide a galera na Comunidade.");
    location.hash = "#agenda";
    renderAll();
  });

  // ---------- Comunidade ----------
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    const d = Math.floor(s / 86400);
    return `há ${plural(d, "dia", "dias")}`;
  }

  let justLiked = null;
  function renderFeed() {
    const name = me();
    $("#feed").innerHTML = state.posts.slice().sort((a, b) => b.at - a.at).map((p) => {
      const t = p.trailId ? trailById[p.trailId] : null;
      const liked = name && p.likes.includes(name);
      return `
      <li class="post" data-id="${esc(p.id)}">
        <div class="post-head">
          <span class="av">${esc(p.author[0].toUpperCase())}</span>
          <div class="post-who">
            <strong>${esc(p.author)}</strong>
            <span class="muted">${timeAgo(p.at)}</span>
          </div>
          ${name === p.author ? `<button class="link danger" data-act="del">Excluir</button>` : ""}
        </div>
        ${t ? `<button class="trail-tag" type="button" data-trail="${t.id}"><i class="blaze ${DIFF_CLASS[t.difficulty]}"></i>${esc(t.name)} · ${esc(t.city)}, ${t.uf}</button>` : ""}
        <p class="post-text">${esc(p.text)}</p>
        <div class="post-actions">
          <button class="link like${liked ? " liked" : ""}${liked && p.id === justLiked ? " pop" : ""}" data-act="like" aria-pressed="${!!liked}">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.3 4.3 2.5h2c.7-1.2 2.1-2.5 4.3-2.5 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21Z" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
            ${p.likes.length}
          </button>
          <span class="muted">${plural(p.comments.length, "comentário", "comentários")}</span>
        </div>
        ${p.comments.length ? `<ul class="comments">${p.comments.map((c) => `<li><strong>${esc(c.author)}</strong> ${esc(c.text)} <span class="muted">· ${timeAgo(c.at)}</span></li>`).join("")}</ul>` : ""}
        <form class="comment-form">
          <input type="text" placeholder="Escreva um comentário" maxlength="300" required aria-label="Comentário" />
          <button class="btn btn-sm" type="submit">Enviar</button>
        </form>
      </li>`;
    }).join("") || '<li class="empty"><p>Nenhuma publicação ainda.</p></li>';
  }

  ["focus", "pointerdown"].forEach((ev) => $("#postTrail").addEventListener(ev, ensureTrailSelects));

  $("#postForm").addEventListener("submit", (e) => {
    e.preventDefault();
    requireUser(() => {
      const text = $("#postText").value.trim().slice(0, 1000);
      if (!text) return;
      rememberTrail($("#postTrail").value);
      state.posts.push({ id: uid(), author: me(), trailId: $("#postTrail").value, text, at: Date.now(), likes: [], comments: [] });
      save();
      $("#postForm").reset();
      renderFeed();
      toast("Publicado.");
    });
  });

  $("#feed").addEventListener("click", (e) => {
    const link = e.target.closest("[data-trail]");
    if (link) { openTrail(link.dataset.trail); return; }
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const post = state.posts.find((p) => p.id === btn.closest(".post").dataset.id);
    if (!post) return;
    requireUser(async () => {
      const name = me();
      if (btn.dataset.act === "like") {
        post.likes = post.likes.includes(name) ? post.likes.filter((x) => x !== name) : [...post.likes, name];
        justLiked = post.id;
      } else if (btn.dataset.act === "del" && post.author === name) {
        if (!(await ask("Excluir esta publicação?", "Excluir"))) return;
        state.posts = state.posts.filter((p) => p !== post);
        toast("Publicação excluída.");
      }
      save(); renderFeed();
    });
  });

  $("#feed").addEventListener("submit", (e) => {
    const form = e.target.closest(".comment-form");
    if (!form) return;
    e.preventDefault();
    const input = $("input", form);
    const post = state.posts.find((p) => p.id === form.closest(".post").dataset.id);
    if (!post) return;
    requireUser(() => {
      const text = input.value.trim().slice(0, 300);
      if (!text) return;
      post.comments.push({ author: me(), text, at: Date.now() });
      save(); renderFeed();
    });
  });

  // ---------- Loja ----------
  const PRODUCTS = window.SHOP_PRODUCTS;
  const productById = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const RULES = window.SHOP_RULES;
  // produtos que saíram do catálogo não ficam no carrinho
  state.cart = state.cart.filter((i) => productById[i.id]);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // Ilustrações cartoon (js/shop-art.js); os brilhinhos só aparecem na vitrine.
  const icon = (p, size = 64, sparks = false) => `<svg class="toon" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true"><g stroke="${window.SHOP_ART_INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${window.SHOP_ART[p.icon]}${sparks ? window.SHOP_SPARKS : ""}</g></svg>`;
  const TONE = { "Vestuário": "bark", "Calçados": "bark", "Mochilas": "bark" };
  let shopCat = "", checkoutTotals = null;

  const cartQty = () => state.cart.reduce((n, i) => n + i.qty, 0);
  const subtotal = () => state.cart.reduce((n, i) => n + productById[i.id].price * i.qty, 0);
  const shippingFor = (sub, optId) => (sub >= RULES.freeShippingFrom ? 0 : RULES.shipping.find((s) => s.id === optId).price);
  const installments = (v) => (v >= RULES.installmentsFrom ? `ou ${RULES.maxInstallments}x de ${brl(v / RULES.maxInstallments)} sem juros` : "à vista");

  function renderCartBadge() {
    const n = cartQty();
    $("#cartCount").hidden = !n;
    $("#cartCount").textContent = n;
    $("#cartBtn").setAttribute("aria-label", n ? `Carrinho, ${plural(n, "item", "itens")}` : "Carrinho vazio");
  }

  function addToCart(id, qty = 1) {
    const item = state.cart.find((i) => i.id === id);
    if (item) item.qty = Math.min(10, item.qty + qty);
    else state.cart.push({ id, qty });
    save(); renderCartBadge();
    if (!$("#cartDialog").open) toast(`${productById[id].name} no carrinho.`);
    else renderCart();
  }

  function renderShop() {
    const cats = [...new Set(PRODUCTS.map((p) => p.cat))];
    $("#shopCats").innerHTML = ["", ...cats].map((c) => `<button type="button" class="chip${c === shopCat ? " active" : ""}" data-cat="${esc(c)}" aria-pressed="${c === shopCat}">${c || "Tudo"}</button>`).join("");
    let list = PRODUCTS.filter((p) => !shopCat || p.cat === shopCat);
    const sort = $("#shopSort").value;
    if (sort === "asc") list = list.slice().sort((a, b) => a.price - b.price);
    if (sort === "desc") list = list.slice().sort((a, b) => b.price - a.price);
    $("#productGrid").innerHTML = list.map((p) => {
      const inCart = state.cart.find((i) => i.id === p.id)?.qty || 0;
      return `
      <li class="product">
        <div class="product-art ${TONE[p.cat] || "leaf"}">${icon(p, 128, true)}</div>
        <div class="product-body">
          <p class="eyebrow">${esc(p.cat)}</p>
          <h3>${esc(p.name)}</h3>
          <p class="product-desc">${esc(p.desc)}</p>
          <ul class="specs">${p.specs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          <div class="price-row">
            <div class="price-box"><span class="price">${brl(p.price)}</span><span class="installments">${installments(p.price)}</span></div>
            <button class="btn btn-sm" type="button" data-add="${p.id}">${inCart ? `No carrinho (${inCart})` : "Adicionar"}</button>
          </div>
        </div>
      </li>`;
    }).join("");
  }

  $("#shopCats").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    shopCat = b.dataset.cat;
    renderShop();
  });
  $("#shopSort").addEventListener("change", renderShop);
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      const p = productById[add.dataset.add];
      const from = add.closest(".product")?.querySelector(".product-art") || add;
      window.FX.flyTo(from, $("#cartBtn"), icon(p, 38));
      addToCart(add.dataset.add); renderShop(); return;
    }
    if (e.target.closest("[data-open-cart]")) openCart();
  });
  $("#cartBtn").addEventListener("click", () => openCart());

  function openCart() {
    renderCart();
    if (!$("#cartDialog").open) $("#cartDialog").showModal();
  }

  function renderCart() {
    const dlg = $("#cartDialog");
    const sub = subtotal();
    const missing = RULES.freeShippingFrom - sub;
    const orders = state.orders.slice().reverse();
    dlg.innerHTML = `
      <div class="drawer-inner">
        <header class="drawer-head">
          <h2 id="cartTitle">Carrinho</h2>
          <button class="icon-btn" type="button" data-close-cart aria-label="Fechar carrinho">×</button>
        </header>
        ${state.cart.length ? `
          <ul class="cart-list">${state.cart.map((i) => {
            const p = productById[i.id];
            return `
            <li class="cart-item" data-id="${p.id}">
              <span class="cart-art ${TONE[p.cat] || "leaf"}">${icon(p, 46)}</span>
              <span class="cart-info"><b>${esc(p.name)}</b><span class="muted">${brl(p.price)}</span></span>
              <span class="stepper" role="group" aria-label="Quantidade">
                <button type="button" data-qty="-1" aria-label="Diminuir">−</button><output>${i.qty}</output><button type="button" data-qty="1" aria-label="Aumentar">+</button>
              </span>
              <span class="cart-line">${brl(p.price * i.qty)}</span>
              <button class="link danger small" type="button" data-remove>Remover</button>
            </li>`;
          }).join("")}</ul>
          <div class="ship-meter">
            ${missing > 0 ? `<p>Faltam <b>${brl(missing)}</b> para o frete grátis.</p>` : "<p><b>Frete grátis</b> neste pedido.</p>"}
            <div class="meter"><span style="width:${Math.min(100, (sub / RULES.freeShippingFrom) * 100)}%"></span></div>
          </div>
          <dl class="totals">
            <div><dt>Subtotal</dt><dd>${brl(sub)}</dd></div>
            <div><dt>Frete</dt><dd>${missing > 0 ? `a partir de ${brl(RULES.shipping[0].price)}` : "Grátis"}</dd></div>
          </dl>
          <div class="actions">
            <button class="btn btn-ghost" type="button" data-close-cart>Continuar comprando</button>
            <button class="btn" type="button" data-checkout>Finalizar pedido</button>
          </div>`
        : `<div class="empty"><p>Seu carrinho está vazio.</p><p><a href="#loja" data-close-cart>Ver equipamentos</a></p></div>`}
        ${orders.length ? `
          <section class="orders">
            <h3>Seus pedidos</h3>
            <ul>${orders.map((o) => `<li><b>${esc(o.id)}</b> · ${new Date(o.at).toLocaleDateString("pt-BR")} · ${plural(o.items.reduce((n, i) => n + i.qty, 0), "item", "itens")} · ${brl(o.total)} <span class="tag-reserva">Reserva · ${esc(o.payment)}</span></li>`).join("")}</ul>
          </section>` : ""}
      </div>`;
  }

  $("#cartDialog").addEventListener("click", (e) => {
    const dlg = $("#cartDialog");
    if (e.target === dlg || e.target.closest("[data-close-cart]")) { dlg.close(); return; }
    if (e.target.closest("[data-checkout]")) { dlg.close(); openCheckout(); return; }
    const row = e.target.closest(".cart-item");
    if (!row) return;
    const item = state.cart.find((i) => i.id === row.dataset.id);
    if (!item) return;
    const step = e.target.closest("[data-qty]");
    if (step) item.qty = Math.max(1, Math.min(10, item.qty + +step.dataset.qty));
    if (e.target.closest("[data-remove]")) state.cart = state.cart.filter((i) => i !== item);
    save(); renderCart(); renderCartBadge(); renderShop();
  });

  function updateCheckoutSummary() {
    const sub = subtotal();
    const opt = $('input[name="ship"]:checked')?.value || RULES.shipping[0].id;
    const ship = shippingFor(sub, opt);
    const total = sub + ship;
    checkoutTotals = { sub, ship, total, opt };
    $("#coInstallments").textContent = total >= RULES.installmentsFrom ? `Até ${RULES.maxInstallments}x de ${brl(total / RULES.maxInstallments)} sem juros` : "À vista";
    $("#coSummary").innerHTML = `
      <ul>${state.cart.map((i) => `<li><span>${i.qty}× ${esc(productById[i.id].name)}</span><span>${brl(productById[i.id].price * i.qty)}</span></li>`).join("")}</ul>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${brl(sub)}</dd></div>
        <div><dt>Frete</dt><dd>${ship ? brl(ship) : "Grátis"}</dd></div>
        <div class="grand"><dt>Total</dt><dd>${brl(total)}</dd></div>
      </dl>`;
  }

  function openCheckout() {
    if (!state.cart.length) return;
    const sub = subtotal();
    $("#coShipping").innerHTML = RULES.shipping.map((s, i) => `
      <label class="radio"><input type="radio" name="ship" value="${s.id}" ${i === 0 ? "checked" : ""} />
        <span><b>${s.label}</b><small>${s.days}</small></span>
        <span class="radio-price">${sub >= RULES.freeShippingFrom ? "Grátis" : brl(s.price)}</span></label>`).join("");
    if (!$("#coName").value && state.user?.name) $("#coName").value = state.user.name;
    if (!$("#coCity").value && state.user?.city) $("#coCity").value = state.user.city;
    updateCheckoutSummary();
    $("#checkoutDialog").showModal();
  }

  $("#coShipping").addEventListener("change", updateCheckoutSummary);
  $("#coCep").addEventListener("input", (e) => {
    const d = e.target.value.replace(/\D/g, "").slice(0, 8);
    e.target.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  });

  $("#checkoutForm").addEventListener("submit", () => {
    if (!state.cart.length) { renderCartBadge(); toast("Seu carrinho está vazio."); return; }
    updateCheckoutSummary();
    const t = checkoutTotals;
    const order = {
      id: "PL-" + String(Date.now()).slice(-6),
      at: Date.now(),
      items: state.cart.map((i) => ({ ...i, price: productById[i.id].price })),
      subtotal: t.sub, shipping: t.ship, total: t.total,
      delivery: RULES.shipping.find((s) => s.id === t.opt).label,
      payment: $('input[name="pay"]:checked').value,
      name: $("#coName").value.trim(), city: $("#coCity").value.trim(),
    };
    state.orders.push(order);
    state.cart = [];
    save(); renderCartBadge(); renderShop();
    $("#orderDialog").innerHTML = `
      <div class="form">
        <p class="eyebrow">Pedido ${order.id}</p>
        <h2>Pedido registrado</h2>
        <p>${esc(order.name.split(" ")[0])}, sua reserva de ${plural(order.items.reduce((n, i) => n + i.qty, 0), "item", "itens")} no valor de <b>${brl(order.total)}</b> foi registrada, com entrega ${esc(order.delivery.toLowerCase())} para ${esc(order.city)}.</p>
        <p class="notice">Pagamento escolhido: ${esc(order.payment)}. A loja ainda não cobra online, então nada foi cobrado. O pedido fica salvo em "Seus pedidos", no carrinho.</p>
        <div class="actions"><button class="btn" type="button" data-close>Fechar</button></div>
      </div>`;
    $("[data-close]", $("#orderDialog")).addEventListener("click", () => $("#orderDialog").close());
    $("#orderDialog").showModal();
  });

  function trailGear(t) {
    const ids = window.SHOP_FOR_DIFFICULTY[t.difficulty] || [];
    if (!ids.length) return "";
    return `
      <h3>Para levar nesta trilha</h3>
      <ul class="gear">${ids.map((id) => { const p = productById[id]; return `
        <li><span class="cart-art ${TONE[p.cat] || "leaf"}">${icon(p, 40)}</span><span class="cart-info"><b>${esc(p.name)}</b><span class="muted">${brl(p.price)}</span></span>
        <button class="btn btn-ghost btn-sm" type="button" data-add="${p.id}">Adicionar</button></li>`; }).join("")}
      </ul>`;
  }

  // ---------- Início ----------
  let selectsReady = false;
  function fillTrailSelects() { selectsReady = false; }
  function ensureTrailSelects() {
    if (selectsReady) return;
    selectsReady = true;
    const groups = {};
    TRAILS.forEach((t) => { (groups[t.uf] = groups[t.uf] || []).push(t); });
    const opts = Object.keys(groups).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b])).map((uf) =>
      `<optgroup label="${esc(STATE_NAMES[uf])}">${groups[uf].slice().sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => `<option value="${t.id}">${esc(t.name)} — ${esc(t.city)}</option>`).join("")}</optgroup>`).join("");
    for (const [sel, first] of [["#evTrail", ""], ["#postTrail", '<option value="">Marcar uma trilha (opcional)</option>']]) {
      const v = $(sel).value;
      $(sel).innerHTML = first + opts;
      if (v) $(sel).value = v;
    }
  }

  function fillSelects() {
    fillTrailSelects();
    fillStateFilter();
    fillCityFilter();
  }

  if (window.OSM_TRAILS_DATE) {
    const d = new Date(window.OSM_TRAILS_DATE);
    if (!isNaN(d)) $(".footer p").insertAdjacentHTML("beforeend", ` Trilhas do OpenStreetMap atualizadas em ${d.toLocaleDateString("pt-BR")}.`);
  }

  window.addEventListener("resize", () => window.FX.tabIndicator($(".tabs")));

  function renderAll() { renderHero(); renderStats(); renderTrails(); renderEvents(); renderFeed(); renderShop(); renderCartBadge(); }

  fillSelects();
  initMap();
  renderProfileBtn();
  renderAll();
  route();
})();
