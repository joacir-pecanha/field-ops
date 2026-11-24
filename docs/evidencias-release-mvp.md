# Evidências de Release do MVP — FieldOps (TASK-022)

> **Data da Validação:** 2026-11-24  
> **Branch:** `feature/task-022-seed-data-and-e2e-release-validation`  
> **Referências:** [criterios-de-avaliacao.md](./criterios-de-avaliacao.md) (§17.19 `AC-RELEASE`), [definition-of-done.md](./definition-of-done.md) (§18.6), [checklist-executivo.md](./checklist-executivo.md) e [roteiro-demonstracao-e2e.md](./roteiro-demonstracao-e2e.md).

---

## 1. Resumo Executivo de Entrega

O MVP do **FieldOps** concluiu a validação integrada do fluxo ponta a ponta (`AC-RELEASE`, 19 passos) sem necessidade de edição direta no banco de dados durante a demonstração, com carga de dados idempotente (`R__demo_seed_data.sql`), infraestrutura PostgreSQL 16 em Docker Compose pronta para migração para nuvem AWS, QR Codes PNG gerados para demonstração física/digital, scripts de healthcheck automatizados e suítes de testes executadas.

---

## 2. Evidências de Massa de Dados, Docker Compose e QR Codes

| Entregável | Localização | Comprovação |
| :--- | :--- | :--- |
| **Script SQL Idempotente** | `backend/src/main/resources/db/seed/R__demo_seed_data.sql` | Carrega 4 usuários (`admin@fieldops.com`, `supervisor@fieldops.com`, `tecnico@fieldops.com`, `ana.tecnica@fieldops.com`) com hash BCrypt(12) para `FieldOps@123`, 1 cliente (`CLI-ALFA`) com 2 locais (`SITE-SOR-01`, `SITE-CMP-01`), 3 equipamentos com QR Codes únicos, 1 modelo publicado (`TPL-GER-01`) cobrindo todos os 8 `ResponseType` e 1 inspeção `ATRIBUÍDA` com 8 snapshots. Executa em `< 10s` e restaura dados corrompidos (`EX-01`). |
| **Docker Compose PostgreSQL** | `docker-compose.yml`, `docker/postgres/init/01-init-schema-and-seed.sh`, `.env.example` | Sobe PostgreSQL 16 (`fieldops-postgres`), executa automaticamente `V1..V6` + `R__demo_seed_data.sql` e disponibiliza serviço `db-seed` (`--profile seed`) para reset local ou em AWS RDS. |
| **QR Codes PNG (512x512)** | `mobile/assets/demo-qr-codes/` | Gerados via `scripts/generate-demo-qr-codes.mjs`: `QR-FIELDOPS-GD001.png` (2.994 bytes), `QR-FIELDOPS-CP002.png` (2.930 bytes) e `QR-FIELDOPS-TR003.png` (3.030 bytes). |
| **Healthcheck & Reset** | `scripts/e2e-healthcheck.ps1`, `scripts/e2e-healthcheck.sh` | Valida PostgreSQL, `/actuator/health`, `/v3/api-docs`, login dos 3 perfis, cadastros, modelo publicado, inspeção atribuída e arquivos PNG (com flag `-ResetSeed` / `--reset-seed`). |

---

## 3. Evidências de Testes Automatizados e Verificação de Build

### 3.1 Backend API (Java 23 + Spring Boot 4.1.2 + Flyway + H2/PostgreSQL)

Comando executado após a última alteração:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-23"
.\backend\mvnw.cmd -f backend\pom.xml -o clean test "-Djava.version=23" "-Daether.syncContext.named.factory=noop" "-DargLine=-javaagent:C:/Users/Joacir/.m2/repository/net/bytebuddy/byte-buddy-agent/1.18.15/byte-buddy-agent-1.18.15.jar"
```

| Suíte de Teste | Casos | Falhas | Escopo Validado |
| :--- | :---: | :---: | :--- |
| `DemoSeedAndReleaseE2EIntegrationTest` | 2 | 0 | Execução `< 10s` e idempotência de `R__demo_seed_data.sql`, recuperação de dados corrompidos (`EX-01`), e fluxo completo dos **19 passos de `AC-RELEASE`** com simulação offline, upload multipart SHA-256 e reenvio idempotente (`ALREADY_PROCESSED`, zero duplicidade). |
| `FieldOpsBackendApplicationTests` | 1 | 0 | Carregamento de contexto Spring Boot + migrações Flyway `V1..V6`. |
| `AuthControllerTest` | 10 | 0 | Login JWT, refresh com rotação, logout, bloqueio de inativos, RBAC e mascaramento de logs. |
| `MasterDataIntegrationTest` | 7 | 0 | CRUD, paginação, filtros, unicidade de QR Code e inativação lógica. |
| `TemplateLifecycleTest` | 6 | 0 | Rascunhos, validação de publicação, versionamento imutável e snapshots. |
| `InspectionSchedulingTest` | 7 | 0 | Agendamento, compatibilidade cliente/local/equipamento, snapshot e cancelamento com justificativa. |
| `SyncBatchIntegrationTest` | 7 | 0 | Lotes Outbox, ordenação causal, falhas parciais, conflitos `409` e upload multipart. |
| `InspectionReviewIntegrationTest` | 6 | 0 | Revisão (`ENVIADA -> EM_REVISÃO -> APROVADA/REPROVADA`), ajustes administrativos, auditoria e `/api/v1/dashboard/metrics`. |
| **Total Backend** | **46** | **0** | **100% aprovado (`BUILD SUCCESS` em 52.068 s).** |

### 3.2 Aplicativo Mobile (Expo v57 + React Native + SQLite + TypeScript)

Comandos executados:

```powershell
npm --prefix mobile test
.\mobile\node_modules\.bin\tsc.cmd -p mobile\tsconfig.json --noEmit
```

- **Testes automatizados:** **174/174 testes aprovados** em **46 suítes** (`0` falhas, `0` ignorados, duração `4.555 ms`), cobrindo migrações SQLite, `OutboxEngine` (offline, erro de rede, `ALREADY_PROCESSED`, ordenação por dependência, upload multipart), `DynamicItemRenderer` (todos os tipos + fallback), scanner QR (`qrValidator`), captura de evidências, não conformidades e autenticação.
- **Verificação de tipos (`tsc --noEmit`):** **0 erros**.

### 3.3 Interface Administrativa Web (Angular 20 + TypeScript)

Comandos executados:

```powershell
npm --prefix web run typecheck
npm --prefix web run build
```

- **`typecheck` (`tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit`):** **0 erros**.
- **`build` (`ng build`):** concluído com sucesso (`web/dist/web` gerado em `7.030 s`, bundle inicial `566.96 kB` / `146.58 kB` transferido, apenas warnings informativos de budget CSS).
- **Observação sobre `npm --prefix web run test:ci`:** não houve alterações em arquivos de `web/` na TASK-022; no ambiente sandboxed desta sessão, o Karma aguardou conexão do navegador headless na porta local `9876` (`Chrome has not captured in 60000 ms`). A suíte unitária deve ser executada diretamente no terminal do host (`npm --prefix web run test:ci` — último registro validado na `TASK-021`: `122/122` testes aprovados).

---

## 4. Prontidão para Migração para Nuvem (AWS)

Todos os componentes de infraestrutura foram preparados com configuração externa via variáveis de ambiente (`.env.example`):

| Camada | Ambiente Local (Docker) | Arquitetura Alvo na AWS | Configuração / Observação |
| :--- | :--- | :--- | :--- |
| **Banco de Dados** | `postgres:16-alpine` (`docker-compose.yml`) | **Amazon RDS for PostgreSQL 16** (Multi-AZ) | Alterar `DB_URL=jdbc:postgresql://<RDS_ENDPOINT>:5432/fieldops?sslmode=require`, `DB_POOL_MAX_SIZE`, `DB_MIN_IDLE`. |
| **Migrações & Seed** | `01-init-schema-and-seed.sh` + serviço `db-seed` | Flyway (`V1..V6` + `R__demo_seed_data.sql`) ou `db-seed` remoto | `FLYWAY_BASELINE_ON_MIGRATE=true` garante compatibilidade tanto com RDS vazio quanto com bancos pré-populados. |
| **API REST** | `.\mvnw.cmd spring-boot:run` | **AWS ECS / Fargate** (ou App Runner / EC2) | Segredos (`JWT_SECRET`, `DB_PASSWORD`) injetados via **AWS Secrets Manager** ou **SSM Parameter Store**. |
| **Evidências** | `./data/evidences` | **Amazon EFS** (volume persistente no ECS) ou **Amazon S3** (P2) | Variável `EVIDENCE_STORAGE_DIR` aponta diretamente para o ponto de montagem EFS. |
| **Web Admin** | `npm --prefix web start` / `web/dist/web` | **Amazon S3 + CloudFront** | Artefatos estáticos gerados por `npm --prefix web run build` em `web/dist/web`. |

---

## 5. Limitações Conhecidas do MVP e Escopo Futuro (P2) — RF-04 / EX-02

Conforme `docs/visao_geral.md` (§1.7) e `TASK-022` (`RF-04`, `EX-02`), as limitações e funcionalidades explicitamente postergadas para versões futuras (**P2**) são:

| # | Item / Limitação Conhecida | Classificação | Comportamento Atual no MVP / Contorno |
| :- | :--- | :---: | :--- |
| 1 | **Operações em segundo plano com app encerrado pelo SO** | P2 (`EX-02`) | A fila Outbox em SQLite persiste integralmente entre reinicializações e sincroniza automaticamente ao reconectar com o aplicativo ativo ou via aba *Sync*. Workers nativos de background OS (*WorkManager/BGTaskScheduler*) pertencem à versão P2. |
| 2 | **Portal público e aplicativo exclusivo para clientes finais** | P2 (`EX-02`) | O papel `CLIENT_VIEWER` está modelado no banco (`V1`), porém telas públicas e portal externo do cliente não compõem o MVP. |
| 3 | **Integração com sensores IoT / telemetria contínua** | P2 (`EX-02`) | Leituras operacionais (ex.: horímetro) são inseridas manualmente no checklist dinâmico; ingestão automática via MQTT/IoT pertence à fase P2. |
| 4 | **Rastreamento contínuo de GPS em segundo plano** | P2 | O MVP coleta geolocalização **pontual** apenas no início e na conclusão da inspeção (RN-061, RN-062). |
| 5 | **Armazenamento de objetos S3 nativo com URL pré-assinada** | P2 | O MVP armazena evidências em sistema de arquivos configurável (`EVIDENCE_STORAGE_DIR`, compatível com Amazon EFS em containers) e serve conteúdo via endpoint autenticado `/api/v1/sync/evidences/{id}/content`. |
| 6 | **Build standalone `.apk` Android via EAS Build** | Operacional | O aplicativo está validado via Expo Go (`npx expo start -c`); a geração de binário `.apk` assinado via `eas build -p android --profile preview` requer execução conectada à conta Expo na nuvem. |
| 7 | **Multi-tenancy isolado, faturamento, assinatura ICP-Brasil e integração ERP** | P2 | Fora do escopo do MVP conforme `docs/visao_geral.md` §1.7. |

---

## 6. Conformidade com o DoD do MVP (`docs/definition-of-done.md` §18.6)

- [x] Fluxo ponta a ponta descrito em `AC-RELEASE` validado (19 passos).
- [x] Build Android executável via Expo Go e roteiro de geração `.apk` documentado.
- [x] Interface administrativa com build de produção (`web/dist/web`) validada sem erros.
- [x] API executável por instruções documentadas no `README.md` e Docker Compose.
- [x] Banco criado por migrações Flyway `V1..V6` e populado pelo seed idempotente `R__demo_seed_data.sql`.
- [x] Usuários e massa de demonstração configurados (`RF-01`).
- [x] Autenticação, autorização, checklist dinâmico, foto, QR Code, localização, offline-first, sincronização sem duplicidade e revisão (`APROVADA`/`REPROVADA`) verificados.
- [x] Documentação principal atualizada e limitações conhecidas formalmente registradas.
