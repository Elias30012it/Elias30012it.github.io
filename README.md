# Pumping Life · Trilhas

Site de trilhas com comunidade, agendamento de saídas em grupo e busca de trilhas próximas.

## Funcionalidades

- **Explorar** — mapa (Leaflet + OpenStreetMap) com as trilhas; busca por cidade ou pela sua localização (GPS do navegador), raio ajustável, filtro por dificuldade e por nome. A lista é ordenada pela distância até você.
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
css/style.css   estilos (claro/escuro, responsivo)
js/data.js      catálogo de trilhas de exemplo
js/store.js     persistência (localStorage) + dados iniciais
js/app.js       lógica: mapa, busca por proximidade, agenda, comunidade
```

## Próximos passos

Hoje os dados ficam no `localStorage` do navegador, então cada pessoa vê só o que criou nela mesma.
Para virar uma comunidade real, troque `js/store.js` por uma API com banco de dados
(ex.: Supabase/Firebase ou um back-end Node/Python) e adicione login.
