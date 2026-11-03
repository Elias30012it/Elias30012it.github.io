# Pumping Life · Trilhas

Site de trilhas com comunidade, agendamento de saídas em grupo e busca de trilhas próximas.

## Funcionalidades

- **Explorar** — trilhas agrupadas por estado e cidade, com filtros de estado, cidade, dificuldade, nome e raio de distância (km). Mapa do Brasil com os contornos reais dos 27 estados: clique num estado para filtrar; zoom pelos botões, roda do mouse ou pinça (a página em si não amplia). Busca por cidade ou pela localização do aparelho, ordenando pela distância.
- **Agenda** — agende uma saída para qualquer trilha (data, horário, vagas, ponto de encontro), participe ou saia de saídas de outras pessoas, veja "Próximas", "Minhas" e "Passadas".
- **Comunidade** — feed com publicações, curtidas e comentários; dá para marcar a trilha no post.
- **Perfil** — nome e cidade, pedido na primeira ação que precisa de usuário.

## Como rodar

É um site estático, sem build. Sirva a pasta com qualquer servidor:

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000.

## Estrutura

```
index.html      páginas (abas) e modais
css/style.css   estilos (claro/escuro, responsivo) — identidade de placa turística marrom + verde
js/data.js      catálogo de trilhas (cidade + UF) e cidades para busca
js/brazil-geo.js contornos dos estados (gerado por tools/build-geo.py)
js/map.js       mapa SVG com zoom/arraste
js/store.js     persistência (localStorage) + dados iniciais
js/app.js       lógica: mapa, busca por proximidade, agenda, comunidade
```

## Próximos passos

Hoje os dados ficam no `localStorage` do navegador, então cada pessoa vê só o que criou nela mesma.
Para virar uma comunidade real, troque `js/store.js` por uma API com banco de dados
(ex.: Supabase/Firebase ou um back-end Node/Python) e adicione login.

## Mapa

Os contornos vêm do Natural Earth (domínio público), via pacotes npm `datamaps` (estados) e `world-atlas` (países vizinhos).
Para regenerar, veja as instruções no topo de `tools/build-geo.py`.
