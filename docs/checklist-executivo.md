# Checklist Executivo do Projeto — FieldOps MVP

> Revisado na TASK-022 (2026-11-24). Evidências detalhadas em [`evidencias-release-mvp.md`](./evidencias-release-mvp.md).

## Mobile
- [x] Build Android — execução via Expo Go (`npx expo start`); `.apk` via EAS documentado como passo de distribuição final. 174/174 testes + `tsc --noEmit` sem erros.

## Administrativo (Web)
- [x] Login e guards — TASK-006.
- [x] Usuários — TASK-008.
- [x] Clientes, locais e equipamentos — TASK-008.
- [x] Modelos e versões — TASK-010.
- [x] Agendamento e atribuição — TASK-012.
- [x] Acompanhamento — TASK-021 (Dashboard).
- [x] Revisão — TASK-020.
- [x] Aprovação e reprovação — TASK-020.
- [x] Build web — `npm --prefix web run build` gera `dist/web` sem erros (apenas avisos de budget de CSS).

## Backend
- [x] Autenticação e autorização — TASK-005 (JWT + RBAC).
- [x] Migrações — Flyway V1..V6 + seed repetível `db/seed/R__demo_seed_data.sql`.
- [x] Cadastros — TASK-007.
- [x] Modelos e snapshot — TASK-009 / TASK-011.
- [x] Inspeções e estados — TASK-011 / TASK-019.
- [x] Respostas — TASK-018.
- [x] Evidências — TASK-018 (upload multipart + SHA-256).
- [x] Não conformidades — TASK-018.
- [x] Sincronização idempotente — TASK-018 (`ALREADY_PROCESSED`).
- [x] Revisão e auditoria — TASK-019.
- [x] OpenAPI — `/v3/api-docs` e `/swagger-ui.html`.

## Entrega
- [x] Fluxo ponta a ponta testado — `DemoSeedAndReleaseE2EIntegrationTest` (19 passos AC-RELEASE).
- [x] Dados de demonstração — `R__demo_seed_data.sql` + Docker Compose + QR Codes em `mobile/assets/demo-qr-codes/`.
- [x] READMEs atualizados — `README.md` §1 (Docker/seed/AWS).
- [x] Limitações registradas — `evidencias-release-mvp.md` §5.
- [ ] Evidências de participação — a anexar pela equipe (commits/PRs por integrante).
- [x] Apresentação preparada — `roteiro-demonstracao-e2e.md` (roteiro cronometrado).
