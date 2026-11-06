// Ilustrações em estilo cartoon dos produtos da loja (SVG, viewBox 0 0 120 120).
// Contorno grosso marrom-escuro, cores chapadas da paleta do site, brilho e sombra no chão.
(function () {
  const C = {
    ink: "#2b1c10", green: "#4f7a45", greenDk: "#3d6236", greenLt: "#7aa868", rust: "#b5532e", rustDk: "#8f3f22",
    rustLt: "#d9764b", ochre: "#e2b04a", ochreDk: "#c48f2c", cream: "#f4ecdc", red: "#c8442f", teal: "#4a8c8c",
    tealDk: "#2f5f5f", steel: "#b9c0c6", steelDk: "#7b858d", brown: "#8a5a33", brownDk: "#5e3b20", sand: "#d8b77c", sandDk: "#c19b5c",
  };
  const shadow = (rx = 34) => `<ellipse cx="60" cy="106" rx="${rx}" ry="5" fill="${C.ink}" opacity=".16" stroke="none"/>`;
  const shine = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="4" opacity=".55"/>`;

  window.SHOP_ART = {
    backpack: `${shadow()}
      <path d="M48 30 Q60 12 72 30" fill="none" stroke-width="5"/>
      <rect x="22" y="52" width="12" height="36" rx="6" fill="${C.greenDk}"/>
      <rect x="86" y="52" width="12" height="36" rx="6" fill="${C.greenDk}"/>
      <rect x="30" y="30" width="60" height="72" rx="20" fill="${C.green}"/>
      <path d="M30 54 Q30 28 60 28 Q90 28 90 54 Q60 62 30 54 Z" fill="${C.greenDk}"/>
      <rect x="54" y="48" width="12" height="13" rx="3" fill="${C.ochre}"/>
      <rect x="40" y="66" width="40" height="28" rx="9" fill="${C.greenLt}"/>
      <path d="M46 74 H74" stroke-width="2.5"/>
      <circle cx="74" cy="74" r="2.5" fill="${C.ochre}"/>
      ${shine("M37 46 Q39 37 47 34")}`,

    cargo: `${shadow(38)}
      <rect x="34" y="20" width="52" height="78" rx="16" fill="${C.rust}"/>
      <path d="M34 40 Q34 16 60 16 Q86 16 86 40 Q60 46 34 40 Z" fill="${C.rustDk}"/>
      <rect x="42" y="48" width="36" height="30" rx="8" fill="${C.rustLt}"/>
      <path d="M44 58 H76" stroke-width="2.5"/>
      <path d="M34 84 H86" stroke-width="2.5"/>
      <rect x="22" y="90" width="76" height="16" rx="8" fill="${C.ochre}"/>
      <path d="M38 92 V104 M82 92 V104" stroke-width="3"/>
      <rect x="55" y="34" width="10" height="10" rx="2" fill="${C.ochre}"/>
      ${shine("M40 32 Q42 25 49 22")}`,

    poles: `${shadow(30)}
      <path d="M42 20 L66 102" stroke-width="10"/><path d="M42 20 L66 102" stroke="${C.steel}" stroke-width="4.5"/>
      <path d="M78 20 L54 102" stroke-width="10"/><path d="M78 20 L54 102" stroke="${C.steel}" stroke-width="4.5"/>
      <rect x="33" y="10" width="14" height="26" rx="6" fill="${C.green}" transform="rotate(-16 40 23)"/>
      <rect x="73" y="10" width="14" height="26" rx="6" fill="${C.rust}" transform="rotate(16 80 23)"/>
      <ellipse cx="63" cy="92" rx="9" ry="3.5" fill="${C.ochre}" transform="rotate(-16 63 92)"/>
      <ellipse cx="57" cy="92" rx="9" ry="3.5" fill="${C.ochre}" transform="rotate(16 57 92)"/>
      <path d="M36 15 Q40 12 44 14" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>`,

    bottle: `${shadow(24)}
      <path d="M50 16 Q60 4 70 16" fill="none" stroke-width="5"/>
      <rect x="46" y="16" width="28" height="18" rx="6" fill="${C.tealDk}"/>
      <rect x="40" y="32" width="40" height="72" rx="14" fill="${C.teal}"/>
      <rect x="40" y="56" width="40" height="14" fill="${C.ochre}"/>
      <path d="M52 60 L56 66 L60 60 L64 66 L68 60" fill="none" stroke-width="2.5"/>
      ${shine("M48 42 V52 M48 78 V94")}`,

    headlamp: `${shadow(40)}
      <path d="M14 72 Q14 36 60 36 Q106 36 106 72" fill="none" stroke-width="12"/>
      <path d="M14 72 Q14 36 60 36 Q106 36 106 72" fill="none" stroke="${C.ochre}" stroke-width="6"/>
      <path d="M78 64 L112 50 L112 96 L78 82 Z" fill="#ffe28a" opacity=".6" stroke="none"/>
      <rect x="40" y="54" width="40" height="36" rx="12" fill="${C.rust}"/>
      <circle cx="60" cy="72" r="11" fill="#fff6cf"/>
      <circle cx="60" cy="72" r="5" fill="#ffe28a" stroke-width="2.5"/>
      <rect x="54" y="48" width="12" height="8" rx="3" fill="${C.rustDk}"/>
      ${shine("M46 62 Q47 58 51 57")}`,

    firstaid: `${shadow(40)}
      <path d="M46 40 V30 Q46 24 52 24 H68 Q74 24 74 30 V40" fill="none" stroke-width="5"/>
      <rect x="20" y="38" width="80" height="62" rx="12" fill="${C.red}"/>
      <path d="M20 54 H100" stroke-width="2.5"/>
      <path d="M54 58 H66 V68 H76 V80 H66 V90 H54 V80 H44 V68 H54 Z" fill="${C.cream}"/>
      <rect x="54" y="48" width="12" height="9" rx="2" fill="${C.ochre}"/>
      ${shine("M28 46 Q30 42 36 42")}`,

    jacket: `${shadow(38)}
      <path d="M40 22 L24 30 L14 74 L28 79 L30 102 H90 L92 79 L106 74 L96 30 L80 22 Q60 34 40 22 Z" fill="${C.ochre}"/>
      <path d="M40 22 Q46 12 60 12 Q74 12 80 22 Q60 34 40 22 Z" fill="${C.ochreDk}"/>
      <path d="M60 30 V102" stroke-width="3"/>
      <path d="M38 60 H52 M68 60 H82" stroke-width="3"/>
      <path d="M14 74 L28 79 L27 86 L13 81 Z" fill="${C.rust}"/>
      <path d="M106 74 L92 79 L93 86 L107 81 Z" fill="${C.rust}"/>
      <path d="M30 94 H90 V102 H30 Z" fill="${C.rust}"/>
      ${shine("M32 40 Q34 34 40 32")}`,

    socks: `${shadow(36)}
      <path d="M56 12 H78 V54 L92 66 Q102 76 94 88 Q86 98 74 90 L56 76 Q50 72 52 64 Z" fill="${C.green}"/>
      <path d="M56 18 H78 V26 H56 Z" fill="${C.cream}"/>
      <path d="M28 20 H52 V62 L68 76 Q78 86 70 98 Q62 106 50 98 L30 82 Q24 78 26 70 Z" fill="${C.cream}"/>
      <path d="M28 26 H52 V34 H28 Z M28 40 H52 V46 H28 Z" fill="${C.rust}"/>
      <path d="M52 92 Q60 94 66 88 Q72 92 70 98 Q62 106 50 98 Z" fill="${C.rust}"/>
      ${shine("M33 52 V62")}`,

    boot: `${shadow(42)}
      <rect x="30" y="12" width="34" height="12" rx="5" fill="${C.rust}"/>
      <path d="M32 22 H62 V56 L86 64 Q100 68 100 82 V90 H22 V60 Z" fill="${C.brown}"/>
      <path d="M62 56 L86 64 Q100 68 100 82 V90 H70 Q74 72 62 66 Z" fill="${C.brownDk}"/>
      <path d="M40 32 L54 38 M54 32 L40 38 M40 44 L54 50 M54 44 L40 50" stroke="${C.ochre}" stroke-width="3"/>
      <rect x="18" y="88" width="86" height="14" rx="5" fill="#3a2a1c"/>
      <path d="M30 102 V96 M46 102 V96 M62 102 V96 M78 102 V96 M94 102 V96" stroke="${C.cream}" stroke-width="2.5" opacity=".7"/>
      ${shine("M28 66 V78")}`,

    hat: `${shadow(46)}
      <ellipse cx="60" cy="80" rx="50" ry="15" fill="${C.sandDk}"/>
      <path d="M30 78 Q28 40 60 36 Q92 40 90 78 Q60 86 30 78 Z" fill="${C.sand}"/>
      <path d="M31 66 Q60 74 89 66 L90 76 Q60 84 30 76 Z" fill="${C.green}"/>
      <path d="M60 38 Q56 50 60 62" fill="none" stroke-width="2.5"/>
      <path d="M86 64 Q96 68 98 78" fill="none" stroke-width="2.5"/>
      ${shine("M38 54 Q40 46 46 42")}`,

    compass: `${shadow(36)}
      <circle cx="60" cy="16" r="6" fill="none" stroke-width="4"/>
      <circle cx="60" cy="62" r="42" fill="${C.ochre}"/>
      <circle cx="60" cy="62" r="33" fill="${C.cream}"/>
      <path d="M60 33 V39 M60 85 V91 M31 62 H37 M83 62 H89" stroke-width="3"/>
      <path d="M60 36 L69 62 H51 Z" fill="${C.red}"/>
      <path d="M60 88 L69 62 H51 Z" fill="${C.steelDk}"/>
      <circle cx="60" cy="62" r="4" fill="${C.ochre}"/>
      ${shine("M30 46 Q34 36 44 30")}`,

    stove: `${shadow(30)}
      <path d="M60 8 Q74 24 67 36 Q60 44 53 36 Q46 24 60 8 Z" fill="#f2a33a"/>
      <path d="M60 20 Q66 28 63 34 Q60 38 57 34 Q54 28 60 20 Z" fill="#ffe28a" stroke-width="2"/>
      <path d="M34 42 L44 50 M86 42 L76 50" stroke-width="4"/>
      <ellipse cx="60" cy="46" rx="22" ry="6" fill="${C.steelDk}"/>
      <rect x="52" y="50" width="16" height="14" rx="3" fill="${C.steel}"/>
      <rect x="68" y="54" width="14" height="6" rx="3" fill="${C.rust}"/>
      <rect x="36" y="62" width="48" height="42" rx="15" fill="${C.teal}"/>
      <rect x="36" y="76" width="48" height="10" fill="${C.ochre}"/>
      ${shine("M44 70 V74 M44 92 V96")}`,
  };

  // Brilhinhos decorativos (só na vitrine)
  window.SHOP_SPARKS = `<g stroke="none" fill="${C.ochre}">
    <path d="M14 22 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z" class="spark"/>
    <path d="M104 16 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 z" class="spark s2"/>
  </g>`;
  window.SHOP_ART_INK = C.ink;
})();
