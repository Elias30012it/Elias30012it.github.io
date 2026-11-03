// Persistência simples em localStorage. Para produção, troque por uma API/back-end.
(function () {
  const KEY = "pumping-life:v2";

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
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

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* storage indisponível */ }
    return seed();
  }

  const state = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignora */ }
  }

  window.Store = { state, save, uid };
})();
