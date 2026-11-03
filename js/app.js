(function () {
  const { state, save, uid } = window.Store;
  const TRAILS = window.TRAILS;
  const trailById = Object.fromEntries(TRAILS.map((t) => [t.id, t]));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- Usuário ----------
  function me() { return state.user?.name || null; }

  function renderProfileBtn() {
    const name = me();
    $("#profileBtn").textContent = name ? name.slice(0, 1).toUpperCase() : "Entrar";
    $("#profileBtn").classList.toggle("avatar", !!name);
    $("#profileBtn").title = name ? `${name} — editar perfil` : "Criar perfil";
  }

  function requireUser(then) {
    if (me()) return then();
    openProfile(then);
  }

  let afterProfile = null;
  function openProfile(cb) {
    afterProfile = cb || null;
    $("#pfName").value = state.user?.name || "";
    $("#pfCity").value = state.user?.city || "";
    $("#profileDialog").showModal();
  }

  $("#profileBtn").addEventListener("click", () => openProfile());
  $("#profileForm").addEventListener("submit", (e) => {
    const name = $("#pfName").value.trim();
    if (!name) { e.preventDefault(); return; }
    state.user = { name, city: $("#pfCity").value.trim() };
    save();
    renderProfileBtn();
    renderAll();
    toast(`Bem-vindo(a), ${name}!`);
    const cb = afterProfile; afterProfile = null;
    if (cb) setTimeout(cb, 0);
  });

  $$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

  // ---------- Roteamento por abas ----------
  const VIEWS = ["explorar", "agenda", "comunidade"];
  function route() {
    const tab = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "explorar";
    VIEWS.forEach((v) => { $(`#view-${v}`).hidden = v !== tab; });
    $$(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    if (tab === "explorar" && map) setTimeout(() => map.invalidateSize(), 0);
  }
  window.addEventListener("hashchange", route);

  // ---------- Geografia ----------
  function distanceKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  async function geocode(query) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const [hit] = await res.json();
        if (hit) return { lat: +hit.lat, lng: +hit.lon, label: hit.display_name.split(",").slice(0, 2).join(",") };
      }
    } catch (_) { /* offline: usa fallback */ }
    const key = Object.keys(window.CITIES).find((c) => norm(query).includes(c));
    if (key) { const [lat, lng] = window.CITIES[key]; return { lat, lng, label: query }; }
    return null;
  }

  // ---------- Explorar ----------
  let origin = null; // {lat,lng,label}
  let map = null, markers = {}, originMarker = null, radiusCircle = null;

  const DIFF_CLASS = { "Fácil": "easy", "Moderada": "medium", "Difícil": "hard" };

  function initMap() {
    if (!window.L) { $("#map").innerHTML = '<p class="muted pad">Mapa indisponível (sem conexão).</p>'; return; }
    map = L.map("map", { scrollWheelZoom: false }).setView([-20.5, -46], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    TRAILS.forEach((t) => {
      const m = L.circleMarker([t.lat, t.lng], { radius: 8, weight: 2, className: `pin pin-${DIFF_CLASS[t.difficulty]}` })
        .addTo(map)
        .bindTooltip(t.name);
      m.on("click", () => openTrail(t.id));
      markers[t.id] = m;
    });
  }

  function filteredTrails() {
    const radius = +$("#radius").value;
    const diff = $("#difficulty").value;
    const q = norm($("#nameFilter").value);
    return TRAILS
      .map((t) => ({ ...t, dist: origin ? distanceKm(origin, t) : null }))
      .filter((t) => !diff || t.difficulty === diff)
      .filter((t) => !q || norm(`${t.name} ${t.city} ${t.tags.join(" ")}`).includes(q))
      .filter((t) => !origin || t.dist <= radius)
      .sort((a, b) => (origin ? a.dist - b.dist : a.name.localeCompare(b.name)));
  }

  function upcomingCount(trailId) {
    const today = new Date().toISOString().slice(0, 10);
    return state.events.filter((e) => e.trailId === trailId && e.date >= today).length;
  }

  function renderTrails() {
    const list = filteredTrails();
    const ids = new Set(list.map((t) => t.id));
    $("#radiusLabel").textContent = `${$("#radius").value} km`;
    $("#resultCount").textContent = origin
      ? `${list.length} trilha(s) até ${$("#radius").value} km de ${origin.label}`
      : `${list.length} trilha(s) — defina sua localização para ordenar por distância`;

    $("#trailList").innerHTML = list.length ? list.map((t) => {
      const n = upcomingCount(t.id);
      return `
      <li class="trail card" data-id="${t.id}" tabindex="0">
        <div class="trail-top">
          <h3>${esc(t.name)}</h3>
          <span class="badge ${DIFF_CLASS[t.difficulty]}">${t.difficulty}</span>
        </div>
        <p class="muted small">${esc(t.city)}${t.dist != null ? ` · <strong>${t.dist.toFixed(0)} km de você</strong>` : ""}</p>
        <p class="stats small">🥾 ${t.km} km · ⛰️ ${t.elevation} m · ⏱️ ${t.hours} h${n ? ` · <span class="accent">📅 ${n} saída(s) agendada(s)</span>` : ""}</p>
      </li>`;
    }).join("") : '<li class="empty">Nenhuma trilha encontrada. Aumente o raio ou mude os filtros.</li>';

    if (map) {
      Object.entries(markers).forEach(([id, m]) => {
        if (ids.has(id)) { if (!map.hasLayer(m)) m.addTo(map); } else m.remove();
      });
    }
  }

  function setOrigin(o) {
    origin = o;
    $("#locStatus").textContent = `📍 ${o.label}`;
    if (map) {
      originMarker?.remove(); radiusCircle?.remove();
      originMarker = L.marker([o.lat, o.lng]).addTo(map).bindTooltip("Você está aqui");
      radiusCircle = L.circle([o.lat, o.lng], { radius: +$("#radius").value * 1000, className: "radius" }).addTo(map);
      map.fitBounds(radiusCircle.getBounds(), { maxZoom: 11 });
    }
    renderTrails();
  }

  $("#locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) { toast("Seu navegador não suporta geolocalização."); return; }
    $("#locStatus").textContent = "Obtendo sua localização…";
    navigator.geolocation.getCurrentPosition(
      (p) => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, label: "sua localização" }),
      () => { $("#locStatus").textContent = "Não foi possível obter sua localização. Busque por cidade."; },
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
    else $("#locStatus").textContent = `Não encontramos “${q}”. Tente outra cidade.`;
  });

  $("#radius").addEventListener("input", () => {
    if (radiusCircle) radiusCircle.setRadius(+$("#radius").value * 1000);
    renderTrails();
  });
  $("#difficulty").addEventListener("change", renderTrails);
  $("#nameFilter").addEventListener("input", renderTrails);

  $("#trailList").addEventListener("click", (e) => {
    const li = e.target.closest(".trail");
    if (li) openTrail(li.dataset.id);
  });
  $("#trailList").addEventListener("keydown", (e) => {
    const li = e.target.closest(".trail");
    if (li && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openTrail(li.dataset.id); }
  });

  function openTrail(id) {
    const t = trailById[id];
    const today = new Date().toISOString().slice(0, 10);
    const evs = state.events.filter((e) => e.trailId === id && e.date >= today).sort(byDate);
    const dist = origin ? ` · ${distanceKm(origin, t).toFixed(0)} km de você` : "";
    const dlg = $("#trailDialog");
    dlg.innerHTML = `
      <div class="form">
        <div class="trail-top"><h2>${esc(t.name)}</h2><span class="badge ${DIFF_CLASS[t.difficulty]}">${t.difficulty}</span></div>
        <p class="muted">${esc(t.city)}${dist}</p>
        <p>${esc(t.desc)}</p>
        <div class="facts">
          <div><strong>${t.km} km</strong><span>distância</span></div>
          <div><strong>${t.elevation} m</strong><span>ganho de elevação</span></div>
          <div><strong>${t.hours} h</strong><span>duração média</span></div>
        </div>
        <p class="tags">${t.tags.map((x) => `<span>#${esc(x)}</span>`).join(" ")}</p>
        <h3>Próximas saídas</h3>
        ${evs.length ? `<ul class="mini-events">${evs.map((e) => `<li>📅 ${fmtDate(e.date)} às ${e.time} · ${e.attendees.length}/${e.slots} pessoas · por ${esc(e.host)}</li>`).join("")}</ul>` : '<p class="muted small">Nenhuma saída agendada ainda. Que tal ser o primeiro?</p>'}
        <div class="actions">
          <a class="btn btn-outline" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}">Como chegar</a>
          <button class="btn btn-outline" type="button" data-close>Fechar</button>
          <button class="btn" type="button" id="scheduleThis">Agendar esta trilha</button>
        </div>
      </div>`;
    $("[data-close]", dlg).addEventListener("click", () => dlg.close());
    $("#scheduleThis", dlg).addEventListener("click", () => { dlg.close(); openEventForm(id); });
    dlg.showModal();
  }

  // ---------- Agenda ----------
  let eventFilter = "upcoming";
  const byDate = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

  function fmtDate(iso) {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  }

  function renderEvents() {
    const today = new Date().toISOString().slice(0, 10);
    const name = me();
    let list = state.events.slice();
    if (eventFilter === "upcoming") list = list.filter((e) => e.date >= today).sort(byDate);
    if (eventFilter === "past") list = list.filter((e) => e.date < today).sort((a, b) => byDate(b, a));
    if (eventFilter === "mine") list = list.filter((e) => name && e.attendees.includes(name)).sort(byDate);

    $("#eventList").innerHTML = list.length ? list.map((e) => {
      const t = trailById[e.trailId];
      const d = new Date(e.date + "T12:00:00");
      const joined = name && e.attendees.includes(name);
      const full = e.attendees.length >= e.slots;
      const past = e.date < today;
      const isHost = name && e.host === name;
      let action = "";
      if (!past) {
        if (isHost) action = `<button class="btn btn-danger btn-sm" data-act="cancel" data-id="${e.id}">Cancelar saída</button>`;
        else if (joined) action = `<button class="btn btn-outline btn-sm" data-act="leave" data-id="${e.id}">Sair</button>`;
        else action = `<button class="btn btn-sm" data-act="join" data-id="${e.id}" ${full ? "disabled" : ""}>${full ? "Lotado" : "Participar"}</button>`;
      }
      return `
      <li class="event card${past ? " past" : ""}">
        <div class="date-chip"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span></div>
        <div class="event-body">
          <h3><a href="#" data-trail="${t.id}">${esc(t.name)}</a> <span class="badge ${DIFF_CLASS[t.difficulty]}">${t.difficulty}</span></h3>
          <p class="muted small">${fmtDate(e.date)} às ${esc(e.time)} · ${esc(t.city)}</p>
          <p class="small">📍 ${esc(e.meet)}</p>
          ${e.desc ? `<p class="small">${esc(e.desc)}</p>` : ""}
          <div class="attendees">
            ${e.attendees.slice(0, 6).map((a) => `<span class="av" title="${esc(a)}">${esc(a[0].toUpperCase())}</span>`).join("")}
            <span class="small muted">${e.attendees.length}/${e.slots} confirmados · organizado por ${esc(e.host)}</span>
          </div>
        </div>
        <div class="event-action">${action}</div>
      </li>`;
    }).join("") : `<li class="empty">${eventFilter === "mine" ? "Você ainda não participa de nenhuma saída." : "Nenhuma saída por aqui."}</li>`;
  }

  $$(".seg-btn").forEach((b) => b.addEventListener("click", () => {
    $$(".seg-btn").forEach((x) => x.classList.toggle("active", x === b));
    eventFilter = b.dataset.filter;
    renderEvents();
  }));

  $("#eventList").addEventListener("click", (e) => {
    const link = e.target.closest("[data-trail]");
    if (link) { e.preventDefault(); openTrail(link.dataset.trail); return; }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const ev = state.events.find((x) => x.id === btn.dataset.id);
    requireUser(() => {
      const name = me();
      if (btn.dataset.act === "join" && !ev.attendees.includes(name) && ev.attendees.length < ev.slots) {
        ev.attendees.push(name); toast("Presença confirmada! 🥾");
      } else if (btn.dataset.act === "leave") {
        ev.attendees = ev.attendees.filter((a) => a !== name); toast("Você saiu da saída.");
      } else if (btn.dataset.act === "cancel" && confirm("Cancelar esta saída para todos?")) {
        state.events = state.events.filter((x) => x.id !== ev.id); toast("Saída cancelada.");
      }
      save(); renderAll();
    });
  });

  function openEventForm(trailId) {
    requireUser(() => {
      $("#evTrail").value = trailId || TRAILS[0].id;
      const min = new Date().toISOString().slice(0, 10);
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
    toast("Trilha agendada! Convide a galera na Comunidade.");
    location.hash = "#agenda";
    renderAll();
  });

  // ---------- Comunidade ----------
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return `${Math.floor(s / 60)} min`;
    if (s < 86400) return `${Math.floor(s / 3600)} h`;
    return `${Math.floor(s / 86400)} d`;
  }

  function renderFeed() {
    const name = me();
    $("#feed").innerHTML = state.posts.slice().sort((a, b) => b.at - a.at).map((p) => {
      const t = p.trailId ? trailById[p.trailId] : null;
      const liked = name && p.likes.includes(name);
      return `
      <li class="post card" data-id="${p.id}">
        <div class="post-head">
          <span class="av">${esc(p.author[0].toUpperCase())}</span>
          <div><strong>${esc(p.author)}</strong><div class="muted small">${timeAgo(p.at)}${t ? ` · em <a href="#" data-trail="${t.id}">${esc(t.name)}</a>` : ""}</div></div>
          ${name === p.author ? `<button class="link danger small" data-act="del">Excluir</button>` : ""}
        </div>
        <p class="post-text">${esc(p.text)}</p>
        <div class="post-actions">
          <button class="link${liked ? " liked" : ""}" data-act="like">${liked ? "♥" : "♡"} ${p.likes.length}</button>
          <span class="muted small">💬 ${p.comments.length}</span>
        </div>
        <ul class="comments">
          ${p.comments.map((c) => `<li><strong>${esc(c.author)}</strong> ${esc(c.text)} <span class="muted small">· ${timeAgo(c.at)}</span></li>`).join("")}
        </ul>
        <form class="comment-form" data-act="comment">
          <input type="text" placeholder="Escreva um comentário…" maxlength="300" required />
          <button class="btn btn-sm" type="submit">Enviar</button>
        </form>
      </li>`;
    }).join("") || '<li class="empty">Nenhuma publicação ainda.</li>';
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
      toast("Publicado!");
    });
  });

  $("#feed").addEventListener("click", (e) => {
    const link = e.target.closest("[data-trail]");
    if (link) { e.preventDefault(); openTrail(link.dataset.trail); return; }
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const post = state.posts.find((p) => p.id === btn.closest(".post").dataset.id);
    requireUser(() => {
      const name = me();
      if (btn.dataset.act === "like") {
        post.likes = post.likes.includes(name) ? post.likes.filter((x) => x !== name) : [...post.likes, name];
      } else if (btn.dataset.act === "del" && post.author === name && confirm("Excluir publicação?")) {
        state.posts = state.posts.filter((p) => p !== post);
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

  // ---------- Init ----------
  function fillTrailSelects() {
    const opts = TRAILS.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => `<option value="${t.id}">${esc(t.name)} — ${esc(t.city)}</option>`).join("");
    $("#evTrail").innerHTML = opts;
    $("#postTrail").insertAdjacentHTML("beforeend", opts);
  }

  function renderAll() { renderTrails(); renderEvents(); renderFeed(); }

  fillTrailSelects();
  initMap();
  renderProfileBtn();
  renderAll();
  route();
})();
