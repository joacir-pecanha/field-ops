package com.fieldops.e2e;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.inspection.repository.InspectionReviewRepository;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.repository.ClientRepository;
import com.fieldops.modules.master.repository.EquipmentRepository;
import com.fieldops.modules.master.repository.SiteRepository;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.modules.sync.repository.EvidenceFileRepository;
import com.fieldops.modules.sync.repository.InspectionResponseRepository;
import com.fieldops.modules.sync.repository.NonConformityRepository;
import com.fieldops.modules.sync.repository.ProcessedOperationRepository;
import com.fieldops.modules.template.repository.InspectionTemplateRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import javax.imageio.ImageIO;
import javax.sql.DataSource;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Validação automatizada de Seed Idempotente (R__demo_seed_data.sql) e fluxo E2E completo
 * dos 19 passos do critério AC-RELEASE, incluindo execução offline e sincronização sem duplicidade (TASK-022).
 */
@SpringBootTest
@ActiveProfiles("test")
class DemoSeedAndReleaseE2EIntegrationTest {

    private static final UUID DEMO_INSPECTION_ID = UUID.fromString("88888888-8888-4888-8888-888888888801");
    private static final Path TEST_EVIDENCE_DIR = Paths.get("./target/test-evidences").toAbsolutePath().normalize();

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private ProcessedOperationRepository processedOperationRepository;

    @Autowired
    private EvidenceFileRepository evidenceFileRepository;

    @Autowired
    private NonConformityRepository nonConformityRepository;

    @Autowired
    private InspectionResponseRepository inspectionResponseRepository;

    @Autowired
    private InspectionReviewRepository inspectionReviewRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private InspectionItemSnapshotRepository snapshotRepository;

    @Autowired
    private InspectionRepository inspectionRepository;

    @Autowired
    private InspectionTemplateRepository templateRepository;

    @Autowired
    private EquipmentRepository equipmentRepository;

    @Autowired
    private SiteRepository siteRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws Exception {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        cleanAll();
    }

    @AfterEach
    void tearDown() throws Exception {
        cleanAll();
    }

    private void cleanAll() throws Exception {
        processedOperationRepository.deleteAllInBatch();
        evidenceFileRepository.deleteAllInBatch();
        nonConformityRepository.deleteAllInBatch();
        inspectionResponseRepository.deleteAllInBatch();
        inspectionReviewRepository.deleteAllInBatch();
        auditLogRepository.deleteAllInBatch();
        snapshotRepository.deleteAllInBatch();
        inspectionRepository.deleteAllInBatch();
        templateRepository.deleteAll();
        equipmentRepository.deleteAllInBatch();
        siteRepository.deleteAllInBatch();
        clientRepository.deleteAllInBatch();
        refreshTokenRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        if (Files.exists(TEST_EVIDENCE_DIR)) {
            try (Stream<Path> walk = Files.walk(TEST_EVIDENCE_DIR)) {
                walk.sorted(Comparator.reverseOrder())
                        .forEach(path -> {
                            try {
                                Files.deleteIfExists(path);
                            } catch (Exception ignored) {
                            }
                        });
            }
        }
    }

    private long executeSeedScript() {
        long startNanos = System.nanoTime();
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                false,
                false,
                StandardCharsets.UTF_8.name(),
                new ClassPathResource("db/seed/R__demo_seed_data.sql")
        );
        populator.execute(dataSource);
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    @Test
    @DisplayName("CA-02 / RF-01 / RT-01 / EX-01: Seed SQL popula massa completa em < 10s, autentica em BCrypt e restaura dados corrompidos de forma idempotente")
    void shouldExecuteDemoSeedIdempotentlyUnder10SecondsAndRecoverCorruptedData() throws Exception {
        long elapsedMs = executeSeedScript();
        assertTrue(elapsedMs < 10_000L, "Seed SQL deve executar em menos de 10 segundos (executou em " + elapsedMs + " ms)");

        // Valida login BCrypt dos 3 perfis obrigatórios (RF-01)
        String adminToken = login("admin@fieldops.com", "FieldOps@123", "ADMIN");
        String supervisorToken = login("supervisor@fieldops.com", "FieldOps@123", "SUPERVISOR");
        String technicianToken = login("tecnico@fieldops.com", "FieldOps@123", "TECHNICIAN");
        assertNotNull(adminToken);

        // Valida 1 cliente com 2 locais distintos
        MvcResult clientRes = mockMvc.perform(get("/api/v1/clients?search=CLI-ALFA")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].code").value("CLI-ALFA"))
                .andReturn();
        String clientId = objectMapper.readTree(clientRes.getResponse().getContentAsString())
                .at("/content/0/id").asText();

        mockMvc.perform(get("/api/v1/clients/" + clientId + "/sites")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        // Valida 3 equipamentos com QR Codes únicos
        for (String qr : new String[]{"QR-FIELDOPS-GD001", "QR-FIELDOPS-CP002", "QR-FIELDOPS-TR003"}) {
            mockMvc.perform(get("/api/v1/equipments/qr/" + qr)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.qrCode").value(qr));
        }

        // Valida 1 modelo publicado completo com os tipos obrigatórios
        mockMvc.perform(get("/api/v1/inspection-templates?search=TPL-GER-01&status=PUBLISHED")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].code").value("TPL-GER-01"))
                .andExpect(jsonPath("$.content[0].status").value("PUBLISHED"))
                .andExpect(jsonPath("$.content[0].sections", hasSize(2)));

        // Valida 1 inspeção atribuída pronta para download
        mockMvc.perform(get("/api/v1/inspections/assigned")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(DEMO_INSPECTION_ID.toString()))
                .andExpect(jsonPath("$[0].status").value("ATRIBUÍDA"))
                .andExpect(jsonPath("$[0].items", hasSize(8)));

        // EX-01 & RT-01: Simula corrupção de usuário e inspeção, reexecuta seed e comprova restauração instantânea sem duplicidade
        User corruptedTech = userRepository.findByEmailIgnoreCase("tecnico@fieldops.com").orElseThrow();
        corruptedTech.setStatus(UserStatus.INACTIVE);
        userRepository.saveAndFlush(corruptedTech);

        var corruptedInspection = inspectionRepository.findById(DEMO_INSPECTION_ID).orElseThrow();
        corruptedInspection.setStatus(InspectionStatus.EM_ANDAMENTO);
        inspectionRepository.saveAndFlush(corruptedInspection);

        long rerunMs = executeSeedScript();
        assertTrue(rerunMs < 10_000L);

        assertEquals(4, userRepository.count());
        assertEquals(1, clientRepository.count());
        assertEquals(2, siteRepository.count());
        assertEquals(3, equipmentRepository.count());
        assertEquals(1, templateRepository.count());
        assertEquals(1, inspectionRepository.count());
        assertEquals(InspectionStatus.ATRIBUÍDA, inspectionRepository.findById(DEMO_INSPECTION_ID).orElseThrow().getStatus());
        assertNotNull(login("tecnico@fieldops.com", "FieldOps@123", "TECHNICIAN"));
    }

    @Test
    @DisplayName("CA-01 / CA-03 / RF-02 / RF-03: Executa os 19 passos do AC-RELEASE com modo offline e sincronização sem duplicidade")
    void shouldExecuteComplete19StepAcReleaseFlowWithoutDirectDbEdits() throws Exception {
        // Pré-condição: ambiente inicializado via script SQL (zero edição manual no banco durante o fluxo)
        executeSeedScript();

        // Passo 1: Login administrativo (ADMIN e SUPERVISOR)
        String adminToken = login("admin@fieldops.com", "FieldOps@123", "ADMIN");
        String supervisorToken = login("supervisor@fieldops.com", "FieldOps@123", "SUPERVISOR");
        assertNotNull(adminToken);

        // Passo 2: Seleção de cliente, local e equipamento via API
        MvcResult clientsRes = mockMvc.perform(get("/api/v1/clients?search=CLI-ALFA")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        String clientId = objectMapper.readTree(clientsRes.getResponse().getContentAsString())
                .at("/content/0/id").asText();

        MvcResult sitesRes = mockMvc.perform(get("/api/v1/clients/" + clientId + "/sites")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andReturn();
        JsonNode sitesContent = objectMapper.readTree(sitesRes.getResponse().getContentAsString()).get("content");
        String siteSorocabaId = findNodeIdByCode(sitesContent, "SITE-SOR-01");

        MvcResult eqpRes = mockMvc.perform(get("/api/v1/sites/" + siteSorocabaId + "/equipments")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andReturn();
        JsonNode eqpContent = objectMapper.readTree(eqpRes.getResponse().getContentAsString()).get("content");
        String generatorId = findNodeIdByCode(eqpContent, "EQP-GD-001");

        // Passo 3: Seleção de modelo publicado completo
        MvcResult tplRes = mockMvc.perform(get("/api/v1/inspection-templates?search=TPL-GER-01&status=PUBLISHED")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].status").value("PUBLISHED"))
                .andReturn();
        String templateId = objectMapper.readTree(tplRes.getResponse().getContentAsString())
                .at("/content/0/id").asText();

        // Passo 4: Agendamento e atribuição da inspeção para o técnico
        String technicianId = userRepository.findByEmailIgnoreCase("tecnico@fieldops.com").orElseThrow().getId().toString();
        String schedulePayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "equipmentId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "2026-11-26T14:00:00Z",
                  "title": "Inspeção E2E AC-RELEASE — Gerador Diesel GD-001",
                  "instructions": "Executar checklist completo com QR Code, foto, GPS e simulação offline.",
                  "priority": "ALTA"
                }
                """.formatted(templateId, clientId, siteSorocabaId, generatorId, technicianId);

        MvcResult scheduledRes = mockMvc.perform(post("/api/v1/inspections")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(schedulePayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ATRIBUÍDA"))
                .andExpect(jsonPath("$.items", hasSize(8)))
                .andReturn();
        String inspectionId = objectMapper.readTree(scheduledRes.getResponse().getContentAsString())
                .get("id").asText();

        // Passo 5: Login do técnico
        String technicianToken = login("tecnico@fieldops.com", "FieldOps@123", "TECHNICIAN");

        // Passo 6: Download da inspeção atribuída no mobile
        MvcResult assignedRes = mockMvc.perform(get("/api/v1/inspections/assigned")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(inspectionId)))
                .andReturn();

        JsonNode assignedList = objectMapper.readTree(assignedRes.getResponse().getContentAsString());
        JsonNode targetInspection = null;
        for (JsonNode node : assignedList) {
            if (inspectionId.equals(node.get("id").asText())) {
                targetInspection = node;
                break;
            }
        }
        assertNotNull(targetInspection);
        assertEquals("QR-FIELDOPS-GD001", targetInspection.get("equipmentQrCode").asText());

        Map<String, String> itemIdsByCode = new HashMap<>();
        for (JsonNode item : targetInspection.get("items")) {
            itemIdsByCode.put(item.get("itemCode").asText(), item.get("id").asText());
        }
        assertEquals(8, itemIdsByCode.size());

        // Passo 10: Validação de leitura de QR Code autorizado do equipamento
        mockMvc.perform(get("/api/v1/equipments/qr/QR-FIELDOPS-GD001")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(generatorId))
                .andExpect(jsonPath("$.qrCode").value("QR-FIELDOPS-GD001"));

        // Passos 7, 8, 9, 11, 12 e 13:
        // Simulação de perda de conectividade (modo avião) após download:
        // todas as mutações (início + GPS inicial, respostas dos 8 itens, não conformidade, foto e conclusão + GPS final)
        // são acumuladas localmente na fila Outbox enquanto o servidor permanece inalterado em ATRIBUÍDA.
        assertEquals(
                InspectionStatus.ATRIBUÍDA,
                inspectionRepository.findById(UUID.fromString(inspectionId)).orElseThrow().getStatus()
        );

        byte[] photoBytes = createValidJpegBytes();
        String photoSha256 = sha256Hex(photoBytes);
        UUID evidenceId = UUID.randomUUID();
        UUID uploadOpId = UUID.randomUUID();
        UUID ncId = UUID.randomUUID();
        UUID startOpId = UUID.randomUUID();
        UUID ncOpId = UUID.randomUUID();
        UUID completeOpId = UUID.randomUUID();
        String batchId = UUID.randomUUID().toString();

        String offlineBatchJson = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "START_INSPECTION",
                      "entity_type": "INSPECTION",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-24T15:00:00Z",
                      "payload": {
                        "inspectionId": "%s",
                        "startedAt": "2026-11-24T15:00:00Z",
                        "latitude": -23.5015300,
                        "longitude": -47.4525600,
                        "accuracy": 7.50
                      }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-24T15:02:00Z",
                      "dependencies": ["%s"],
                      "payload": {
                        "inspectionId": "%s",
                        "itemId": "%s",
                        "value": "NON_CONFORMING",
                        "observation": "Lacre rompido na porta lateral do gerador."
                      }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-24T15:03:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "true" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-24T15:04:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "Automático" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-24T15:05:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "1425.5" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-24T15:06:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "2026-11-20" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-24T15:07:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "FOTO_ANEXADA" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-24T15:08:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "Marcos Silva" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-24T15:09:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "Equipamento operando em stand-by com necessidade de reposição do lacre." }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "CREATE_NON_CONFORMITY",
                      "entity_type": "NON_CONFORMITY",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-24T15:10:00Z",
                      "payload": {
                        "id": "%s",
                        "inspectionId": "%s",
                        "itemId": "%s",
                        "title": "Lacre lateral rompido",
                        "description": "Lacre da carenagem direita violado na inspeção visual.",
                        "severity": "ALTA"
                      }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "COMPLETE_INSPECTION",
                      "entity_type": "INSPECTION",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-24T15:15:00Z",
                      "dependencies": ["%s", "%s"],
                      "payload": {
                        "inspectionId": "%s",
                        "completedAt": "2026-11-24T15:15:00Z",
                        "latitude": -23.5018800,
                        "longitude": -47.4522100,
                        "accuracy": 6.20
                      }
                    }
                  ]
                }
                """.formatted(
                batchId,
                startOpId, inspectionId, inspectionId,
                UUID.randomUUID(), startOpId, inspectionId, itemIdsByCode.get("GER-01"),
                UUID.randomUUID(), inspectionId, itemIdsByCode.get("GER-02"),
                UUID.randomUUID(), inspectionId, itemIdsByCode.get("GER-03"),
                UUID.randomUUID(), inspectionId, itemIdsByCode.get("GER-04"),
                UUID.randomUUID(), inspectionId, itemIdsByCode.get("GER-05"),
                UUID.randomUUID(), inspectionId, itemIdsByCode.get("GER-06"),
                UUID.randomUUID(), inspectionId, itemIdsByCode.get("GER-07"),
                UUID.randomUUID(), inspectionId, itemIdsByCode.get("GER-08"),
                ncOpId, ncId, ncId, inspectionId, itemIdsByCode.get("GER-01"),
                completeOpId, inspectionId, startOpId, ncOpId, inspectionId
        );

        // Passo 14: Retorno da conectividade — envio do lote JSON e upload da fotografia de evidência
        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .header("X-Idempotency-Key", batchId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offlineBatchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.total_operations").value(11))
                .andExpect(jsonPath("$.succeeded_count").value(11))
                .andExpect(jsonPath("$.failed_count").value(0));

        MockMultipartFile photoFile = new MockMultipartFile(
                "file",
                "painel-gerador.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                photoBytes
        );

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(photoFile)
                        .param("inspectionId", inspectionId)
                        .param("itemId", itemIdsByCode.get("GER-06"))
                        .param("evidenceId", evidenceId.toString())
                        .param("operationId", uploadOpId.toString())
                        .param("checksumSha256", photoSha256)
                        .param("clientTimestamp", "2026-11-24T15:07:30Z")
                        .param("description", "Foto frontal do painel do Gerador GD-001")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.evidence_id").value(evidenceId.toString()))
                .andExpect(jsonPath("$.status").value("UPLOADED"))
                .andExpect(jsonPath("$.already_processed").value(false));

        // Passo 15: Reenvio idêntico (simulando oscilação na reconexão) — zero duplicidade (CA-03)
        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .header("X-Idempotency-Key", batchId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offlineBatchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.processed[0].status").value("ALREADY_PROCESSED"))
                .andExpect(jsonPath("$.processed[10].status").value("ALREADY_PROCESSED"));

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(photoFile)
                        .param("inspectionId", inspectionId)
                        .param("operationId", uploadOpId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidence_id").value(evidenceId.toString()))
                .andExpect(jsonPath("$.already_processed").value(true));

        UUID inspectionUuid = UUID.fromString(inspectionId);
        assertEquals(8, inspectionResponseRepository.countByInspectionId(inspectionUuid));
        assertEquals(1, nonConformityRepository.countByInspectionId(inspectionUuid));
        assertEquals(1, evidenceFileRepository.findByInspectionIdOrderByCreatedAtAsc(inspectionUuid).size());

        // Passo 16: Visualização administrativa (Dashboard + Detalhes de Revisão + Download de Evidência)
        mockMvc.perform(get("/api/v1/dashboard/metrics")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.awaitingReviewCount").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.totalNonConformities").value(greaterThanOrEqualTo(1)));

        mockMvc.perform(get("/api/v1/inspections/" + inspectionId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENVIADA"))
                .andExpect(jsonPath("$.responses", hasSize(8)))
                .andExpect(jsonPath("$.nonConformities", hasSize(1)))
                .andExpect(jsonPath("$.evidences", hasSize(1)))
                .andExpect(jsonPath("$.startLatitude").isNotEmpty())
                .andExpect(jsonPath("$.completeLatitude").isNotEmpty());

        byte[] downloadedPhoto = mockMvc.perform(get("/api/v1/sync/evidences/" + evidenceId + "/content")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        assertArrayEquals(photoBytes, downloadedPhoto);

        // Passo 17: Revisão e Aprovação pelo Supervisor
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_REVISÃO"));

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comments\":\"Inspeção E2E validada e aprovada pela banca.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APROVADA"))
                .andExpect(jsonPath("$.approvedByName").value("Supervisor Operacional"));

        // Passo 18: Atualização do estado no aplicativo do técnico
        mockMvc.perform(get("/api/v1/inspections/assigned?status=APROVADA")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(inspectionId)));

        // Passo 19: Consulta do histórico mínimo (ciclos de revisão + trilha de auditoria)
        mockMvc.perform(get("/api/v1/inspections/" + inspectionId + "/reviews")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].decision").value("REVIEW_STARTED"))
                .andExpect(jsonPath("$[1].decision").value("APPROVED"));

        mockMvc.perform(get("/api/v1/inspections/" + inspectionId + "/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].action", hasItem("INSPECTION_SCHEDULED")))
                .andExpect(jsonPath("$[*].action", hasItem("INSPECTION_STARTED")))
                .andExpect(jsonPath("$[*].action", hasItem("INSPECTION_COMPLETED")))
                .andExpect(jsonPath("$[*].action", hasItem("REVIEW_STARTED")))
                .andExpect(jsonPath("$[*].action", hasItem("INSPECTION_APPROVED")));
    }

    private String login(String email, String password, String expectedRole) throws Exception {
        String payload = """
                {
                  "email": "%s",
                  "password": "%s"
                }
                """.formatted(email, password);
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.role").value(expectedRole))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String findNodeIdByCode(JsonNode arrayNode, String code) {
        for (JsonNode item : arrayNode) {
            if (code.equals(item.path("code").asText())) {
                return item.get("id").asText();
            }
        }
        throw new AssertionError("Registro não encontrado com code=" + code);
    }

    private byte[] createValidJpegBytes() throws Exception {
        BufferedImage image = new BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(15, 23, 42));
        graphics.fillRect(0, 0, 32, 32);
        graphics.setColor(new Color(56, 189, 248));
        graphics.fillRect(6, 6, 20, 20);
        graphics.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", out);
        return out.toByteArray();
    }

    private String sha256Hex(byte[] bytes) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return HexFormat.of().formatHex(digest.digest(bytes));
    }
}
