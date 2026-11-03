// Catálogo da loja. Preços em reais; ícones desenhados em SVG (viewBox 0 0 48 48, traço = currentColor).
window.SHOP_ICONS = {
  backpack: '<path d="M16 14v-3a8 8 0 0 1 16 0v3"/><rect x="11" y="14" width="26" height="28" rx="6"/><path d="M17 26h14v9H17z"/><path d="M19 14v5M29 14v5"/>',
  cargo: '<path d="M18 9h12l2 5H16z"/><rect x="12" y="14" width="24" height="29" rx="5"/><path d="M12 24h24M18 30h12v7H18z"/><path d="M8 34h4M36 34h4"/>',
  poles: '<path d="M17 6l-4 37M31 6l4 37"/><path d="M14 6h6M28 6h6"/><path d="M16.2 16h3M28.8 16h3"/><circle cx="13" cy="41" r="2.2"/><circle cx="35" cy="41" r="2.2"/>',
  bottle: '<rect x="19" y="5" width="10" height="6" rx="1.5"/><path d="M17 15a3 3 0 0 1 3-4h8a3 3 0 0 1 3 4v25a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z"/><path d="M17 22h14M17 34h14"/>',
  headlamp: '<path d="M7 24c0-9 7.6-15 17-15s17 6 17 15"/><rect x="16" y="20" width="16" height="12" rx="3"/><circle cx="24" cy="26" r="3"/><path d="M24 36v6M17 38l-3 4M31 38l3 4"/>',
  firstaid: '<rect x="7" y="14" width="34" height="26" rx="4"/><path d="M18 14v-4h12v4"/><path d="M24 21v12M18 27h12"/>',
  jacket: '<path d="M18 7l-9 6-3 18 6 2v10h24V33l6-2-3-18-9-6"/><path d="M18 7l6 6 6-6M24 13v30"/><path d="M15 26h5M28 26h5"/>',
  socks: '<path d="M14 6h11v20l8 7a5 5 0 0 1-6 8l-11-9a6 6 0 0 1-2-4z"/><path d="M14 12h11"/><path d="M27 12h9v13l3 3"/>',
  boot: '<path d="M12 7h14v16l11 5a5 5 0 0 1 3 4.5V37H8V29l4-4z"/><path d="M8 37h32v4H8z"/><path d="M18 12h8M18 17h8M26 23l-5 0"/>',
  hat: '<path d="M14 27c0-9 4-15 10-15s10 6 10 15"/><path d="M4 29c6 4 34 4 40 0-6-2-34-2-40 0z"/><path d="M14 24h20"/>',
  compass: '<circle cx="24" cy="24" r="17"/><path d="M24 10v3M24 35v3M10 24h3M35 24h3"/><path d="M29 19l-3 8-8 3 3-8z"/>',
  stove: '<path d="M14 14h20v6H14z"/><path d="M18 14l6-8 6 8"/><path d="M10 20h28"/><rect x="17" y="24" width="14" height="17" rx="5"/><path d="M14 20l-3 9M34 20l3 9"/>',
};

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
