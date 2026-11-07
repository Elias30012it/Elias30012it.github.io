// Efeitos visuais: paisagens geradas por trilha, curvas de nível animadas, contadores,
// indicador das abas e animação de "voar para o carrinho". Tudo respeita prefers-reduced-motion.
(function () {
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Números pseudoaleatórios com semente (a mesma trilha gera sempre a mesma arte) ----------
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(String(seed)) || 1;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Paisagem de serra ----------
  // Paletas: céu (topo → horizonte), sol, e camadas de serra (longe → perto).
  const SKIES = {
    amanhecer: { sky: ["#f6d7a7", "#efb48a", "#e7c8b0"], sun: "#fff3d6", hills: ["#c9b3a3", "#9c8a7a", "#6f6a52", "#3f5236", "#263726"] },
    dia:       { sky: ["#bcd6d4", "#dce7dc", "#eef0e4"], sun: "#fffbea", hills: ["#b3c4bd", "#8aa596", "#5f8063", "#3c5f3f", "#25402a"] },
    entardecer:{ sky: ["#5a4a6b", "#b9708a", "#f0ae7e"], sun: "#ffe0b0", hills: ["#8b6a7a", "#6a5266", "#4b3f4f", "#33302f", "#1f2620"] },
    neblina:   { sky: ["#d9ddd6", "#e6e7df", "#f1f1ea"], sun: "#ffffff", hills: ["#cfd3c9", "#aeb8a9", "#869683", "#5a6d57", "#34452f"] },
  };
  const SKY_NAMES = Object.keys(SKIES);

  function ridge(r, w, h, base, rough, n = 9) {
    // deslocamento de ponto médio: serra com picos irregulares
    let pts = [[0, base + (r() - 0.5) * rough], [w, base + (r() - 0.5) * rough]];
    let amp = rough;
    for (let k = 0; k < n; k++) {
      const next = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
        next.push([(x1 + x2) / 2, (y1 + y2) / 2 + (r() - 0.5) * amp], pts[i]);
      }
      pts = next;
      amp *= 0.52;
    }
    return pts;
  }

  function landscape(seed, opts = {}) {
    const r = rng(seed);
    const w = 400, h = opts.tall ? 260 : 220;
    const mood = opts.mood || SKY_NAMES[Math.floor(r() * SKY_NAMES.length)];
    const pal = SKIES[mood];
    const id = "l" + hash(String(seed) + (opts.tall ? "t" : "")).toString(36);
    const sunX = 60 + r() * 280, sunY = h * (0.22 + r() * 0.18), sunR = 16 + r() * 14;
    let svg = `<svg class="scape" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${pal.sky[0]}"/><stop offset=".6" stop-color="${pal.sky[1]}"/><stop offset="1" stop-color="${pal.sky[2]}"/>
      </linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#${id}s)"/>
      <circle class="sun" cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="${sunR.toFixed(1)}" fill="${pal.sun}" opacity=".9"/>`;
    const layers = pal.hills.length;
    let peak = null;
    for (let i = 0; i < layers; i++) {
      const base = h * (0.42 + i * 0.12);
      const pts = ridge(r, w, h, base, h * (0.42 - i * 0.06), 7);
      if (i === 2) peak = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
      const d = "M0," + h + " L" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L") + ` L${w},${h} Z`;
      svg += `<path class="hill hill-${i}" d="${d}" fill="${pal.hills[i]}"/>`;
      // pinheiros na penúltima camada
      if (i === layers - 2) {
        const trees = 7 + Math.floor(r() * 9);
        for (let k = 0; k < trees; k++) {
          const p = pts[Math.floor(r() * pts.length)];
          const s = 5 + r() * 7;
          svg += `<path d="M${p[0].toFixed(1)},${(p[1] - s * 2.2).toFixed(1)} l${(s * 0.6).toFixed(1)},${(s * 2.2).toFixed(1)} h-${(s * 1.2).toFixed(1)} z" fill="${pal.hills[i + 1]}"/>`;
        }
      }
    }
    // a trilha: tracejado subindo em zigue-zague até o cume da camada do meio, com bandeirinha
    if (peak && opts.trail !== false) {
      const [px, py] = peak;
      let x = Math.min(w - 20, Math.max(20, px + (r() - 0.5) * 120)), y = h - 4;
      let d = `M${x.toFixed(1)},${y}`;
      const steps = 5;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const nx = x + (px - x) * t + (k % 2 ? 1 : -1) * (24 * (1 - t));
        const ny = y + (py - y) * t;
        d += ` L${nx.toFixed(1)},${ny.toFixed(1)}`;
      }
      svg += `<path class="trail-line" d="${d}" fill="none" stroke="#fbf6ec" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round" opacity=".85"/>
        <path d="M${px.toFixed(1)},${py.toFixed(1)} v-16 l10,4 -10,4" fill="none" stroke="#fbf6ec" stroke-width="1.8" stroke-linejoin="round"/>`;
    }
    return svg + "</svg>";
  }

  // ---------- Curvas de nível (fundo do topo) ----------
  function contours(seed = "topo", w = 1200, h = 420) {
    const r = rng(seed);
    let paths = "";
    const peaks = 4;
    for (let p = 0; p < peaks; p++) {
      const cx = r() * w, cy = r() * h;
      const rings = 6 + Math.floor(r() * 5);
      const wob = Array.from({ length: 6 }, () => [r() * Math.PI * 2, 0.08 + r() * 0.14]);
      for (let k = 1; k <= rings; k++) {
        const R = k * (18 + r() * 6);
        let d = "";
        for (let a = 0; a <= 64; a++) {
          const th = (a / 64) * Math.PI * 2;
          const f = 1 + wob.reduce((s, [ph, amp], i) => s + Math.sin(th * (i + 2) + ph) * amp / (i + 1), 0);
          const x = cx + Math.cos(th) * R * f * 1.25, y = cy + Math.sin(th) * R * f;
          d += (a ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
        }
        paths += `<path d="${d}Z"${k % 5 === 0 ? ' class="index"' : ""}/>`;
      }
    }
    return `<svg class="contours" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g>${paths}</g></svg>`;
  }

  // ---------- Contador animado ----------
  function countUp(root) {
    root.querySelectorAll("[data-count]").forEach((el) => {
      const to = +el.dataset.count;
      if (reduce() || to < 2) { el.textContent = to.toLocaleString("pt-BR"); return; }
      const t0 = performance.now(), dur = 900 + Math.min(600, to / 3);
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(to * e).toLocaleString("pt-BR");
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- Indicador deslizante das abas ----------
  function tabIndicator(nav) {
    let bar = nav.querySelector(".tab-bar");
    if (!bar) { bar = document.createElement("span"); bar.className = "tab-bar"; nav.appendChild(bar); }
    const cur = nav.querySelector("[aria-current]");
    if (!cur) { bar.style.opacity = 0; return; }
    bar.style.opacity = 1;
    bar.style.width = cur.offsetWidth - 24 + "px";
    bar.style.transform = `translateX(${cur.offsetLeft + 12}px)`;
  }

  // ---------- Produto voando até o carrinho ----------
  function flyTo(fromEl, toEl, html) {
    if (reduce() || !fromEl || !toEl) return;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.className = "fly";
    dot.innerHTML = html || "";
    document.body.appendChild(dot);
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2, ex = b.left + b.width / 2, ey = b.top + b.height / 2;
    dot.animate([
      { transform: `translate(${sx - 22}px, ${sy - 22}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(sx + ex) / 2 - 22}px, ${Math.min(sy, ey) - 120}px) scale(.8)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${ex - 22}px, ${ey - 22}px) scale(.25)`, opacity: 0.4 },
    ], { duration: 720, easing: "cubic-bezier(.45,0,.3,1)" }).onfinish = () => {
      dot.remove();
      toEl.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 320 });
    };
  }

  // ---------- Parallax nas paisagens (camadas de serra seguem o ponteiro) ----------
  const PARALLAX = ".day-card, .feat-card, .detail-art";
  let active = null;
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || reduce()) return;
    const box = e.target.closest?.(PARALLAX);
    if (active && active !== box) { active.style.removeProperty("--mx"); active.style.removeProperty("--my"); }
    active = box;
    if (!box) return;
    const r = box.getBoundingClientRect();
    box.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    box.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }, { passive: true });

  // ---------- Animações pausadas fora da tela ----------
  function pauseOffscreen(el) {
    if (!el || !("IntersectionObserver" in window)) return;
    new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle("is-offscreen", !e.isIntersecting))).observe(el);
  }

  window.FX = { landscape, contours, countUp, tabIndicator, flyTo, rng, reduce, pauseOffscreen };
})();
