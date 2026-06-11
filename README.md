# ⚽ BomberBET — Bolão Copa do Mundo 2026

PWA de bolão para a Copa do Mundo FIFA 2026, com sistema de palpites de jogos e mercado de seleções por fase. Desenvolvido para até 10 participantes.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JS puro (SPA, sem framework) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Backend / lógica | Supabase Edge Functions (Deno/TypeScript) |
| Realtime | Supabase Realtime (WebSocket) |
| Hospedagem | Cloudflare Pages |
| PWA | Service Worker + Web App Manifest |

---

## Funcionalidades

### Palpites de jogos
- Palpite de placar para todos os 104 jogos da Copa
- Janela de palpites: abre às **00h01 do dia anterior** ao jogo, fecha às **23h59**
- Palpite automático **0×0** se o prazo for perdido
- Em jogos eliminatórios: dois palpites independentes — **placar aos 90min** e **quem avança**
- Palpites de todos os participantes visíveis após o prazo fechar

### Mercado de seleções
- Antes de cada fase, cada participante recebe **moedas** para comprar seleções
- 48 seleções divididas em 4 prateleiras por ranking FIFA: **S / A / B / C**
- Orçamento: **24 moedas fixas** + bônus variável (0,04 moeda por ponto da fase anterior)
- Preços reajustados dinamicamente ao fim de cada fase com base em desempenho
- Compra automática por rotação S→A→B→C se o prazo for perdido

### Pontuação

| Evento | Pontos |
|---|---|
| Placar exato | 15 pts |
| Vencedor / empate certo | 3 pts |
| Tudo errado | 0 pts |
| Seleção S avança (fase de grupos) | 8 pts |
| Seleção A avança (fase de grupos) | 14 pts |
| Seleção B avança (fase de grupos) | 22 pts |
| Seleção C avança (fase de grupos) | 35 pts |
| *(valores crescem a cada fase)* | ... |

### Rankings
- **Diário** — pontos do dia, reinicia à meia-noite
- **Por fase** — acumulado na fase em curso, congela ao fim de cada fase
- **Geral** — acumulado desde o início da Copa (define o vencedor)
- Atualizados em tempo real via Supabase Realtime

### Painel admin
- Inserir e atualizar placar de jogos a qualquer momento
- Finalizar jogo (calcula pontos de todos os participantes)
- Corrigir resultado já inserido (recalcula pontos automaticamente)
- Encerrar fase (calcula pontos das seleções e abre mercado da próxima fase)
- Criar participantes
- Reset completo (modo de teste)

---

## Estrutura do repositório

```
/
├── index.html        # SPA completa — toda a interface em um único arquivo
├── manifest.json     # PWA manifest
├── sw.js             # Service worker (cache offline)
├── logo_192.png      # Ícone PWA 192×192
└── logo_512.png      # Ícone PWA 512×512
```

---

## Edge Functions (Supabase)

| Função | Descrição |
|---|---|
| `admin-set-result` | Insere / corrige placar de um jogo |
| `process-match-result` | Calcula e insere pontos de todos os usuários para um jogo finalizado |
| `process-phase-end` | Encerra uma fase, pontua seleções e recalcula preços |
| `sync-api-football` | Reservado para integração futura com API de resultados |

---

## Banco de dados (Supabase / PostgreSQL)

Tabelas principais:

| Tabela | Descrição |
|---|---|
| `profiles` | Perfis dos participantes (vinculados ao Supabase Auth) |
| `phases` | 6 fases do torneio com status e prazos de mercado |
| `teams` | 48 seleções com posição ordinal, prateleira e preço |
| `team_prices` | Histórico de preços por seleção por fase |
| `matches` | 104 jogos com kickoff, prazos de palpite e placares |
| `match_picks` | Palpites de cada usuário por jogo |
| `team_purchases` | Compras de seleções por usuário por fase |
| `points_log` | Log imutável de cada evento de pontuação |
| `ranking_daily` | Ranking diário (congelado à meia-noite por pg_cron) |
| `ranking_phase` | Ranking por fase (congelado ao fim de cada fase) |
| `ranking_overall` | Ranking geral acumulado |
| `match_sync_schedule` | Janelas de sincronização geradas automaticamente por trigger |

---

## Configuração

### Pré-requisitos
- Conta no [Supabase](https://supabase.com) (plano gratuito suficiente)
- Conta no [Cloudflare](https://cloudflare.com) (plano gratuito suficiente)

### 1. Supabase

1. Crie um novo projeto no Supabase
2. Execute os arquivos SQL na ordem:
   ```
   bolao_copa_2026_schema.sql
   bolao_copa_2026_seed.sql
   bolao_seed_matches.sql
   bolao_migration_001.sql  →  bolao_migration_011.sql
   ```
3. Faça o deploy das Edge Functions:
   - `admin-set-result`
   - `process-match-result`
   - `process-phase-end`
4. Configure os secrets nas Edge Functions:
   ```
   INTERNAL_SECRET = <string aleatória>
   ```
5. Insira os valores na tabela `app_config`:
   ```sql
   insert into public.app_config (key, value) values
     ('supabase_url',     'https://SEU_PROJECT_ID.supabase.co'),
     ('service_role_key', 'SEU_SERVICE_ROLE_KEY'),
     ('internal_secret',  'SEU_INTERNAL_SECRET');
   ```
6. Crie o bucket `avatars` no Supabase Storage (público)

### 2. Frontend

Abra `index.html` e substitua as credenciais no topo do script:

```js
const SUPABASE_URL  = 'https://SEU_PROJECT_ID.supabase.co'
const SUPABASE_ANON = 'SUA_ANON_KEY'
```

### 3. Cloudflare Pages

1. Crie um novo projeto em **Cloudflare → Pages → Create application**
2. Conecte ao repositório GitHub
3. Build command: *(vazio)*
4. Build output directory: *(vazio)*
5. Deploy

### 4. Primeiro usuário (admin)

1. Crie o usuário em **Supabase → Authentication → Users → Add user**
2. Insira o perfil com `is_admin = true`:
   ```sql
   insert into public.profiles (id, username, display_name, is_admin)
   values ('UUID_DO_USUARIO', 'admin', 'Seu Nome', true);
   ```

---

## Reajuste dinâmico de preços

Ao fim de cada fase, o preço de cada seleção sobrevivente é recalculado:

```
fator_adversário  = (49 − posição_ordinal_adversário) / 48
GM_aj             = Σ (gols_marcados_no_jogo × fator_adversário)
GS_aj             = Σ (gols_sofridos_no_jogo × fator_adversário)
Score             = GM_aj − (0,6 × GS_aj)
fator_surpresa    = (49 − posição_ordinal_própria) / 48
preço_novo        = clamp(preço_base × (1 + Score × fator_surpresa / 4), piso, teto)
```

Limites por prateleira: S (8–20 🪙) · A (4–14 🪙) · B (2–10 🪙) · C (1–8 🪙)

---

## Licença

Copyright © Gabriel Domingos 2026. Todos os direitos reservados.
