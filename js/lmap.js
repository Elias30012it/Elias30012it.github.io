// Mapa gratuito com Leaflet (BSD-2) e mapas abertos: OpenStreetMap (ruas) e OpenTopoMap (relevo).
// Sem chave e sem custo. Marcadores no estilo do site, agrupados com Leaflet.markercluster (MIT).
// Mesmo "contrato" do mapa SVG (js/map.js). Se os mapas não carregarem, opts.onFail() é chamado.
(function () {
  const BRAZIL = [[-33.8, -74], [5.3, -34.7]];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("falha ao carregar " + src));
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  }

  window.createLeafletMap = async function (container, trails, opts) {
    loadCss("js/vendor/leaflet/leaflet.css");
    loadCss("js/vendor/leaflet/MarkerCluster.css");
    if (!window.L) await loadScript("js/vendor/leaflet/leaflet.js");
    if (!window.L.markerClusterGroup) await loadScript("js/vendor/leaflet/leaflet.markercluster.js");
    const L = window.L;

    container.innerHTML = "";
    container.classList.add("lmap");
    const canvas = document.createElement("div");
    canvas.className = "lmap-canvas";
    container.appendChild(canvas);

    const map = L.map(canvas, { zoomControl: true, minZoom: 3, maxZoom: 17, worldCopyJump: false, preferCanvas: false });
    map.fitBounds(BRAZIL);

    const ruas = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    });
    const relevo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17, subdomains: "abc",
      attribution: 'Mapa: &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a> (CC-BY-SA), dados &copy; OpenStreetMap, SRTM',
    });
    ruas.addTo(map);
    L.control.layers({ "Mapa": ruas, "Relevo": relevo }, null, { position: "topright" }).addTo(map);

    // Se nenhum pedaço do mapa carregar (sem internet, bloqueado), volta ao mapa SVG.
    let loaded = false, failed = 0;
    const onTile = () => { loaded = true; };
    const onErr = () => { if (!loaded && ++failed >= 4) opts.onFail?.("tiles"); };
    [ruas, relevo].forEach((l) => { l.on("tileload", onTile); l.on("tileerror", onErr); });
    setTimeout(() => { if (!loaded) opts.onFail?.("tiles-timeout"); }, 9000);

    // marcadores: a "marca de trilha" do site, com ficha ao passar o mouse
    const pinIcon = {};
    const icon = (cls) => pinIcon[cls] || (pinIcon[cls] = L.divIcon({ className: "", html: `<span class="lf-pin lf-${cls}"></span>`, iconSize: [16, 16], iconAnchor: [8, 8] }));
    function tip(t) {
      const el = document.createElement("div");
      const b = document.createElement("b"); b.textContent = t.name;
      const p = document.createElement("span"); p.textContent = `${t.city}, ${t.uf} · ${String(t.km).replace(".", ",")} km · ${t.difficulty}`;
      el.append(b, p);
      return el;
    }
    const markers = {};
    function makeMarker(t) {
      if (markers[t.id]) return markers[t.id];
      const m = L.marker([t.lat, t.lng], { icon: icon(opts.diffClass[t.difficulty]), title: t.name, keyboard: false });
      m.bindTooltip(() => tip(t), { direction: "top", offset: [0, -8], className: "lf-tip" });
      m.on("click", () => opts.onPick(t.id));
      return (markers[t.id] = { m, t, on: true });
    }
    trails.forEach(makeMarker);

    // agrupamento: placa marrom com a quantidade de trilhas
    const cluster = L.markerClusterGroup({
      chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true,
      iconCreateFunction(c) {
        const n = c.getChildCount();
        const size = n >= 100 ? "big" : n >= 20 ? "mid" : "";
        return L.divIcon({ className: "", html: `<span class="lf-cluster ${size}">${n.toLocaleString("pt-BR")}</span>`, iconSize: [44, 36], iconAnchor: [22, 18] });
      },
    });
    cluster.addLayers(Object.values(markers).map((x) => x.m));
    map.addLayer(cluster);

    let you = null, circle = null, route = null;
    const flagIcon = L.divIcon({ className: "", html: '<span class="lf-flag"></span>', iconSize: [22, 26], iconAnchor: [4, 24] });
    const youIcon = L.divIcon({ className: "", html: '<span class="lf-you"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });

    const legend = document.createElement("div");
    legend.className = "map-legend";
    legend.innerHTML = '<span><i class="blaze easy"></i>Fácil</span><span><i class="blaze medium"></i>Moderada</span><span><i class="blaze hard"></i>Difícil</span>';
    container.appendChild(legend);

    return {
      kind: "leaflet",
      setVisible(ids) {
        let changed = false;
        Object.entries(markers).forEach(([id, x]) => { const on = ids.has(id); if (on !== x.on) { x.on = on; changed = true; } });
        if (!changed) return;
        cluster.clearLayers();
        cluster.addLayers(Object.values(markers).filter((x) => x.on).map((x) => x.m));
      },
      addTrails(list) {
        cluster.addLayers(list.map((t) => makeMarker(t).m));
      },
      setOrigin(o, km) {
        const c = [o.lat, o.lng];
        if (!you) you = L.marker(c, { icon: youIcon, title: "Você está aqui", zIndexOffset: 5000, keyboard: false }).addTo(map);
        else you.setLatLng(c).addTo(map);
        if (!circle) circle = L.circle(c, { radius: km * 1000, interactive: false, className: "lf-ring" }).addTo(map);
        else circle.setLatLng(c).setRadius(km * 1000).addTo(map);
        map.flyToBounds(circle.getBounds(), { padding: [20, 20], duration: 0.6 });
      },
      setRadius(km) { circle?.setRadius(km * 1000); },
      clearOrigin() {
        you?.remove(); circle?.remove();
        map.flyToBounds(BRAZIL, { duration: 0.6 });
      },
      selectState(uf) {
        if (!uf) { map.flyToBounds(BRAZIL, { duration: 0.6 }); return; }
        const pts = Object.values(markers).filter((x) => x.t.uf === uf).map((x) => [x.t.lat, x.t.lng]);
        if (pts.length) map.flyToBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 12, duration: 0.6 });
      },
      refresh() { map.invalidateSize(); },
      showRoute(line, from, to) {
        route?.remove();
        route = L.layerGroup([
          L.polyline(line, { color: "#ffffff", weight: 9, opacity: 0.9, interactive: false }),
          L.polyline(line, { color: "#2e5b38", weight: 5, opacity: 0.95, interactive: false }),
          L.marker([to.lat, to.lng], { icon: flagIcon, title: "Destino", keyboard: false, zIndexOffset: 6000 }),
        ]).addTo(map);
        if (!you) you = L.marker([from.lat, from.lng], { icon: youIcon, title: "Saída", zIndexOffset: 5000, keyboard: false }).addTo(map);
        map.invalidateSize();
        map.flyToBounds(L.latLngBounds(line), { padding: [30, 30], duration: 0.7 });
      },
      clearRoute() { route?.remove(); route = null; },
    };
  };
})();
