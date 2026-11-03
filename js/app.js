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
  const curated = window.TRAILS.map((t) => ({ ...t, source: "curadoria" }));
  const osm = (window.OSM_TRAILS || [])
    .filter((o) => !curated.some((c) => hav(c, o) < 2 && words(c.name).some((w) => words(o.name).includes(w))))
    .map((o) => ({ elevation: null, desc: "", tags: [], ...o, source: "osm" }));
  const TRAILS = curated.concat(osm);
  const trailById = Object.fromEntries(TRAILS.map((t) => [t.id, t]));
  const STATE_NAMES = Object.fromEntries(window.BRAZIL_GEO.states.map((s) => [s.uf, s.name]));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const DIFF_CLASS = { "Fácil": "easy", "Moderada": "medium", "Difícil": "hard" };

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
  const VIEWS = ["explorar", "agenda", "comunidade"];
  function route() {
    const tab = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "explorar";
    VIEWS.forEach((v) => { $(`#view-${v}`).hidden = v !== tab; });
    $$(".tabs a").forEach((a) => a.toggleAttribute("aria-current", a.dataset.tab === tab));
    if (tab === "explorar") setTimeout(() => mapView?.refresh(), 0);
  }
  window.addEventListener("hashchange", route);

  // ---------- Geografia ----------
  const distanceKm = hav;

  // Municípios do IBGE: "nome|UF|lat|lng|capital;..."
  const CITIES = window.MUNICIPIOS.split(";").map((r) => {
    const [name, uf, lat, lng, cap] = r.split("|");
    return { name, uf, lat: +lat, lng: +lng, capital: cap === "1", key: norm(name), full: norm(`${name}, ${uf}`) };
  });
  const cleanQuery = (q) => norm(q).replace(/\s*[-–\/]\s*([a-z]{2})$/, ", $1");

  function cityMatches(query, limit = 12) {
    const q = cleanQuery(query);
    if (!q) return CITIES.filter((c) => c.capital).slice(0, limit);
    const starts = [], contains = [];
    for (const c of CITIES) {
      if (c.full.startsWith(q) || c.key.startsWith(q)) starts.push(c);
      else if (c.key.includes(q)) contains.push(c);
    }
    const rank = (a, b) => (b.capital - a.capital) || a.name.length - b.name.length;
    return starts.sort(rank).concat(contains.sort(rank)).slice(0, limit);
  }

  function localCity(query) {
    const q = cleanQuery(query);
    const hit = CITIES.find((c) => c.full === q) || cityMatches(query, 1)[0];
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
    }).sort(origin ? (a, b) => a.near - b.near : (a, b) => STATE_NAMES[a.uf].localeCompare(STATE_NAMES[b.uf]));
  }

  function trailRow(t) {
    const n = upcomingCount(t.id);
    return `
      <li>
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

  function stateOverview(list) {
    const cities = {}, counts = {};
    list.forEach((t) => {
      counts[t.uf] = (counts[t.uf] || 0) + 1;
      (cities[t.uf] = cities[t.uf] || new Set()).add(t.city);
    });
    return `
      <section class="state-group overview">
        <header class="state-head"><h2>Escolha um estado</h2><span class="state-count">ou clique no mapa</span></header>
        <ul class="overview-list">${Object.keys(counts).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b])).map((uf) => `
          <li><button class="overview-item" type="button" data-uf="${uf}">
            <span class="uf-plate">${uf}</span>
            <span class="trail-main"><span class="trail-name">${esc(STATE_NAMES[uf])}</span><span class="trail-meta"><span>${plural(counts[uf], "trilha", "trilhas")}</span><span>${plural(cities[uf].size, "cidade", "cidades")}</span></span></span>
          </button></li>`).join("")}
        </ul>
      </section>`;
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

    const overview = list.length > PAGE && !filtered;
    let budget = shown;
    const groups = overview ? [] : groupTrails(list).map((g) => {
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
      : overview ? stateOverview(list)
      : groups.map((g) => `
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
      + (!overview && rest > 0 ? `<button id="moreTrails" class="btn btn-ghost more" type="button">Mostrar mais ${num(Math.min(PAGE, rest))} (faltam ${num(rest)})</button>` : "");

    mapView?.setVisible(new Set(list.map((t) => t.id)));
  }

  function renderStats() {
    const ufs = new Set(TRAILS.map((t) => t.uf)).size;
    const cities = new Set(TRAILS.map((t) => `${t.city}|${t.uf}`)).size;
    const upcoming = state.events.filter((e) => e.date >= todayISO()).length;
    $("#catalogStats").innerHTML = `<span><b>${num(TRAILS.length)}</b> trilhas</span><span><b>${num(cities)}</b> cidades</span><span><b>${ufs}</b> estados</span><span><b>${upcoming}</b> saídas agendadas</span>`;
  }

  function setOrigin(o) {
    origin = o;
    $("#locStatus").textContent = `Ordenando por distância a partir de ${o.label}.`;
    mapView?.setOrigin(o, +$("#radius").value);
    renderTrails();
  }

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
    const q = $("#cityInput").value.trim();
    if (!q) return;
    $("#locStatus").textContent = "Buscando…";
    const o = await geocode(q);
    if (o) setOrigin(o);
    else $("#locStatus").textContent = `Não encontramos “${q}”. Escolha uma cidade da lista de sugestões.`;
  });

  $("#cityInput").addEventListener("input", () => {
    $("#cityList").innerHTML = cityMatches($("#cityInput").value).map((c) => `<option value="${esc(c.name)}, ${c.uf}">`).join("");
  });

  $("#radius").addEventListener("input", () => {
    if (origin) mapView?.setRadius(+$("#radius").value);
    renderTrails();
  });
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
    initMap();
    setStateFilter("");
  });

  $("#trailGroups").addEventListener("click", (e) => {
    const b = e.target.closest(".trail");
    if (b) { openTrail(b.dataset.id); return; }
    const st = e.target.closest(".overview-item");
    if (st) { setStateFilter(st.dataset.uf); return; }
    if (e.target.closest("#moreTrails")) { shown += PAGE; renderTrails(false); }
  });

  function openTrail(id) {
    const t = trailById[id];
    const today = todayISO();
    const evs = state.events.filter((e) => e.trailId === id && e.date >= today).sort(byDate);
    const dist = origin ? `<span>${num(Math.round(distanceKm(origin, t)))} km de ${esc(origin.label)}</span>` : "";
    const dlg = $("#trailDialog");
    dlg.innerHTML = `
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
        ${t.source === "osm" ? `<p class="source-note">Traçado mapeado por voluntários no <a href="https://www.openstreetmap.org/${t.osm}" target="_blank" rel="noopener">OpenStreetMap</a>.${t.diffEstimated ? " Dificuldade estimada pela distância." : ""}${t.operator ? ` Gestão: ${esc(t.operator)}.` : ""} Confira as condições antes de ir.</p>` : ""}
        <h3>Próximas saídas</h3>
        ${evs.length ? `<ul class="mini-events">${evs.map((e) => `<li><b>${fmtDate(e.date)}</b> às ${esc(e.time)} · ${e.attendees.length}/${e.slots} pessoas · com ${esc(e.host)}</li>`).join("")}</ul>` : '<p class="muted">Nenhuma saída agendada. Agende a primeira.</p>'}
        <div class="actions">
          <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}">Como chegar</a>
          <button class="btn btn-ghost" type="button" data-close>Fechar</button>
          <button class="btn" type="button" data-schedule>Agendar esta trilha</button>
        </div>
      </div>`;
    $("[data-close]", dlg).addEventListener("click", () => dlg.close());
    $("[data-schedule]", dlg).addEventListener("click", () => { dlg.close(); openEventForm(id); });
    dlg.showModal();
  }

  function initMap() {
    mapView = window.createSvgMap($("#map"), TRAILS, {
      diffClass: DIFF_CLASS,
      onPick: openTrail,
      onState: (uf) => setStateFilter($("#stateFilter").value === uf ? "" : uf),
    });
  }

  // ---------- Agenda ----------
  let eventFilter = "upcoming";
  const byDate = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

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
        if (isHost) action = `<button class="btn btn-ghost btn-sm danger" data-act="cancel" data-id="${e.id}">Cancelar saída</button>`;
        else if (joined) action = `<button class="btn btn-ghost btn-sm" data-act="leave" data-id="${e.id}">Desistir</button>`;
        else action = `<button class="btn btn-sm" data-act="join" data-id="${e.id}" ${full ? "disabled" : ""}>${full ? "Lotado" : "Participar"}</button>`;
      }
      return `
      <li class="event${past ? " past" : ""}">
        <div class="ticket">
          <span class="t-week">${fmtDate(e.date, { weekday: "short" }).replace(".", "")}</span>
          <span class="t-day">${fmtDate(e.date, { day: "2-digit" })}</span>
          <span class="t-month">${fmtDate(e.date, { month: "short" }).replace(".", "")}</span>
          <span class="t-time">${esc(e.time)}</span>
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
      $("#evTrail").value = trailId || $("#evTrail").value || TRAILS[0].id;
      const min = todayISO();
      $("#evDate").min = min;
      if (!$("#evDate").value || $("#evDate").value < min) $("#evDate").value = min;
      $("#eventDialog").showModal();
    });
  }
  $("#newEventBtn").addEventListener("click", () => openEventForm());

  $("#eventForm").addEventListener("submit", () => {
    const name = me();
    state.events.push({
      id: uid(),
      trailId: $("#evTrail").value,
      date: $("#evDate").value,
      time: $("#evTime").value,
      slots: Math.max(2, +$("#evSlots").value || 2),
      meet: $("#evMeet").value.trim(),
      desc: $("#evDesc").value.trim(),
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

  function renderFeed() {
    const name = me();
    $("#feed").innerHTML = state.posts.slice().sort((a, b) => b.at - a.at).map((p) => {
      const t = p.trailId ? trailById[p.trailId] : null;
      const liked = name && p.likes.includes(name);
      return `
      <li class="post" data-id="${p.id}">
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
          <button class="link like${liked ? " liked" : ""}" data-act="like" aria-pressed="${!!liked}">
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

  $("#postForm").addEventListener("submit", (e) => {
    e.preventDefault();
    requireUser(() => {
      const text = $("#postText").value.trim();
      if (!text) return;
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
    requireUser(async () => {
      const name = me();
      if (btn.dataset.act === "like") {
        post.likes = post.likes.includes(name) ? post.likes.filter((x) => x !== name) : [...post.likes, name];
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
    requireUser(() => {
      const text = input.value.trim();
      if (!text) return;
      post.comments.push({ author: me(), text, at: Date.now() });
      save(); renderFeed();
    });
  });

  // ---------- Início ----------
  function fillSelects() {
    const groups = {};
    TRAILS.forEach((t) => { (groups[t.uf] = groups[t.uf] || []).push(t); });
    const opts = Object.keys(groups).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b])).map((uf) =>
      `<optgroup label="${esc(STATE_NAMES[uf])}">${groups[uf].sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => `<option value="${t.id}">${esc(t.name)} — ${esc(t.city)}</option>`).join("")}</optgroup>`).join("");
    $("#evTrail").innerHTML = opts;
    $("#postTrail").insertAdjacentHTML("beforeend", opts);
    $("#cityList").innerHTML = cityMatches("").map((c) => `<option value="${esc(c.name)}, ${c.uf}">`).join("");
    fillStateFilter();
    fillCityFilter();
  }

  function renderAll() { renderStats(); renderTrails(); renderEvents(); renderFeed(); }

  fillSelects();
  initMap();
  renderProfileBtn();
  renderAll();
  route();
})();
