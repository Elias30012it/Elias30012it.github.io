// Catálogo de trilhas. Coordenadas aproximadas do início da trilha.
// km = distância total (ida e volta), elevation = ganho de elevação (m), hours = duração média.
window.TRAILS = [
  // São Paulo
  { id: "pedra-grande", name: "Pedra Grande", city: "Atibaia", uf: "SP", lat: -23.1437, lng: -46.5338, km: 7, elevation: 600, hours: 3, difficulty: "Moderada", tags: ["mirante", "voo livre"], desc: "Subida por estrada de terra e trilha até o topo, com vista de Atibaia e da rampa de voo livre." },
  { id: "pico-jaragua", name: "Pico do Jaraguá", city: "São Paulo", uf: "SP", lat: -23.4565, lng: -46.7663, km: 4, elevation: 300, hours: 2, difficulty: "Fácil", tags: ["urbana", "mirante"], desc: "Ponto mais alto da capital paulista, com trilha sombreada pela Mata Atlântica." },
  { id: "cantareira-pedra-grande", name: "Trilha da Pedra Grande (Cantareira)", city: "São Paulo", uf: "SP", lat: -23.4560, lng: -46.6350, km: 9, elevation: 250, hours: 3, difficulty: "Fácil", tags: ["urbana", "mata atlântica"], desc: "Caminhada por estrada de serviço no Parque Estadual da Cantareira até o mirante da Pedra Grande." },
  { id: "pedra-do-bau", name: "Pedra do Baú", city: "São Bento do Sapucaí", uf: "SP", lat: -22.6866, lng: -45.6720, km: 6, elevation: 450, hours: 4, difficulty: "Difícil", tags: ["via ferrata", "mirante"], desc: "Trilha seguida de escadaria de ferro (via ferrata) até o topo da Pedra do Baú." },
  { id: "pico-dos-marins", name: "Pico dos Marins", city: "Piquete", uf: "SP", lat: -22.5070, lng: -45.1316, km: 14, elevation: 1100, hours: 10, difficulty: "Difícil", tags: ["camping", "montanha"], desc: "Clássica da Mantiqueira, com trechos de escalaminhada e opção de acampamento." },
  { id: "pico-itapeva", name: "Pico do Itapeva", city: "Campos do Jordão", uf: "SP", lat: -22.7629, lng: -45.5241, km: 2, elevation: 80, hours: 1, difficulty: "Fácil", tags: ["mirante", "família"], desc: "Mirante acessível com vista do Vale do Paraíba." },
  { id: "pedra-da-macela", name: "Pedra da Macela", city: "Cunha", uf: "SP", lat: -23.0550, lng: -44.8740, km: 6, elevation: 450, hours: 3, difficulty: "Moderada", tags: ["nascer do sol", "mar"], desc: "Subida íngreme por estrada de concreto até o mirante com vista para Paraty e a baía da Ilha Grande." },

  // Rio de Janeiro
  { id: "pedra-da-gavea", name: "Pedra da Gávea", city: "Rio de Janeiro", uf: "RJ", lat: -22.9975, lng: -43.2847, km: 5, elevation: 844, hours: 6, difficulty: "Difícil", tags: ["escalaminhada", "mar"], desc: "Uma das trilhas mais conhecidas do Rio, com o trecho de escalada da Carrasqueira." },
  { id: "dois-irmaos", name: "Morro Dois Irmãos", city: "Rio de Janeiro", uf: "RJ", lat: -22.9877, lng: -43.2420, km: 3, elevation: 300, hours: 2, difficulty: "Fácil", tags: ["mar", "pôr do sol"], desc: "Início no Vidigal, com vista de Ipanema, Leblon e da Lagoa." },
  { id: "pedra-bonita", name: "Pedra Bonita", city: "Rio de Janeiro", uf: "RJ", lat: -22.9875, lng: -43.2810, km: 2.5, elevation: 150, hours: 1, difficulty: "Fácil", tags: ["voo livre", "mirante"], desc: "Trilha curta no Parque Nacional da Tijuca, com vista da Pedra da Gávea e de São Conrado." },
  { id: "pico-da-tijuca", name: "Pico da Tijuca", city: "Rio de Janeiro", uf: "RJ", lat: -22.9437, lng: -43.2852, km: 6, elevation: 400, hours: 3, difficulty: "Moderada", tags: ["mata atlântica", "mirante"], desc: "Subida pela floresta da Tijuca, terminando em degraus esculpidos na rocha." },

  // Minas Gerais
  { id: "pico-bandeira", name: "Pico da Bandeira", city: "Alto Caparaó", uf: "MG", lat: -20.4340, lng: -41.7966, km: 18, elevation: 1200, hours: 9, difficulty: "Difícil", tags: ["nascer do sol", "camping"], desc: "Terceiro ponto mais alto do Brasil, conhecido pelo nascer do sol acima das nuvens." },
  { id: "cachoeira-farofa", name: "Cachoeira da Farofa", city: "Santana do Riacho", uf: "MG", lat: -19.3530, lng: -43.6025, km: 16, elevation: 250, hours: 5, difficulty: "Moderada", tags: ["cachoeira", "cerrado"], desc: "Caminhada longa e plana pelo cerrado da Serra do Cipó até a cachoeira." },
  { id: "cachoeira-tabuleiro", name: "Cachoeira do Tabuleiro", city: "Conceição do Mato Dentro", uf: "MG", lat: -19.0690, lng: -43.5560, km: 7, elevation: 350, hours: 4, difficulty: "Moderada", tags: ["cachoeira", "poço"], desc: "Descida até o poço da maior cachoeira de Minas Gerais, com 273 m de queda." },

  // Paraná
  { id: "anhangava", name: "Morro do Anhangava", city: "Quatro Barras", uf: "PR", lat: -25.3889, lng: -49.0058, km: 5, elevation: 400, hours: 3, difficulty: "Moderada", tags: ["mirante", "escalada"], desc: "Trilha popular perto de Curitiba, com vista para a Serra do Mar." },
  { id: "pico-parana", name: "Pico Paraná", city: "Campina Grande do Sul", uf: "PR", lat: -25.2547, lng: -48.8106, km: 20, elevation: 1300, hours: 12, difficulty: "Difícil", tags: ["camping", "montanha"], desc: "Ponto mais alto do Sul do Brasil, geralmente feito em dois dias." },

  // Santa Catarina
  { id: "lagoinha-leste", name: "Lagoinha do Leste", city: "Florianópolis", uf: "SC", lat: -27.7716, lng: -48.4885, km: 8, elevation: 250, hours: 3, difficulty: "Moderada", tags: ["praia", "mar"], desc: "Trilha a partir do Pântano do Sul até uma praia isolada com lagoa." },
  { id: "costa-da-lagoa", name: "Costa da Lagoa", city: "Florianópolis", uf: "SC", lat: -27.5700, lng: -48.4560, km: 8, elevation: 150, hours: 3, difficulty: "Fácil", tags: ["lagoa", "histórica"], desc: "Caminho histórico pela margem da Lagoa da Conceição. Dá para voltar de barco." },

  // Bahia
  { id: "cachoeira-fumaca", name: "Cachoeira da Fumaça", city: "Palmeiras", uf: "BA", lat: -12.5961, lng: -41.4689, km: 12, elevation: 350, hours: 5, difficulty: "Moderada", tags: ["cachoeira", "chapada"], desc: "Saída do Vale do Capão até o mirante da cachoeira de 340 m na Chapada Diamantina." },
  { id: "pai-inacio", name: "Morro do Pai Inácio", city: "Palmeiras", uf: "BA", lat: -12.4580, lng: -41.4730, km: 1.5, elevation: 120, hours: 1, difficulty: "Fácil", tags: ["pôr do sol", "chapada"], desc: "Subida curta até o topo plano do cartão-postal da Chapada Diamantina." },
  { id: "vale-do-pati", name: "Vale do Pati", city: "Mucugê", uf: "BA", lat: -12.7716, lng: -41.5413, km: 60, elevation: 1500, hours: 72, difficulty: "Difícil", tags: ["travessia", "chapada"], desc: "Travessia de vários dias, considerada uma das mais bonitas do país." },

  // Goiás
  { id: "saltos-rio-preto", name: "Saltos do Rio Preto", city: "Alto Paraíso de Goiás", uf: "GO", lat: -14.1714, lng: -47.8188, km: 11, elevation: 300, hours: 5, difficulty: "Moderada", tags: ["cachoeira", "chapada"], desc: "Trilha no Parque Nacional da Chapada dos Veadeiros até saltos de 80 e 120 m." },
];
