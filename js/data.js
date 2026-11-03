// Trilhas de exemplo (coordenadas aproximadas do início da trilha).
window.TRAILS = [
  { id: "pedra-grande", name: "Pedra Grande", city: "Atibaia, SP", lat: -23.1437, lng: -46.5338, km: 7, elevation: 600, hours: 3, difficulty: "Moderada", tags: ["mirante", "voo livre"], desc: "Subida por estrada de terra e trilha até o topo com vista panorâmica de Atibaia e rampa de voo livre." },
  { id: "pico-jaragua", name: "Pico do Jaraguá", city: "São Paulo, SP", lat: -23.4565, lng: -46.7663, km: 4, elevation: 300, hours: 2, difficulty: "Fácil", tags: ["urbana", "mirante"], desc: "Ponto mais alto da capital paulista, com trilha sombreada pela Mata Atlântica." },
  { id: "pedra-do-bau", name: "Pedra do Baú", city: "São Bento do Sapucaí, SP", lat: -22.6866, lng: -45.6720, km: 6, elevation: 450, hours: 4, difficulty: "Difícil", tags: ["via ferrata", "mirante"], desc: "Trilha seguida de escadaria de ferro (via ferrata) até o topo da Pedra do Baú." },
  { id: "pico-dos-marins", name: "Pico dos Marins", city: "Piquete, SP", lat: -22.5070, lng: -45.1316, km: 14, elevation: 1100, hours: 10, difficulty: "Difícil", tags: ["camping", "montanha"], desc: "Clássica travessia da Mantiqueira, com trechos de escalaminhada e acampamento." },
  { id: "pico-itapeva", name: "Pico do Itapeva", city: "Campos do Jordão, SP", lat: -22.7629, lng: -45.5241, km: 2, elevation: 80, hours: 1, difficulty: "Fácil", tags: ["mirante", "família"], desc: "Mirante acessível com vista do Vale do Paraíba." },
  { id: "pedra-da-gavea", name: "Pedra da Gávea", city: "Rio de Janeiro, RJ", lat: -22.9975, lng: -43.2847, km: 5, elevation: 844, hours: 6, difficulty: "Difícil", tags: ["escalaminhada", "mar"], desc: "Uma das trilhas mais icônicas do Rio, com trecho de escalada (Carrasqueira)." },
  { id: "dois-irmaos", name: "Morro Dois Irmãos", city: "Rio de Janeiro, RJ", lat: -22.9877, lng: -43.2420, km: 3, elevation: 300, hours: 2, difficulty: "Fácil", tags: ["mar", "pôr do sol"], desc: "Início no Vidigal, vista clássica de Ipanema, Leblon e Lagoa." },
  { id: "pico-bandeira", name: "Pico da Bandeira", city: "Alto Caparaó, MG", lat: -20.4340, lng: -41.7966, km: 18, elevation: 1200, hours: 9, difficulty: "Difícil", tags: ["nascer do sol", "camping"], desc: "Terceiro ponto mais alto do Brasil, famoso pelo nascer do sol acima das nuvens." },
  { id: "serra-do-cipo", name: "Cachoeira da Farofa", city: "Serra do Cipó, MG", lat: -19.3530, lng: -43.6025, km: 16, elevation: 250, hours: 5, difficulty: "Moderada", tags: ["cachoeira", "cerrado"], desc: "Caminhada longa e plana pelo cerrado até uma bela cachoeira." },
  { id: "anhangava", name: "Morro do Anhangava", city: "Quatro Barras, PR", lat: -25.3889, lng: -49.0058, km: 5, elevation: 400, hours: 3, difficulty: "Moderada", tags: ["mirante", "escalada"], desc: "Trilha popular perto de Curitiba, com vista para a Serra do Mar." },
  { id: "pico-parana", name: "Pico Paraná", city: "Campina Grande do Sul, PR", lat: -25.2547, lng: -48.8106, km: 20, elevation: 1300, hours: 12, difficulty: "Difícil", tags: ["camping", "montanha"], desc: "Ponto culminante do Sul do Brasil, geralmente feito em dois dias." },
  { id: "cachoeira-fumaca", name: "Cachoeira da Fumaça", city: "Vale do Capão, BA", lat: -12.5961, lng: -41.4689, km: 12, elevation: 350, hours: 5, difficulty: "Moderada", tags: ["cachoeira", "chapada"], desc: "Mirante da cachoeira de 340 m na Chapada Diamantina." },
  { id: "vale-do-pati", name: "Vale do Pati", city: "Guiné, BA", lat: -12.7716, lng: -41.5413, km: 60, elevation: 1500, hours: 72, difficulty: "Difícil", tags: ["travessia", "chapada"], desc: "Travessia de vários dias, considerada uma das mais bonitas do país." },
  { id: "lagoinha-leste", name: "Lagoinha do Leste", city: "Florianópolis, SC", lat: -27.7716, lng: -48.4885, km: 8, elevation: 250, hours: 3, difficulty: "Moderada", tags: ["praia", "mar"], desc: "Trilha pelo Pântano do Sul até uma praia isolada com lagoa." },
  { id: "chapada-veadeiros", name: "Saltos do Rio Preto", city: "Alto Paraíso de Goiás, GO", lat: -14.1714, lng: -47.8188, km: 11, elevation: 300, hours: 5, difficulty: "Moderada", tags: ["cachoeira", "chapada"], desc: "Trilha no Parque Nacional da Chapada dos Veadeiros até saltos de 80 e 120 m." },
];

// Cidades conhecidas, usadas como fallback quando a busca on-line falha.
window.CITIES = {
  "sao paulo": [-23.5505, -46.6333], "campinas": [-22.9099, -47.0626], "rio de janeiro": [-22.9068, -43.1729],
  "belo horizonte": [-19.9167, -43.9345], "curitiba": [-25.4284, -49.2733], "florianopolis": [-27.5954, -48.548],
  "salvador": [-12.9777, -38.5016], "brasilia": [-15.7939, -47.8828], "goiania": [-16.6869, -49.2648],
  "porto alegre": [-30.0346, -51.2177], "vitoria": [-20.3155, -40.3128], "sao jose dos campos": [-23.1896, -45.8841],
  "atibaia": [-23.1171, -46.5563], "campos do jordao": [-22.7394, -45.5914],
};
