// Mapa com a API do Google Maps: marcadores no estilo do site, agrupados quando há muitos juntos.
// Mesmo "contrato" do mapa SVG (js/map.js): setVisible, setOrigin, setRadius, clearOrigin,
// selectState, addTrails e refresh. Se a chave falhar, opts.onFail() é chamado e o site volta ao SVG.
(function () {
  const BRAZIL = { north: 5.3, south: -33.8, west: -74, east: -34.7 };
  let loading = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error("falha ao carregar " + src));
      document.head.appendChild(s);
    });
  }

  function loadGoogle(key) {
    if (window.google?.maps?.importLibrary) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("tempo esgotado")), 15000);
      window.__plGmapsReady = () => { clearTimeout(timer); resolve(); };
      const q = new URLSearchParams({ key, v: "weekly", loading: "async", libraries: "marker", language: "pt-BR", region: "BR", callback: "__plGmapsReady" });
      loadScript("https://maps.googleapis.com/maps/api/js?" + q).catch((e) => { clearTimeout(timer); reject(e); });
    });
    return loading;
  }

  window.createGoogleMap = async function (container, trails, opts) {
    // Chave inválida ou domínio não autorizado: o Google chama esta função global.
    window.gm_authFailure = () => opts.onFail?.("auth");
    await loadGoogle(opts.key);
    if (!window.markerClusterer) await loadScript("js/vendor/markerclusterer.umd.js");
    const { Map, Circle } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const { LatLngBounds } = await google.maps.importLibrary("core");

    container.innerHTML = "";
    container.classList.add("gmap");
    const canvas = document.createElement("div");
    canvas.className = "gmap-canvas";
    container.appendChild(canvas);

    const map = new Map(canvas, {
      mapId: opts.mapId || "DEMO_MAP_ID",
      center: { lat: -14.5, lng: -51 }, zoom: 4, minZoom: 3,
      gestureHandling: "greedy", clickableIcons: false,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
      colorScheme: "FOLLOW_SYSTEM",
    });
    map.fitBounds(BRAZIL, 0);

    // ficha ao passar o mouse
    const card = document.createElement("div");
    card.className = "map-card"; card.hidden = true;
    container.appendChild(card);
    function showCard(t, e) {
      card.innerHTML = "<b></b><span class='mc-place'></span><span class='mc-meta'></span>";
      card.querySelector("b").textContent = t.name;
      card.querySelector(".mc-place").textContent = `${t.city}, ${t.uf}`;
      card.querySelector(".mc-meta").textContent = `${String(t.km).replace(".", ",")} km · ${t.difficulty}`;
      card.dataset.diff = opts.diffClass[t.difficulty];
      card.hidden = false;
      const r = container.getBoundingClientRect();
      let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x + 240 > r.width) x -= 260;
      if (y + 80 > r.height) y -= 100;
      card.style.transform = `translate(${x}px, ${y}px)`;
    }
    const hideCard = () => { card.hidden = true; };

    // marcadores: a "marca de trilha" do site
    const markers = {};
    function addMarker(t) {
      if (markers[t.id]) return;
      const el = document.createElement("div");
      el.className = `gm-pin gm-${opts.diffClass[t.difficulty]}`;
      el.title = `${t.name} — ${t.city}, ${t.uf}`;
      el.addEventListener("mouseenter", (e) => showCard(t, e));
      el.addEventListener("mouseleave", hideCard);
      const m = new AdvancedMarkerElement({ position: { lat: t.lat, lng: t.lng }, content: el, title: t.name, gmpClickable: true });
      m.addListener("click", () => { hideCard(); opts.onPick(t.id); });
      markers[t.id] = { m, t, on: true };
    }
    trails.forEach(addMarker);

    // agrupamento: placa marrom com a quantidade de trilhas
    const clusterer = new window.markerClusterer.MarkerClusterer({
      map,
      markers: Object.values(markers).map((x) => x.m),
      renderer: {
        render({ count, position }) {
          const el = document.createElement("div");
          el.className = "gm-cluster" + (count >= 100 ? " big" : count >= 20 ? " mid" : "");
          el.textContent = count.toLocaleString("pt-BR");
          return new AdvancedMarkerElement({ position, content: el, zIndex: 1000 + count, title: `${count} trilhas` });
        },
      },
    });

    let you = null, circle = null;
    const fitTrails = (list) => {
      if (!list.length) return;
      const b = new LatLngBounds();
      list.forEach((t) => b.extend({ lat: t.lat, lng: t.lng }));
      map.fitBounds(b, 40);
      if (list.length === 1) map.setZoom(12);
    };

    const legend = document.createElement("div");
    legend.className = "map-legend";
    legend.innerHTML = '<span><i class="blaze easy"></i>Fácil</span><span><i class="blaze medium"></i>Moderada</span><span><i class="blaze hard"></i>Difícil</span>';
    container.appendChild(legend);

    return {
      kind: "google",
      setVisible(ids) {
        let changed = false;
        Object.entries(markers).forEach(([id, x]) => { const on = ids.has(id); if (on !== x.on) { x.on = on; changed = true; } });
        if (!changed) return;
        clusterer.clearMarkers(true);
        clusterer.addMarkers(Object.values(markers).filter((x) => x.on).map((x) => x.m));
      },
      addTrails(list) {
        list.forEach(addMarker);
        clusterer.addMarkers(list.map((t) => markers[t.id]?.m).filter(Boolean));
      },
      setOrigin(o, km) {
        const center = { lat: o.lat, lng: o.lng };
        if (!you) {
          const el = document.createElement("div");
          el.className = "gm-you";
          you = new AdvancedMarkerElement({ map, position: center, content: el, title: "Você está aqui", zIndex: 5000 });
        } else { you.position = center; you.map = map; }
        if (!circle) {
          circle = new Circle({ map, center, radius: km * 1000, clickable: false, strokeColor: "#2e5b38", strokeOpacity: 0.9, strokeWeight: 2, fillColor: "#2e5b38", fillOpacity: 0.07 });
        } else { circle.setCenter(center); circle.setRadius(km * 1000); circle.setMap(map); }
        map.fitBounds(circle.getBounds(), 30);
      },
      setRadius(km) { circle?.setRadius(km * 1000); },
      clearOrigin() {
        if (you) you.map = null;
        circle?.setMap(null);
        map.fitBounds(BRAZIL, 0);
      },
      selectState(uf) {
        if (!uf) { map.fitBounds(BRAZIL, 0); return; }
        fitTrails(Object.values(markers).filter((x) => x.t.uf === uf).map((x) => x.t));
      },
      refresh() {},
    };
  };
})();
