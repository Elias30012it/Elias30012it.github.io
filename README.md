# Pumping Life · Trilhas

Site de trilhas com comunidade, agendamento de saídas em grupo e busca de trilhas próximas.

## Funcionalidades

- **Explorar** — trilhas agrupadas por estado e cidade, com filtros de estado, cidade, dificuldade, nome e raio de distância (km). Mapa do Brasil com os contornos reais dos 27 estados: clique num estado para filtrar; zoom pelos botões, roda do mouse ou pinça (a página em si não amplia). Busca por cidade ou pela localização do aparelho, ordenando pela distância.
- **Agenda** — agende uma saída para qualquer trilha (data, horário, vagas, ponto de encontro), participe ou saia de saídas de outras pessoas, veja "Próximas", "Minhas" e "Passadas".
- **Comunidade** — feed com publicações, curtidas e comentários; dá para marcar a trilha no post.
- **Loja** — equipamentos para trilha com categorias, carrinho, frete grátis acima de R$ 299, parcelamento e checkout. A loja ainda não processa pagamentos: o pedido fica registrado como reserva. Cada trilha sugere equipamentos conforme a dificuldade.
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
js/data.js      trilhas da curadoria (cidade + UF)
js/trails-osm.js trilhas do OpenStreetMap (gerado por tools/fetch-osm-trails.py)
js/municipios.js 5.570 municípios do IBGE para a busca (gerado por tools/build-municipios.py)
data/municipios.csv base de municípios (IBGE, via kelvins/municipios-brasileiros, MIT)
js/brazil-geo.js contornos dos estados (gerado por tools/build-geo.py)
js/map.js       mapa SVG com zoom/arraste, ficha ao passar o mouse
js/fx.js        paisagens geradas por trilha, curvas de nível, contadores e animações
js/shop.js      catálogo da loja; js/shop-art.js ilustrações cartoon dos produtos
js/osm-live.js  busca ao vivo no OpenStreetMap (só quando js/trails-osm.js está vazio)
js/store.js     persistência (localStorage) com validação + dados iniciais
js/app.js       lógica: lista, filtros, agenda, comunidade, loja
```

## Segurança

- Todo texto vindo de fora (OpenStreetMap, o que o usuário digita, dados salvos no navegador) é escapado antes
  de entrar no HTML. Trilhas passam por `cleanTrail` (id, sigla, coordenadas, números e link do OSM validados)
  e o `localStorage` é validado e limitado em `store.js`; dados corrompidos ou adulterados são descartados.
- `index.html` tem Content-Security-Policy: só scripts do próprio site, conexões apenas para as fontes e os
  serviços do OpenStreetMap. Links externos usam `noopener noreferrer`.
- O checkout não pede dados de cartão e não guarda e-mail nem endereço no navegador.
- Limitações conhecidas: não há login (o "perfil" é só um nome salvo no navegador) e os dados ficam em cada
  navegador. Antes de ligar um back-end compartilhado é preciso autenticação, validação no servidor e
  moderação. O bloqueio de zoom da página foi pedido no projeto, mas dificulta a leitura para quem precisa ampliar.

## Próximos passos

Hoje os dados ficam no `localStorage` do navegador, então cada pessoa vê só o que criou nela mesma.
Para virar uma comunidade real, troque `js/store.js` por uma API com banco de dados
(ex.: Supabase/Firebase ou um back-end Node/Python) e adicione login.

## Mapa

Os contornos vêm do Natural Earth (domínio público), via pacotes npm `datamaps` (estados) e `world-atlas` (países vizinhos).
Para regenerar, veja as instruções no topo de `tools/build-geo.py`.

## Trilhas do OpenStreetMap

O catálogo junta as trilhas da curadoria (`js/data.js`) com todas as trilhas do Brasil mapeadas no
OpenStreetMap: rotas `route=hiking`/`route=foot` e caminhos chamados "Trilha…", "Travessia…" ou "Caminho…".
Para cada uma o script calcula a distância pelo traçado e descobre estado e cidade.

```bash
python3 tools/fetch-osm-trails.py --save-raw osm.json > js/trails-osm.js
```

Por padrão usa o QLever (`qlever.dev`, consultas sobre o OSM inteiro) e leva cerca de 1 minuto; `--source overpass` usa a API Overpass.
Nomes genéricos ("Trilha de ligação", "Acesso…") e trechos com menos de 400 m são descartados, e trechos de uma mesma trilha são unidos. Rode de novo de tempos em tempos para atualizar.

Enquanto `js/trails-osm.js` estiver vazio, o site busca as trilhas direto no OpenStreetMap pelo navegador do
visitante (`js/osm-live.js`): ao escolher uma cidade (raio de até 80 km) ou um estado. O resultado fica em cache
no navegador por 7 dias.
Dados © colaboradores do OpenStreetMap, licença ODbL (atribuição no rodapé do site).
