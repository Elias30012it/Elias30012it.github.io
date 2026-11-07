// Rotas dentro do site, sem Google Maps: serviço de rotas do OpenStreetMap (OSRM mantido pela FOSSGIS,
// o mesmo usado em openstreetmap.org). Gratuito, sem chave; pede uso moderado e atribuição.
(function () {
  const PROFILES = { car: "routed-car", bike: "routed-bike", foot: "routed-foot" };

  const MOD = {
    "right": "à direita", "slight right": "levemente à direita", "sharp right": "acentuadamente à direita",
    "left": "à esquerda", "slight left": "levemente à esquerda", "sharp left": "acentuadamente à esquerda",
    "straight": "em frente", "uturn": "fazendo o retorno",
  };

  function road(s, prep) {
    const name = s.name || s.ref || "";
    return name ? ` ${prep} ${name}` : "";
  }

  // Texto em português para cada manobra do OSRM
  function instruction(s, isLast) {
    const m = s.maneuver || {};
    const mod = MOD[m.modifier] || "";
    switch (m.type) {
      case "depart": return `Siga${road(s, "pela") || " em frente"}`;
      case "arrive": return isLast ? "Você chegou ao ponto da trilha mais próximo por estrada" : `Passe pelo ponto intermediário${road(s, "na")}`;
      case "turn":
        if (m.modifier === "uturn") return `Faça o retorno${road(s, "na")}`;
        if (m.modifier === "straight") return `Siga em frente${road(s, "pela")}`;
        return `Vire ${mod}${road(s, "na")}`;
      case "new name": return `Continue${road(s, "pela")}`;
      case "continue": return m.modifier && m.modifier !== "straight" ? `Continue ${mod}${road(s, "pela")}` : `Continue${road(s, "pela") || " em frente"}`;
      case "merge": return `Entre ${mod}${road(s, "na")}`.replace("Entre em frente", "Entre");
      case "on ramp": return `Pegue o acesso ${mod}${road(s, "para")}`;
      case "off ramp": return `Pegue a saída ${mod}${road(s, "para")}`;
      case "fork": return `Na bifurcação, mantenha-se ${mod}${road(s, "na")}`;
      case "end of road": return `No fim da via, vire ${mod}${road(s, "na")}`;
      case "roundabout": case "rotary": case "roundabout turn":
        return m.exit ? `Na rotatória, pegue a ${m.exit}ª saída${road(s, "para")}` : `Entre na rotatória${road(s, "e siga para")}`;
      case "exit roundabout": case "exit rotary": return `Saia da rotatória${road(s, "para")}`;
      default: return `Siga${road(s, "pela") || " em frente"}`;
    }
  }

  async function getRoute(from, to, mode, signal) {
    const prof = PROFILES[mode] || PROFILES.car;
    const coords = `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
    const url = `https://routing.openstreetmap.de/${prof}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal });
    if (!res.ok && res.status !== 400) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      const err = new Error(data.code || "sem rota");
      err.code = data.code;
      throw err;
    }
    const r = data.routes[0];
    const raw = r.legs[0].steps;
    const steps = [];
    raw.forEach((s, i) => {
      const last = i === raw.length - 1;
      if (!last && s.distance < 1 && s.maneuver.type !== "depart") return;
      const text = instruction(s, last);
      const prev = steps[steps.length - 1];
      if (prev && prev.text === text && !last) { prev.distance += s.distance; return; } // junta trechos repetidos
      steps.push({ text, distance: s.distance, last });
    });
    return {
      distance: r.distance,
      duration: r.duration,
      line: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      steps,
    };
  }

  window.Routing = { getRoute };
})();
