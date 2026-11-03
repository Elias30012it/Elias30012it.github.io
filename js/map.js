// Mapa em SVG, sem dependências externas. Usado quando o Leaflet/OpenStreetMap
// não está disponível (offline ou em ambientes que bloqueiam CDNs).
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const COS = Math.cos((15 * Math.PI) / 180);
  const proj = (lat, lng) => [(lng + 75) * COS * 10, (6 - lat) * 10];

  // Contorno simplificado do Brasil (lat, lng).
  const BRAZIL = [
    [5.2, -60.7], [2.0, -56.0], [2.3, -54.0], [4.3, -51.6], [2.0, -50.0], [0.0, -49.5], [-0.8, -47.5], [-1.6, -44.9],
    [-2.6, -43.5], [-2.9, -41.0], [-3.7, -38.5], [-5.1, -35.5], [-7.1, -34.8], [-9.6, -35.7], [-12.9, -38.4], [-15.5, -38.9],
    [-18.6, -39.7], [-21.2, -40.9], [-22.9, -42.0], [-23.0, -43.6], [-23.8, -45.4], [-25.3, -48.0], [-26.5, -48.6],
    [-28.6, -48.8], [-30.5, -50.3], [-33.7, -53.4], [-32.4, -53.6], [-30.2, -57.6], [-28.0, -56.0], [-27.2, -54.0],
    [-25.6, -54.6], [-24.0, -54.3], [-22.3, -55.8], [-22.1, -57.9], [-19.8, -58.1], [-17.6, -57.7], [-16.3, -58.3],
    [-15.4, -60.2], [-13.6, -61.0], [-12.4, -64.0], [-10.0, -65.3], [-10.9, -68.5], [-11.0, -70.5], [-9.5, -72.5],
    [-9.0, -73.2], [-7.4, -73.9], [-4.4, -70.0], [-1.1, -69.4], [1.2, -69.8], [1.8, -67.3], [0.8, -66.2], [1.2, -64.0],
    [2.4, -63.4], [4.0, -62.8], [4.5, -61.0], [5.2, -60.7],
  ];

  const HOME = { x: 0, y: 0, w: 420, h: 410 }; // Brasil inteiro

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  window.createSvgMap = function (container, trails, opts) {
    container.classList.add("svgmap");
    container.innerHTML = "";
    const svg = el("svg", { role: "img", "aria-label": "Mapa esquemático do Brasil com as trilhas", preserveAspectRatio: "xMidYMid meet" }, container);
    el("path", { class: "land", d: "M" + BRAZIL.map(([a, b]) => proj(a, b).join(",")).join("L") + "Z" }, svg);
    const ring = el("ellipse", { class: "ring", visibility: "hidden" }, svg);
    const you = el("g", { class: "you", visibility: "hidden" }, svg);
    const youDot = el("circle", {}, you);
    const layer = el("g", {}, svg);

    const pins = {};
    trails.forEach((t) => {
      const [x, y] = proj(t.lat, t.lng);
      const g = el("g", { class: `pin pin-${opts.diffClass[t.difficulty]}`, tabindex: "0", role: "button", "aria-label": t.name }, layer);
      el("title", {}, g).textContent = `${t.name} · ${t.city}`;
      const c = el("circle", { cx: x, cy: y }, g);
      const label = el("text", { x, y }, g);
      label.textContent = t.name;
      g.addEventListener("click", () => opts.onPick(t.id));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onPick(t.id); } });
      pins[t.id] = { g, c, label, x, y };
    });

    let view = { ...HOME };
    let origin = null, radiusKm = 300;

    function draw() {
      svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
      // unidades do SVG por pixel de tela (preserveAspectRatio "meet")
      const cw = svg.clientWidth || 600, ch = svg.clientHeight || 500;
      const u = Math.max(view.w / cw, view.h / ch);
      const showLabels = view.w < 160;
      Object.values(pins).forEach((p) => {
        p.c.setAttribute("r", 6 * u);
        p.label.setAttribute("font-size", 12 * u);
        p.label.setAttribute("dx", 9 * u);
        p.label.setAttribute("dy", 4 * u);
        p.label.style.display = showLabels ? "" : "none";
      });
      svg.style.setProperty("--sw", 1.5 * u);
      if (origin) {
        const [x, y] = proj(origin.lat, origin.lng);
        youDot.setAttribute("cx", x); youDot.setAttribute("cy", y); youDot.setAttribute("r", 7 * u);
        ring.setAttribute("cx", x); ring.setAttribute("cy", y);
        ring.setAttribute("rx", (radiusKm / (111 * Math.cos((origin.lat * Math.PI) / 180))) * COS * 10);
        ring.setAttribute("ry", (radiusKm / 111) * 10);
      }
    }

    function fitOrigin() {
      const [x, y] = proj(origin.lat, origin.lng);
      const r = Math.max(+ring.getAttribute("rx"), +ring.getAttribute("ry")) * 1.15 || 30;
      const w = Math.min(HOME.w, Math.max(12, r * 2));
      view = { x: x - w / 2, y: y - (w * HOME.h) / HOME.w / 2, w, h: (w * HOME.h) / HOME.w };
    }

    function zoom(f) {
      const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
      const w = Math.min(HOME.w * 1.2, Math.max(8, view.w * f));
      const h = (w * HOME.h) / HOME.w;
      view = { x: cx - w / 2, y: cy - h / 2, w, h };
      draw();
    }

    // Arrastar para mover
    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".pin")) return;
      drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const k = view.w / svg.clientWidth;
      view.x = drag.vx - (e.clientX - drag.x) * k;
      view.y = drag.vy - (e.clientY - drag.y) * k;
      draw();
    });
    const end = () => { drag = null; };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);

    const ctrls = document.createElement("div");
    ctrls.className = "map-ctrls";
    ctrls.innerHTML = '<button type="button" aria-label="Aproximar">+</button><button type="button" aria-label="Afastar">−</button><button type="button" aria-label="Ver o Brasil inteiro">⤢</button>';
    const [zin, zout, home] = ctrls.querySelectorAll("button");
    zin.onclick = () => zoom(0.6);
    zout.onclick = () => zoom(1.6);
    home.onclick = () => { view = { ...HOME }; draw(); };
    container.appendChild(ctrls);

    const legend = document.createElement("div");
    legend.className = "map-legend";
    legend.innerHTML = '<span class="dot easy"></span>Fácil <span class="dot medium"></span>Moderada <span class="dot hard"></span>Difícil';
    container.appendChild(legend);

    draw();
    if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(container);

    return {
      setVisible(ids) { Object.entries(pins).forEach(([id, p]) => { p.g.style.display = ids.has(id) ? "" : "none"; }); },
      setOrigin(o, r) {
        origin = o; radiusKm = r;
        ring.setAttribute("visibility", "visible"); you.setAttribute("visibility", "visible");
        draw(); fitOrigin(); draw();
      },
      setRadius(r) { radiusKm = r; draw(); },
      refresh() { draw(); },
    };
  };
})();
