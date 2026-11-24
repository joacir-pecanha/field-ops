# Roteiro de Demonstração E2E — FieldOps MVP (AC-RELEASE)

> Referência: TASK-022, `docs/criterios-de-avaliacao.md` §17.19 (AC-RELEASE) e `docs/definition-of-done.md` §18.6.
> Duração total estimada: **~18 minutos** (5 min de preparação + 13 min de demonstração).
> Regra de ouro: **nenhuma edição manual no banco durante o fluxo**. Toda a massa vem do seed `R__demo_seed_data.sql`.

---

## 0. Preparação do Ambiente (T-5 min, antes da banca)

| # | Ação | Comando | Resultado esperado |
| :-- | :-- | :-- | :-- |
| 0.1 | Subir PostgreSQL 16 com migrações V1..V6 + seed | `docker compose up -d` | Container `fieldops-postgres` *healthy* |
| 0.2 | Subir API | `cd backend && .\mvnw.cmd spring-boot:run` | `http://localhost:8080/actuator/health` → `UP` |
| 0.3 | Subir Web Admin | `npm --prefix web start` | `http://localhost:4200` abre a tela de login |
| 0.4 | Subir Mobile | `cd mobile && npx expo start -c` (Expo Go / APK) | App abre a tela de login |
| 0.5 | Validar tudo de uma vez | `.\scripts\e2e-healthcheck.ps1` | Todas as linhas `[OK]` |
| 0.6 | Abrir/imprimir QR Codes | `mobile/assets/demo-qr-codes/` | 3 PNGs disponíveis |

> [!TIP]
> Em celular físico, configure `mobile/.env` com `EXPO_PUBLIC_API_URL=http://<IP_DA_MAQUINA>:8080` (ver `README.md` §4).

### Credenciais da massa de demonstração (senha única: `FieldOps@123`)

| Perfil | E-mail | Aplicação |
| :-- | :-- | :-- |
| Administrador | `admin@fieldops.com` | Web |
| Supervisor | `supervisor@fieldops.com` | Web |
| Técnico | `tecnico@fieldops.com` | Mobile |
| Técnica (apoio) | `ana.tecnica@fieldops.com` | Mobile |

### Dados pré-carregados (RF-01)

- **Cliente:** Indústria Alfa (`CLI-ALFA`) com 2 locais: Planta Sorocaba (`SITE-SOR-01`) e CD Campinas (`SITE-CMP-01`).
- **Equipamentos e QR Codes:**

| Equipamento | Local | QR Code |
| :-- | :-- | :-- |
| Gerador Diesel GD-001 (`EQP-GD-001`) | SITE-SOR-01 | ![GD001](../mobile/assets/demo-qr-codes/QR-FIELDOPS-GD001.png) `QR-FIELDOPS-GD001` |
| Compressor Parafuso CP-002 (`EQP-CP-002`) | SITE-SOR-01 | ![CP002](../mobile/assets/demo-qr-codes/QR-FIELDOPS-CP002.png) `QR-FIELDOPS-CP002` |
| Transformador TR-003 (`EQP-TR-003`) | SITE-CMP-01 | ![TR003](../mobile/assets/demo-qr-codes/QR-FIELDOPS-TR003.png) `QR-FIELDOPS-TR003` |

- **Modelo publicado:** `TPL-GER-01` v1 — 2 seções, 8 itens cobrindo todos os tipos de resposta (`CONFORMITY`, `BOOLEAN`, `SINGLE_CHOICE`, `NUMBER`, `DATE`, `PHOTO`, `TEXT_SHORT`, `TEXT_LONG`).
- **Inspeção atribuída pronta para download:** "Inspeção Preventiva — Gerador Diesel GD-001 (Demo E2E)" → `tecnico@fieldops.com`.

---

## 1. Roteiro Cronometrado dos 19 Passos (AC-RELEASE)

| Tempo | Passo AC-RELEASE | Ator / App | Ação na tela | Resultado esperado |
| :-- | :-- | :-- | :-- | :-- |
| 00:00 | **1. Login administrativo** | Supervisor / Web | Login com `supervisor@fieldops.com` | Dashboard carregado com cards de métricas |
| 00:45 | **2. Seleção de cliente, local e equipamento** | Web | Menu *Clientes* → `CLI-ALFA` → *Locais* → `SITE-SOR-01` → *Equipamentos* | Lista mostra `EQP-GD-001` e `EQP-CP-002` com QR Codes únicos |
| 01:45 | **3. Seleção de modelo publicado** | Web | *Modelos de Inspeção* → `TPL-GER-01` → *Prévia* | Status `PUBLICADO` v1, 8 itens, todos os tipos |
| 02:30 | **4. Agendamento e atribuição** | Web | *Inspeções* → *Nova Inspeção*: modelo `TPL-GER-01`, cliente `CLI-ALFA`, local `SITE-SOR-01`, equipamento `EQP-GD-001`, técnico Carlos, prioridade ALTA | Inspeção criada em `ATRIBUÍDA` com snapshot de 8 itens |
| 03:30 | **5. Login do técnico** | Técnico / Mobile | Login com `tecnico@fieldops.com` | Home com resumo e lista de inspeções |
| 04:00 | **6. Download da inspeção** | Mobile | Puxar para atualizar na aba *Inspeções* | Inspeção recém-agendada + inspeção demo aparecem (`ATRIBUÍDA`) |
| 04:30 | **12. Perda simulada de conectividade** | Mobile | Ativar **modo avião** no dispositivo | Indicador "Offline"; dados continuam visíveis (SQLite) |
| 04:45 | **10. QR Code** | Mobile | Abrir a inspeção → *Ler QR Code* → apontar para `QR-FIELDOPS-GD001.png` | Equipamento confirmado (match); divergência seria exigida com justificativa |
| 05:30 | **7. Início** | Mobile | *Iniciar inspeção* | Status local `EM_ANDAMENTO`; operação `START_INSPECTION` na Outbox |
| 05:40 | **11. Localização** | Mobile | Aceitar permissão de localização | Lat/long/precisão capturadas pontualmente (início) |
| 06:00 | **8. Resposta do checklist** | Mobile | Responder: GER-01 *Não Conforme* (com observação), GER-02 *Sim*, GER-03 *Automático*, GER-04 `1425.5`, GER-05 data, GER-07/08 textos; registrar 1 NC ALTA | Progresso recalculado; respostas salvas no SQLite |
| 08:00 | **9. Foto** | Mobile | GER-06 → capturar foto do painel → *Confirmar* | Prévia exibida; evidência `PENDING` local |
| 09:00 | **13. Conclusão offline** | Mobile | *Concluir inspeção* | Estado "Aguardando sincronização"; contador de pendências > 0 |
| 09:30 | — (prova offline) | Supervisor / Web | Atualizar lista de inspeções | Servidor ainda mostra o último estado conhecido (`ATRIBUÍDA`) |
| 10:00 | **14. Retorno da conectividade** | Mobile | Desativar modo avião | Sincronização automática na reconexão (ou botão *Sincronizar*) |
| 10:30 | **15. Sincronização sem duplicidade** | Mobile | Na aba *Sync*, tocar *Sincronizar* novamente | Pendências = 0; reenvio retorna `ALREADY_PROCESSED`; nenhum registro duplicado |
| 11:00 | **16. Visualização administrativa** | Web | Dashboard → card *Aguardando Revisão* → abrir inspeção | Respostas, NC, foto (lightbox), mapa com coordenadas de início/fim |
| 12:00 | **17. Aprovação ou reprovação** | Web | *Iniciar revisão* → *Aprovar* (comentário opcional). Alternativa: *Reprovar* exige motivo | Status `APROVADA` com revisor e horário registrados |
| 12:30 | **18. Atualização no aplicativo** | Mobile | Puxar para atualizar | Inspeção exibida como `APROVADA` (somente leitura) |
| 13:00 | **19. Consulta do histórico mínimo** | Web | Aba *Histórico* da revisão | Ciclos `REVIEW_STARTED` → `APPROVED` e trilha de auditoria (agendada, iniciada, concluída, aprovada) |

> [!NOTE]
> A ordem 12 → 10 → 7 → 11 → 8 → 9 → 13 é intencional: a perda de conectividade ocorre **logo após o download**, comprovando que toda a execução de campo (QR, início, GPS, checklist, foto, conclusão) funciona 100% offline (RN-065 a RN-078).

---

## 2. Cenário Alternativo — Reprovação (opcional, +3 min)

1. No passo 17, clicar em **Reprovar** sem motivo → botão bloqueado / erro "O motivo da reprovação é obrigatório".
2. Informar motivo → status `REPROVADA`.
3. No mobile, sincronizar → inspeção aparece como "Requer correção" com o motivo.
4. Corrigir o item, concluir e sincronizar → status volta a `ENVIADA`, ciclo de revisão 2.

---

## 3. Procedimento de Reset Instantâneo (EX-01)

Se algum dado for corrompido durante o ensaio, restaure o estado inicial em segundos:

```powershell
# Opção 1 — script de healthcheck com reset
.\scripts\e2e-healthcheck.ps1 -ResetSeed

# Opção 2 — serviço utilitário do Docker Compose
docker compose --profile seed run --rm db-seed

# Opção 3 — reset total (apaga o volume e recria schema + seed)
docker compose down -v; docker compose up -d
```

O seed é **idempotente**: usuários, cliente, locais, equipamentos e modelo são atualizados (sem duplicar) e a inspeção demo `88888888-…-801` é recriada limpa em `ATRIBUÍDA`. No mobile, use *Perfil → Sair* para limpar a base local antes de um novo ensaio.

---

## 4. Evidência Automatizada do Roteiro

Os 19 passos são reproduzidos automaticamente (via API) pelo teste
`backend/src/test/java/com/fieldops/e2e/DemoSeedAndReleaseE2EIntegrationTest.java`:

- `shouldExecuteDemoSeedIdempotentlyUnder10SecondsAndRecoverCorruptedData` — CA-02, RF-01, RT-01, EX-01.
- `shouldExecuteComplete19StepAcReleaseFlowWithoutDirectDbEdits` — CA-01, CA-03, RF-02, RF-03.

Resultados consolidados em [`evidencias-release-mvp.md`](./evidencias-release-mvp.md).

> [!IMPORTANT]
> Prints de tela devem ser capturados durante o ensaio presencial com a banca e anexados em `docs/evidencias/` (pendente de execução manual em dispositivo Android).
