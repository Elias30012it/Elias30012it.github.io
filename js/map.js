// Mapa do Brasil em SVG com contornos reais dos estados (Natural Earth, ver js/brazil-geo.js).
// Zoom e arraste acontecem só dentro do mapa; a página em si não amplia.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const COS = Math.cos((15 * Math.PI) / 180);
  const LNG0 = -76, LAT0 = 7; // precisa bater com tools/build-geo.py
  const proj = (lat, lng) => [(lng - LNG0) * COS * 10, (LAT0 - lat) * 10];

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  window.createSvgMap = function (container, trails, opts) {
    const GEO = window.BRAZIL_GEO;
    // Enquadramento inicial: o Brasil inteiro, com uma pequena margem.
    const HOME = { x: 40, y: 0, w: 380, h: 420 };
    const MIN_W = 6, MAX_W = 520;

    container.classList.add("svgmap");
    container.innerHTML = "";
    const svg = el("svg", { role: "img", "aria-label": "Mapa do Brasil com as trilhas", preserveAspectRatio: "xMidYMid meet" }, container);
    el("rect", { class: "sea", x: -200, y: -200, width: GEO.width + 400, height: GEO.height + 400 }, svg);
    el("path", { class: "neighbors", d: GEO.neighbors }, svg);

    const statesG = el("g", { class: "states" }, svg);
    const stateEls = {};
    GEO.states.forEach((s) => {
      const p = el("path", { class: "state", d: s.d, "data-uf": s.uf }, statesG);
      el("title", {}, p).textContent = s.name;
      p.addEventListener("click", () => { if (!moved) opts.onState(s.uf); });
      stateEls[s.uf] = p;
    });
    const labelsG = el("g", { class: "state-labels" }, svg);
    const stateLabels = GEO.states.map((s) => {
      const t = el("text", { x: s.lx, y: s.ly }, labelsG);
      t.textContent = s.uf;
      return t;
    });

    const ring = el("ellipse", { class: "ring", visibility: "hidden" }, svg);
    const youPulse = el("circle", { class: "you-pulse", visibility: "hidden" }, svg);
    const you = el("circle", { class: "you", visibility: "hidden" }, svg);
    const layer = el("g", {}, svg);

    const pins = {};
    function addPin(t) {
      if (pins[t.id]) return;
      const [x, y] = proj(t.lat, t.lng);
      const g = el("g", { class: `pin pin-${opts.diffClass[t.difficulty]}`, tabindex: "0", role: "button", "aria-label": `${t.name}, ${t.city}` }, layer);
      el("title", {}, g).textContent = `${t.name} — ${t.city}, ${t.uf}`;
      g.style.setProperty("--d", `${(Object.keys(pins).length % 80) * 12}ms`);
      const mark = el("rect", {}, g);
      const label = el("text", {}, g);
      label.textContent = t.name;
      g.addEventListener("click", () => opts.onPick(t.id));
      g.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") showCard(t, e); });
      g.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") moveCard(e); });
      g.addEventListener("pointerleave", hideCard);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onPick(t.id); } });
      pins[t.id] = { g, mark, label, x, y, on: true };
    }
    trails.forEach(addPin);

    let view = { ...HOME };
    let origin = null, radiusKm = 300;

    function unitsPerPx() {
      const cw = svg.clientWidth || 600, ch = svg.clientHeight || 500;
      return Math.max(view.w / cw, view.h / ch);
    }

    function draw() {
      svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
      const u = unitsPerPx();
      svg.style.setProperty("--u", u);
      // Rótulos só quando poucas trilhas estão na tela; marcadores menores quando há muitas.
      const all = Object.values(pins).filter((p) => p.on);
      const inView = all.filter((p) => p.x > view.x && p.x < view.x + view.w && p.y > view.y && p.y < view.y + view.h).length;
      const showTrailLabels = inView <= 40;
      const size = all.length > 400 ? 6 : all.length > 120 ? 7.5 : 9;
      Object.values(pins).forEach((p) => {
        if (!p.on) return;
        const s = size * u; // marcador quadrado girado, como uma marca de trilha pintada
        p.mark.setAttribute("x", p.x - s / 2);
        p.mark.setAttribute("y", p.y - s / 2);
        p.mark.setAttribute("width", s);
        p.mark.setAttribute("height", s);
        p.mark.setAttribute("transform", `rotate(45 ${p.x} ${p.y})`);
        p.label.setAttribute("x", p.x + 9 * u);
        p.label.setAttribute("y", p.y + 4 * u);
        p.label.setAttribute("font-size", 12 * u);
        p.label.style.display = showTrailLabels ? "" : "none";
      });
      stateLabels.forEach((t) => t.setAttribute("font-size", 10.5 * u));
      labelsG.style.display = view.w > 30 ? "" : "none";
      if (origin) {
        const [x, y] = proj(origin.lat, origin.lng);
        you.setAttribute("cx", x); you.setAttribute("cy", y); you.setAttribute("r", 6 * u);
        youPulse.setAttribute("cx", x); youPulse.setAttribute("cy", y); youPulse.setAttribute("r", 6 * u);
        ring.setAttribute("cx", x); ring.setAttribute("cy", y);
        ring.setAttribute("rx", (radiusKm / (111.32 * Math.cos((origin.lat * Math.PI) / 180))) * COS * 10);
        ring.setAttribute("ry", (radiusKm / 110.57) * 10);
      }
    }

    let anim = 0;
    function animateTo(target) {
      cancelAnimationFrame(anim);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) { view = target; draw(); return; }
      const from = { ...view }, t0 = performance.now(), dur = 520;
      const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      const step = (now) => {
        const k = ease(Math.min(1, (now - t0) / dur));
        view = { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, w: from.w + (target.w - from.w) * k, h: from.h + (target.h - from.h) * k };
        draw();
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    function setView(cx, cy, w) {
      w = Math.min(MAX_W, Math.max(MIN_W, w));
      const h = (w * HOME.h) / HOME.w;
      animateTo({ x: cx - w / 2, y: cy - h / 2, w, h });
    }

    function fitBox(b, pad = 1.2) {
      const aspect = HOME.w / HOME.h;
      const w = Math.max(b.width * pad, b.height * pad * aspect);
      setView(b.x + b.width / 2, b.y + b.height / 2, w);
    }

    // Zoom ancorado num ponto da tela (mantém o ponto sob o cursor/dedos parado)
    function zoomAt(f, clientX, clientY) {
      const r = svg.getBoundingClientRect();
      const u = unitsPerPx();
      const offX = (r.width * u - view.w) / 2, offY = (r.height * u - view.h) / 2;
      const px = view.x - offX + (clientX - r.left) * u;
      const py = view.y - offY + (clientY - r.top) * u;
      const w = Math.min(MAX_W, Math.max(MIN_W, view.w * f));
      const k = w / view.w;
      const h = (w * HOME.h) / HOME.w;
      view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w, h };
      draw();
    }

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      cancelAnimationFrame(anim);
      zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });

    // Arrastar (1 dedo / mouse) e pinça (2 dedos)
    const pointers = new Map();
    let drag = null, pinch = null, moved = false;
    svg.addEventListener("pointerdown", (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pointers.size === 1) { cancelAnimationFrame(anim); drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        drag = null;
      }
    });
    svg.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0) zoomAt(pinch.d / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch.d = d;
        moved = true;
      } else if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) svg.setPointerCapture(e.pointerId);
        moved = true;
        const u = unitsPerPx();
        view.x = drag.vx - dx * u;
        view.y = drag.vy - dy * u;
        draw();
      }
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) drag = null;
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);

    const card = document.createElement("div");
    card.className = "map-card";
    card.hidden = true;
    container.appendChild(card);
    function showCard(t, e) {
      card.innerHTML = `<b></b><span class="mc-place"></span><span class="mc-meta"></span>`;
      card.querySelector("b").textContent = t.name;
      card.querySelector(".mc-place").textContent = `${t.city}, ${t.uf}`;
      card.querySelector(".mc-meta").textContent = `${String(t.km).replace(".", ",")} km · ${t.difficulty}`;
      card.dataset.diff = opts.diffClass[t.difficulty];
      card.hidden = false;
      moveCard(e);
    }
    function moveCard(e) {
      const r = container.getBoundingClientRect();
      let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x + card.offsetWidth > r.width - 8) x = e.clientX - r.left - card.offsetWidth - 14;
      if (y + card.offsetHeight > r.height - 8) y = e.clientY - r.top - card.offsetHeight - 14;
      card.style.transform = `translate(${x}px, ${y}px)`;
    }
    function hideCard() { card.hidden = true; }
    svg.addEventListener("pointerdown", hideCard);

    const ctrls = document.createElement("div");
    ctrls.className = "map-ctrls";
    ctrls.innerHTML =
      '<button type="button" data-z="in" aria-label="Aproximar">+</button>' +
      '<button type="button" data-z="out" aria-label="Afastar">&minus;</button>' +
      '<button type="button" data-z="home" aria-label="Ver o Brasil inteiro" title="Brasil inteiro">BR</button>';
    ctrls.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.z === "home") { animateTo({ ...HOME }); return; }
      setView(view.x + view.w / 2, view.y + view.h / 2, view.w * (b.dataset.z === "in" ? 0.6 : 1.6));
    });
    container.appendChild(ctrls);

    const legend = document.createElement("div");
    legend.className = "map-legend";
    legend.innerHTML = '<span><i class="blaze easy"></i>Fácil</span><span><i class="blaze medium"></i>Moderada</span><span><i class="blaze hard"></i>Difícil</span>';
    container.appendChild(legend);

    draw();
    if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(container);

    return {
      addTrails(list) { list.forEach(addPin); draw(); },
      setVisible(ids) {
        Object.entries(pins).forEach(([id, p]) => { p.on = ids.has(id); p.g.style.display = p.on ? "" : "none"; });
        draw();
      },
      setOrigin(o, r) {
        origin = o; radiusKm = r;
        ring.setAttribute("visibility", "visible"); you.setAttribute("visibility", "visible"); youPulse.setAttribute("visibility", "visible");
        draw();
        fitBox(ring.getBBox(), 1.15);
      },
      setRadius(r) { radiusKm = r; draw(); },
      selectState(uf) {
        Object.entries(stateEls).forEach(([k, p]) => p.classList.toggle("selected", k === uf));
        statesG.classList.toggle("has-selection", !!uf);
        if (uf) fitBox(stateEls[uf].getBBox(), 1.25);
      },
      refresh() { draw(); },
    };
  };
})();
