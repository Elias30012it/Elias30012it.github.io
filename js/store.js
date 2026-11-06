// Persistência simples em localStorage. Para produção, troque por uma API/back-end.
(function () {
  const KEY = "pumping-life:v2";

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // Data local (AAAA-MM-DD). toISOString() usa UTC e, no Brasil, já vira o dia seguinte às 21h.
  function localISO(d = new Date()) {
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  }

  function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return localISO(d);
  }

  function seed() {
    const now = Date.now();
    return {
      user: null,
      events: [
        { id: uid(), trailId: "pedra-grande", date: daysFromNow(4), time: "07:00", slots: 12, meet: "Estacionamento da Av. Lucas Nogueira Garcez", desc: "Ritmo tranquilo, ideal para iniciantes. Leve 2 L de água.", host: "Marina", attendees: ["Marina", "João", "Ana"] },
        { id: uid(), trailId: "pedra-da-gavea", date: daysFromNow(9), time: "06:00", slots: 6, meet: "Estrada do Sorimã, início da trilha", desc: "Necessário experiência com escalaminhada. Levaremos corda.", host: "Rafael", attendees: ["Rafael", "Bia"] },
        { id: uid(), trailId: "pico-jaragua", date: daysFromNow(2), time: "08:30", slots: 20, meet: "Portaria do Parque Estadual do Jaraguá", desc: "Trilha em família! Crianças são bem-vindas.", host: "Lucas", attendees: ["Lucas", "Carla", "Pedro", "Duda", "Léo"] },
        { id: uid(), trailId: "anhangava", date: daysFromNow(-6), time: "07:30", slots: 10, meet: "Portaria do Parque Anhangava", desc: "Saída de domingo.", host: "Ana", attendees: ["Ana", "Marina", "Tiago"] },
      ],
      posts: [
        { id: uid(), author: "Marina", trailId: "pedra-grande", text: "Fiz a Pedra Grande no domingo e o céu estava limpíssimo! Alguém topa repetir esta semana? Já criei o evento na agenda.", at: now - 1000 * 60 * 60 * 5, likes: ["João", "Ana"], comments: [{ author: "João", text: "Tô dentro!", at: now - 1000 * 60 * 60 * 4 }] },
        { id: uid(), author: "Rafael", trailId: "pedra-da-gavea", text: "Dica pra quem vai na Gávea: comece cedo, o sol na Carrasqueira depois das 10h é pesado.", at: now - 1000 * 60 * 60 * 26, likes: ["Bia"], comments: [] },
        { id: uid(), author: "Carla", trailId: "", text: "Qual bota vocês recomendam para quem está começando? Trilhas de até 10 km.", at: now - 1000 * 60 * 60 * 50, likes: [], comments: [{ author: "Lucas", text: "Um tênis de trail com boa sola já resolve no começo!", at: now - 1000 * 60 * 60 * 48 }] },
      ],
    };
  }

  // ---------- Validação do que vem do navegador ----------
  // O localStorage pode estar corrompido, ser de uma versão antiga ou ter sido editado à mão:
  // tudo é conferido e limitado antes de ser usado.
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  const isStr = (v) => typeof v === "string" && v.trim() !== "";
  const int = (v, min, max, def) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, Math.round(+v))) : def);
  const time = (v) => (Number.isFinite(v) ? v : Date.now());

  function clean(data) {
    if (!data || typeof data !== "object") return null;
    const user = data.user && isStr(data.user.name)
      ? { name: str(data.user.name, 40).trim(), city: str(data.user.city, 60).trim() } : null;
    const events = arr(data.events)
      .filter((e) => e && isStr(e.id) && isStr(e.trailId) && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && isStr(e.host))
      .map((e) => ({
        id: str(e.id, 40), trailId: str(e.trailId, 60), date: e.date,
        time: /^\d{2}:\d{2}$/.test(e.time) ? e.time : "07:00",
        slots: int(e.slots, 2, 50, 10), meet: str(e.meet, 120), desc: str(e.desc, 500), host: str(e.host, 40),
        attendees: [...new Set(arr(e.attendees).filter(isStr).map((a) => a.slice(0, 40)))],
      }));
    const posts = arr(data.posts)
      .filter((p) => p && isStr(p.id) && isStr(p.author) && isStr(p.text))
      .map((p) => ({
        id: str(p.id, 40), author: str(p.author, 40), trailId: str(p.trailId, 60), text: str(p.text, 1000), at: time(p.at),
        likes: [...new Set(arr(p.likes).filter(isStr).map((a) => a.slice(0, 40)))],
        comments: arr(p.comments).filter((c) => c && isStr(c.author) && isStr(c.text))
          .map((c) => ({ author: str(c.author, 40), text: str(c.text, 300), at: time(c.at) })),
      }));
    const cart = arr(data.cart).filter((i) => i && isStr(i.id)).map((i) => ({ id: str(i.id, 40), qty: int(i.qty, 1, 10, 1) }));
    const orders = arr(data.orders).filter((o) => o && isStr(o.id) && Number.isFinite(o.total) && Array.isArray(o.items))
      .map((o) => ({
        id: str(o.id, 20), at: time(o.at), total: o.total, payment: str(o.payment, 20),
        items: o.items.filter((i) => i && Number.isFinite(i.qty)).map((i) => ({ id: str(i.id, 40), qty: int(i.qty, 1, 10, 1) })),
      }));
    const knownTrails = data.knownTrails && typeof data.knownTrails === "object" && !Array.isArray(data.knownTrails) ? data.knownTrails : {};
    return { user, events, posts, cart, orders, knownTrails };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = clean(JSON.parse(raw));
        if (data) return data;
      }
    } catch (_) { /* storage indisponível ou JSON inválido */ }
    return { ...seed(), cart: [], orders: [], knownTrails: {} };
  }

  const state = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignora */ }
  }

  window.Store = { state, save, uid, localISO };
})();
