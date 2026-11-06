// Catálogo da loja. Preços em reais; as ilustrações ficam em js/shop-art.js (chave em `icon`).
window.SHOP_PRODUCTS = [
  { id: "mochila-30", name: "Mochila de ataque 30 L", cat: "Mochilas", price: 289.9, icon: "backpack",
    desc: "Para trilhas de um dia. Costas ventiladas, capa de chuva integrada e bolsos laterais para garrafa.",
    specs: ["30 L", "1,1 kg", "Capa de chuva"] },
  { id: "mochila-65", name: "Mochila cargueira 55+10 L", cat: "Mochilas", price: 649.9, icon: "cargo",
    desc: "Para travessias e acampamento. Barrigueira acolchoada, regulagem de altura nas costas e acesso frontal.",
    specs: ["65 L", "1,9 kg", "Ajuste de torso"] },
  { id: "bastoes", name: "Par de bastões de caminhada", cat: "Acessórios", price: 179.9, icon: "poles",
    desc: "Alumínio com trava rápida e ajuste de 65 a 135 cm. Aliviam o joelho nas descidas.",
    specs: ["65–135 cm", "480 g o par", "Ponteira de tungstênio"] },
  { id: "garrafa", name: "Garrafa térmica 1 L", cat: "Hidratação", price: 119.9, icon: "bottle",
    desc: "Aço inox de parede dupla. Mantém a água gelada por até 24 h.",
    specs: ["1 L", "Inox", "24 h gelada"] },
  { id: "lanterna", name: "Lanterna de cabeça 300 lúmens", cat: "Iluminação", price: 139.9, icon: "headlamp",
    desc: "Recarregável por USB-C, modo de luz vermelha e resistente à chuva. Essencial para nascer do sol.",
    specs: ["300 lm", "USB-C", "IPX4"] },
  { id: "kit-socorro", name: "Kit de primeiros socorros", cat: "Segurança", price: 89.9, icon: "firstaid",
    desc: "Curativos, gaze, esparadrapo, bandagem, manta térmica e apito, em estojo impermeável.",
    specs: ["32 itens", "Manta térmica", "Estojo à prova d'água"] },
  { id: "jaqueta", name: "Jaqueta corta-vento impermeável", cat: "Vestuário", price: 329.9, icon: "jacket",
    desc: "Membrana respirável, costuras seladas e capuz ajustável. Dobra dentro do próprio bolso.",
    specs: ["Coluna d'água 10.000 mm", "320 g", "Capuz ajustável"] },
  { id: "meias", name: "Meias de trilha (2 pares)", cat: "Vestuário", price: 69.9, icon: "socks",
    desc: "Cano médio com reforço no calcanhar e na ponta. Secam rápido e reduzem bolhas.",
    specs: ["2 pares", "Lã merino e poliamida", "Cano médio"] },
  { id: "bota", name: "Bota de trilha impermeável", cat: "Calçados", price: 499.9, icon: "boot",
    desc: "Cano médio, solado com cravos profundos e forro impermeável. Boa para lama e pedra.",
    specs: ["Cano médio", "Impermeável", "Solado de borracha"] },
  { id: "chapeu", name: "Chapéu com proteção UV 50+", cat: "Vestuário", price: 79.9, icon: "hat",
    desc: "Aba larga, cordão de ajuste e tecido que seca rápido.",
    specs: ["FPU 50+", "Aba de 7 cm", "Leve"] },
  { id: "bussola", name: "Bússola com espelho", cat: "Navegação", price: 74.9, icon: "compass",
    desc: "Base transparente com régua, espelho de mira e ajuste de declinação. Funciona sem bateria.",
    specs: ["Declinação ajustável", "Régua 1:25.000", "Cordão"] },
  { id: "fogareiro", name: "Fogareiro compacto a gás", cat: "Acampamento", price: 159.9, icon: "stove",
    desc: "Acendimento automático e regulagem de chama. Ferve 1 L de água em cerca de 4 minutos.",
    specs: ["Acendedor automático", "85 g", "Estojo incluso"] },
];

// Sugestões da loja no detalhe de cada trilha, conforme a dificuldade.
window.SHOP_FOR_DIFFICULTY = {
  "Fácil": ["garrafa", "chapeu", "kit-socorro"],
  "Moderada": ["mochila-30", "bastoes", "lanterna"],
  "Difícil": ["bota", "jaqueta", "lanterna"],
};

// Regras da loja
window.SHOP_RULES = {
  freeShippingFrom: 299,
  shipping: [
    { id: "economica", label: "Econômica", days: "7 a 10 dias úteis", price: 24.9 },
    { id: "expressa", label: "Expressa", days: "2 a 4 dias úteis", price: 39.9 },
  ],
  installmentsFrom: 150,
  maxInstallments: 3,
};
