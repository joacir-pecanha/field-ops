package com.fieldops.modules.sync;

import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.inspection.domain.AuditLog;
import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.inspection.domain.InspectionPriority;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.dto.ScheduleInspectionRequest;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.inspection.service.InspectionSchedulingService;
import com.fieldops.modules.master.domain.Client;
import com.fieldops.modules.master.domain.Equipment;
import com.fieldops.modules.master.domain.EquipmentStatus;
import com.fieldops.modules.master.domain.MasterStatus;
import com.fieldops.modules.master.domain.Site;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.repository.ClientRepository;
import com.fieldops.modules.master.repository.EquipmentRepository;
import com.fieldops.modules.master.repository.SiteRepository;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.modules.sync.domain.EvidenceFile;
import com.fieldops.modules.sync.domain.EvidenceFileStatus;
import com.fieldops.modules.sync.domain.InspectionResponse;
import com.fieldops.modules.sync.domain.NonConformity;
import com.fieldops.modules.sync.domain.NonConformitySeverity;
import com.fieldops.modules.sync.domain.ProcessedOperation;
import com.fieldops.modules.sync.repository.EvidenceFileRepository;
import com.fieldops.modules.sync.repository.InspectionResponseRepository;
import com.fieldops.modules.sync.repository.NonConformityRepository;
import com.fieldops.modules.sync.repository.ProcessedOperationRepository;
import com.fieldops.modules.template.domain.ResponseType;
import com.fieldops.modules.template.dto.TemplateItemRequest;
import com.fieldops.modules.template.dto.TemplateRequest;
import com.fieldops.modules.template.dto.TemplateResponse;
import com.fieldops.modules.template.dto.TemplateSectionRequest;
import com.fieldops.modules.template.repository.InspectionTemplateRepository;
import com.fieldops.modules.template.service.TemplateService;
import com.fieldops.security.jwt.AuthenticatedUser;
import com.fieldops.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes de integração completos de Sincronização em Lote Idempotente e Upload de Evidências (TASK-018 Passo 6).
 */
@SpringBootTest
@ActiveProfiles("test")
class SyncBatchIntegrationTest {

    private static final Path TEST_EVIDENCE_DIR = Paths.get("./target/test-evidences").toAbsolutePath().normalize();

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ProcessedOperationRepository processedOperationRepository;

    @Autowired
    private InspectionResponseRepository inspectionResponseRepository;

    @Autowired
    private NonConformityRepository nonConformityRepository;

    @Autowired
    private EvidenceFileRepository evidenceFileRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private InspectionItemSnapshotRepository snapshotRepository;

    @Autowired
    private InspectionRepository inspectionRepository;

    @Autowired
    private InspectionSchedulingService inspectionSchedulingService;

    @Autowired
    private InspectionTemplateRepository templateRepository;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private SiteRepository siteRepository;

    @Autowired
    private EquipmentRepository equipmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private MockMvc mockMvc;

    private User supervisorUser;
    private User technicianUser;
    private User otherTechnicianUser;
    private String technicianToken;
    private String otherTechnicianToken;

    private Client client;
    private Site site;
    private Equipment equipment;
    private TemplateResponse publishedTemplate;

    @BeforeEach
    void setUp() throws Exception {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        cleanAll();

        String hash = passwordEncoder.encode("FieldOps@123");
        supervisorUser = userRepository.save(new User(
                UUID.randomUUID(), "Supervisor Sync", "supervisor.sync@fieldops.com", hash,
                UserRole.SUPERVISOR, UserStatus.ACTIVE, "+5511999993001"
        ));
        technicianUser = userRepository.save(new User(
                UUID.randomUUID(), "Técnico Sync", "tecnico.sync@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.ACTIVE, "+5511999993002"
        ));
        otherTechnicianUser = userRepository.save(new User(
                UUID.randomUUID(), "Outro Técnico Sync", "outro.sync@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.ACTIVE, "+5511999993003"
        ));

        technicianToken = jwtTokenProvider.generateAccessToken(technicianUser);
        otherTechnicianToken = jwtTokenProvider.generateAccessToken(otherTechnicianUser);

        client = new Client();
        client.setId(UUID.randomUUID());
        client.setCode("CLI-SYNC-01");
        client.setName("Cliente Sync S.A.");
        client.setStatus(MasterStatus.ACTIVE);
        client = clientRepository.save(client);

        site = new Site();
        site.setId(UUID.randomUUID());
        site.setClient(client);
        site.setCode("SITE-SYNC-01");
        site.setName("Planta Sync");
        site.setCity("Sorocaba");
        site.setState("SP");
        site.setStatus(MasterStatus.ACTIVE);
        site = siteRepository.save(site);

        equipment = new Equipment();
        equipment.setId(UUID.randomUUID());
        equipment.setSite(site);
        equipment.setCode("EQP-SYNC-01");
        equipment.setName("Gerador Sync 01");
        equipment.setQrCode("QR-SYNC-01");
        equipment.setStatus(EquipmentStatus.ACTIVE);
        equipment = equipmentRepository.save(equipment);

        publishedTemplate = templateService.createDraft(
                new TemplateRequest(
                        "TPL-SYNC-01",
                        "Checklist Completo Sync",
                        "Modelo com 7 tipos para teste de lote",
                        "MECANICA",
                        List.of(
                                new TemplateSectionRequest(
                                        "Seção Principal",
                                        "Itens obrigatórios",
                                        0,
                                        List.of(
                                                new TemplateItemRequest("ITM-01", "Integridade do lacre", null, ResponseType.CONFORMITY, true, true, true, null, null, 0),
                                                new TemplateItemRequest("ITM-02", "Área livre de vazamentos", null, ResponseType.BOOLEAN, true, false, false, null, null, 1),
                                                new TemplateItemRequest("ITM-03", "Modo de operação", null, ResponseType.SINGLE_CHOICE, true, false, false, List.of("Automático", "Manual", "Desligado"), null, 2),
                                                new TemplateItemRequest("ITM-04", "Horímetro (horas)", null, ResponseType.NUMBER, true, false, false, null, null, 3),
                                                new TemplateItemRequest("ITM-05", "Data da última manutenção", null, ResponseType.DATE, true, false, false, null, null, 4),
                                                new TemplateItemRequest("ITM-06", "Responsável local", null, ResponseType.TEXT_SHORT, true, false, false, null, null, 5),
                                                new TemplateItemRequest("ITM-07", "Observações gerais", null, ResponseType.TEXT_LONG, false, false, false, null, null, 6)
                                        )
                                )
                        )
                ),
                supervisorUser.getId()
        );
        templateService.publish(publishedTemplate.id(), supervisorUser.getId());
    }

    @AfterEach
    void tearDown() throws Exception {
        cleanAll();
    }

    private void cleanAll() throws Exception {
        processedOperationRepository.deleteAll();
        evidenceFileRepository.deleteAll();
        nonConformityRepository.deleteAll();
        inspectionResponseRepository.deleteAll();
        auditLogRepository.deleteAll();
        snapshotRepository.deleteAll();
        inspectionRepository.deleteAll();
        templateRepository.deleteAll();
        equipmentRepository.deleteAll();
        siteRepository.deleteAll();
        clientRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

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

    @Test
    @DisplayName("CA-01 / RF-01..RF-06: Lote com 10 operações aplica todas atomicamente preservando timestamps do cliente e servidor")
    void shouldProcessBatchOf10OperationsAndPreserveTimestamps() throws Exception {
        InspectionDetailsResponse scheduled = scheduleInspection(technicianUser.getId());
        UUID inspectionId = scheduled.id();
        List<UUID> itemIds = scheduled.items().stream().map(i -> i.id()).toList();
        assertEquals(7, itemIds.size());

        String batchId = UUID.randomUUID().toString();
        BatchFixture fixture = build10OperationBatch(batchId, inspectionId, itemIds);

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .header("X-Idempotency-Key", batchId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fixture.jsonPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.batch_id").value(batchId))
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.total_operations").value(10))
                .andExpect(jsonPath("$.succeeded_count").value(10))
                .andExpect(jsonPath("$.failed_count").value(0))
                .andExpect(jsonPath("$.server_timestamp").isNotEmpty())
                .andExpect(jsonPath("$.processed", hasSize(10)))
                .andExpect(jsonPath("$.processed[0].operation_id").value(fixture.startOpId().toString()))
                .andExpect(jsonPath("$.processed[0].success").value(true))
                .andExpect(jsonPath("$.processed[0].status").value("SUCCESS"))
                .andExpect(jsonPath("$.processed[0].client_timestamp").isNotEmpty())
                .andExpect(jsonPath("$.processed[0].server_timestamp").isNotEmpty())
                .andExpect(jsonPath("$.processed[9].operation_id").value(fixture.completeOpId().toString()))
                .andExpect(jsonPath("$.processed[9].success").value(true));

        // Verifica persistência completa no banco
        assertEquals(10, processedOperationRepository.count());
        assertEquals(7, inspectionResponseRepository.countByInspectionId(inspectionId));
        assertEquals(1, nonConformityRepository.countByInspectionId(inspectionId));

        Inspection persisted = inspectionRepository.findById(inspectionId).orElseThrow();
        assertEquals(InspectionStatus.ENVIADA, persisted.getStatus());
        assertEquals(Instant.parse("2026-11-22T10:00:00Z"), persisted.getStartedAtDevice());
        assertEquals(Instant.parse("2026-11-22T10:25:00Z"), persisted.getCompletedAtDevice());
        assertNotNull(persisted.getStartedAtServer());
        assertNotNull(persisted.getSubmittedAtServer());
        assertEquals(0, new BigDecimal("-23.5015300").compareTo(persisted.getStartLatitude()));
        assertEquals(0, new BigDecimal("-23.5016100").compareTo(persisted.getCompleteLatitude()));

        InspectionResponse numericResponse = inspectionResponseRepository
                .findByInspectionIdAndInspectionItemId(inspectionId, itemIds.get(3))
                .orElseThrow();
        assertEquals(0, new BigDecimal("1250.5").compareTo(numericResponse.getValueNumber()));

        InspectionResponse dateResponse = inspectionResponseRepository
                .findByInspectionIdAndInspectionItemId(inspectionId, itemIds.get(4))
                .orElseThrow();
        assertEquals(LocalDate.of(2026, 11, 15), dateResponse.getValueDate());

        NonConformity nc = nonConformityRepository.findByInspectionIdOrderByCreatedAtAsc(inspectionId).get(0);
        assertEquals(NonConformitySeverity.ALTA, nc.getSeverity());
        assertEquals(Instant.parse("2026-11-22T10:20:00Z"), nc.getCreatedAtDevice());

        List<AuditLog> logs = auditLogRepository.findByInspectionIdOrderByOccurredAtAsc(inspectionId);
        assertTrue(logs.stream().anyMatch(l -> "INSPECTION_STARTED".equals(l.getAction())));
        assertTrue(logs.stream().anyMatch(l -> "RESPONSE_CREATED".equals(l.getAction())));
        assertTrue(logs.stream().anyMatch(l -> "NON_CONFORMITY_CREATED".equals(l.getAction())));
        assertTrue(logs.stream().anyMatch(l -> "INSPECTION_COMPLETED".equals(l.getAction())));
    }

    @Test
    @DisplayName("CA-02 / RF-03 / RT-01: Reenviar o mesmo lote idêntico retorna ALREADY_PROCESSED sem duplicar registros")
    void shouldHandleDuplicateBatchReplayIdempotentlyWithoutDuplicatingRecords() throws Exception {
        InspectionDetailsResponse scheduled = scheduleInspection(technicianUser.getId());
        UUID inspectionId = scheduled.id();
        List<UUID> itemIds = scheduled.items().stream().map(i -> i.id()).toList();

        String batchId = UUID.randomUUID().toString();
        BatchFixture fixture = build10OperationBatch(batchId, inspectionId, itemIds);

        // 1º envio
        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .header("X-Idempotency-Key", batchId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fixture.jsonPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.succeeded_count").value(10));

        long auditCountAfterFirstRun = auditLogRepository.count();

        // 2º envio exatamente igual (simulando reenvio por queda de rede)
        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .header("X-Idempotency-Key", batchId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fixture.jsonPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.total_operations").value(10))
                .andExpect(jsonPath("$.succeeded_count").value(10))
                .andExpect(jsonPath("$.failed_count").value(0))
                .andExpect(jsonPath("$.processed[0].success").value(true))
                .andExpect(jsonPath("$.processed[0].status").value("ALREADY_PROCESSED"))
                .andExpect(jsonPath("$.processed[0].error_code").value("ALREADY_PROCESSED"))
                .andExpect(jsonPath("$.processed[9].success").value(true))
                .andExpect(jsonPath("$.processed[9].status").value("ALREADY_PROCESSED"))
                .andExpect(jsonPath("$.processed[9].error_code").value("ALREADY_PROCESSED"));

        // Nenhum registro duplicado no banco
        assertEquals(10, processedOperationRepository.count());
        assertEquals(7, inspectionResponseRepository.countByInspectionId(inspectionId));
        assertEquals(1, nonConformityRepository.countByInspectionId(inspectionId));
        assertEquals(auditCountAfterFirstRun, auditLogRepository.count());
    }

    @Test
    @DisplayName("RF-04 / RN-069: Processa lote fora de ordem respeitando dependência START -> SAVE_RESPONSE -> CREATE_NC -> COMPLETE")
    void shouldOrderOutOfOrderBatchAccordingToDependencyRules() throws Exception {
        InspectionDetailsResponse scheduled = scheduleInspection(technicianUser.getId());
        UUID inspectionId = scheduled.id();
        List<UUID> itemIds = scheduled.items().stream().map(i -> i.id()).toList();

        UUID startOpId = UUID.randomUUID();
        UUID resp1OpId = UUID.randomUUID();
        UUID resp2OpId = UUID.randomUUID();
        UUID resp3OpId = UUID.randomUUID();
        UUID resp4OpId = UUID.randomUUID();
        UUID resp5OpId = UUID.randomUUID();
        UUID resp6OpId = UUID.randomUUID();
        UUID ncOpId = UUID.randomUUID();
        UUID completeOpId = UUID.randomUUID();

        // Ordem intencionalmente invertida: COMPLETE primeiro, depois CREATE_NC, depois SAVE_RESPONSE, e START por último
        String shuffledBatchJson = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "COMPLETE_INSPECTION",
                      "entity_type": "INSPECTION",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T11:30:00Z",
                      "dependencies": ["%s", "%s"],
                      "payload": { "inspectionId": "%s", "completedAt": "2026-11-22T11:30:00Z" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "CREATE_NON_CONFORMITY",
                      "entity_type": "NON_CONFORMITY",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T11:20:00Z",
                      "payload": {
                        "inspectionId": "%s",
                        "itemId": "%s",
                        "title": "Lacre rompido",
                        "description": "Lacre frontal ausente",
                        "severity": "MEDIA"
                      }
                    },
                    { "operation_id": "%s", "operation_type": "SAVE_RESPONSE", "client_timestamp": "2026-11-22T11:05:00Z", "payload": { "inspectionId": "%s", "itemId": "%s", "value": "NON_CONFORMING" } },
                    { "operation_id": "%s", "operation_type": "SUBMIT_RESPONSE", "client_timestamp": "2026-11-22T11:06:00Z", "payload": { "inspectionId": "%s", "itemId": "%s", "value": "true" } },
                    { "operation_id": "%s", "operation_type": "SAVE_RESPONSE", "client_timestamp": "2026-11-22T11:07:00Z", "payload": { "inspectionId": "%s", "itemId": "%s", "value": "Automático" } },
                    { "operation_id": "%s", "operation_type": "SAVE_RESPONSE", "client_timestamp": "2026-11-22T11:08:00Z", "payload": { "inspectionId": "%s", "itemId": "%s", "value": "980" } },
                    { "operation_id": "%s", "operation_type": "SAVE_RESPONSE", "client_timestamp": "2026-11-22T11:09:00Z", "payload": { "inspectionId": "%s", "itemId": "%s", "value": "2026-11-10" } },
                    { "operation_id": "%s", "operation_type": "SAVE_RESPONSE", "client_timestamp": "2026-11-22T11:10:00Z", "payload": { "inspectionId": "%s", "itemId": "%s", "value": "João Supervisor" } },
                    {
                      "operation_id": "%s",
                      "operation_type": "START_INSPECTION",
                      "entity_type": "INSPECTION",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T11:00:00Z",
                      "payload": { "inspectionId": "%s", "startedAt": "2026-11-22T11:00:00Z" }
                    }
                  ]
                }
                """.formatted(
                UUID.randomUUID(),
                completeOpId, inspectionId, startOpId, ncOpId, inspectionId,
                ncOpId, UUID.randomUUID(), inspectionId, itemIds.get(0),
                resp1OpId, inspectionId, itemIds.get(0),
                resp2OpId, inspectionId, itemIds.get(1),
                resp3OpId, inspectionId, itemIds.get(2),
                resp4OpId, inspectionId, itemIds.get(3),
                resp5OpId, inspectionId, itemIds.get(4),
                resp6OpId, inspectionId, itemIds.get(5),
                startOpId, inspectionId, inspectionId
        );

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(shuffledBatchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.succeeded_count").value(9))
                .andExpect(jsonPath("$.failed_count").value(0))
                .andExpect(jsonPath("$.processed[0].operation_type").value("START_INSPECTION"))
                .andExpect(jsonPath("$.processed[1].operation_type").value("SAVE_RESPONSE"))
                .andExpect(jsonPath("$.processed[7].operation_type").value("CREATE_NON_CONFORMITY"))
                .andExpect(jsonPath("$.processed[8].operation_type").value("COMPLETE_INSPECTION"));

        Inspection persisted = inspectionRepository.findById(inspectionId).orElseThrow();
        assertEquals(InspectionStatus.ENVIADA, persisted.getStatus());
    }

    @Test
    @DisplayName("CA-03 / RF-05: Falha por regra de negócio em uma operação não reverte outras operações válidas do lote")
    void shouldIsolatePartialFailureWithoutDiscardingValidOperations() throws Exception {
        InspectionDetailsResponse scheduled = scheduleInspection(technicianUser.getId());
        UUID inspectionId = scheduled.id();
        List<UUID> itemIds = scheduled.items().stream().map(i -> i.id()).toList();

        UUID startOpId = UUID.randomUUID();
        UUID validRespOpId = UUID.randomUUID();
        UUID invalidNumericRespOpId = UUID.randomUUID();
        UUID validNcOpId = UUID.randomUUID();
        UUID missingItemOpId = UUID.randomUUID();

        String partialBatchJson = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "START_INSPECTION",
                      "client_timestamp": "2026-11-22T12:00:00Z",
                      "payload": { "inspectionId": "%s", "startedAt": "2026-11-22T12:00:00Z" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T12:02:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "CONFORMING" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T12:03:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "TEXTO_NAO_NUMERICO" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "CREATE_NON_CONFORMITY",
                      "client_timestamp": "2026-11-22T12:04:00Z",
                      "payload": {
                        "inspectionId": "%s",
                        "itemId": "%s",
                        "title": "Ruído anormal",
                        "description": "Ruído metálico detectado no rolamento",
                        "severity": "MEDIA"
                      }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T12:05:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "true" }
                    }
                  ]
                }
                """.formatted(
                UUID.randomUUID(),
                startOpId, inspectionId,
                validRespOpId, inspectionId, itemIds.get(0),
                invalidNumericRespOpId, inspectionId, itemIds.get(3),
                validNcOpId, inspectionId, itemIds.get(0),
                missingItemOpId, inspectionId, UUID.randomUUID()
        );

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(partialBatchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PARTIAL_SUCCESS"))
                .andExpect(jsonPath("$.total_operations").value(5))
                .andExpect(jsonPath("$.succeeded_count").value(3))
                .andExpect(jsonPath("$.failed_count").value(2))
                .andExpect(jsonPath("$.processed[0].operation_id").value(startOpId.toString()))
                .andExpect(jsonPath("$.processed[0].success").value(true))
                .andExpect(jsonPath("$.processed[1].operation_id").value(validRespOpId.toString()))
                .andExpect(jsonPath("$.processed[1].success").value(true))
                .andExpect(jsonPath("$.processed[2].operation_id").value(invalidNumericRespOpId.toString()))
                .andExpect(jsonPath("$.processed[2].success").value(false))
                .andExpect(jsonPath("$.processed[2].status").value("FAILED"))
                .andExpect(jsonPath("$.processed[2].error_code").value("INVALID_RESPONSE_VALUE"))
                .andExpect(jsonPath("$.processed[3].operation_id").value(missingItemOpId.toString()))
                .andExpect(jsonPath("$.processed[3].success").value(false))
                .andExpect(jsonPath("$.processed[3].error_code").value("SNAPSHOT_ITEM_NOT_FOUND"))
                .andExpect(jsonPath("$.processed[4].operation_id").value(validNcOpId.toString()))
                .andExpect(jsonPath("$.processed[4].success").value(true));

        // Operações válidas foram persistidas normalmente
        assertEquals(3, processedOperationRepository.count());
        assertEquals(1, inspectionResponseRepository.countByInspectionId(inspectionId));
        assertEquals(1, nonConformityRepository.countByInspectionId(inspectionId));
        assertEquals(InspectionStatus.EM_ANDAMENTO, inspectionRepository.findById(inspectionId).orElseThrow().getStatus());
        assertFalse(processedOperationRepository.existsById(invalidNumericRespOpId));
        assertFalse(processedOperationRepository.existsById(missingItemOpId));
    }

    @Test
    @DisplayName("EX-01 / RT-02: Operação tardia em inspeção já APROVADA ou com versão divergente é rejeitada com CONFLICT")
    void shouldRejectLateMutationOnApprovedInspectionAndVersionMismatchWithConflict() throws Exception {
        InspectionDetailsResponse approvedScheduled = scheduleInspection(technicianUser.getId());
        UUID approvedId = approvedScheduled.id();
        UUID approvedItemId = approvedScheduled.items().get(0).id();

        Inspection approvedEntity = inspectionRepository.findById(approvedId).orElseThrow();
        approvedEntity.setStatus(InspectionStatus.APROVADA);
        approvedEntity.setApprovedAt(Instant.now());
        inspectionRepository.saveAndFlush(approvedEntity);

        UUID lateRespOpId = UUID.randomUUID();
        UUID lateCompleteOpId = UUID.randomUUID();

        String conflictBatchJson = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T13:00:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "CONFORMING" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "COMPLETE_INSPECTION",
                      "client_timestamp": "2026-11-22T13:05:00Z",
                      "payload": { "inspectionId": "%s" }
                    }
                  ]
                }
                """.formatted(
                UUID.randomUUID(),
                lateRespOpId, approvedId, approvedItemId,
                lateCompleteOpId, approvedId
        );

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(conflictBatchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.failed_count").value(2))
                .andExpect(jsonPath("$.processed[0].success").value(false))
                .andExpect(jsonPath("$.processed[0].status").value("CONFLICT"))
                .andExpect(jsonPath("$.processed[0].error_code").value("CONFLICT"))
                .andExpect(jsonPath("$.processed[1].success").value(false))
                .andExpect(jsonPath("$.processed[1].status").value("CONFLICT"))
                .andExpect(jsonPath("$.processed[1].error_code").value("CONFLICT"));

        assertEquals(InspectionStatus.APROVADA, inspectionRepository.findById(approvedId).orElseThrow().getStatus());
        assertEquals(0, inspectionResponseRepository.countByInspectionId(approvedId));

        // RT-02: Conflito por versão otimista divergente (base_version obsoleta)
        InspectionDetailsResponse versionedScheduled = scheduleInspection(technicianUser.getId());
        UUID versionedId = versionedScheduled.id();
        UUID versionedItemId = versionedScheduled.items().get(0).id();

        Inspection modifiedOnServer = inspectionRepository.findById(versionedId).orElseThrow();
        modifiedOnServer.setInstructions("Instruções atualizadas pelo supervisor no servidor");
        inspectionRepository.saveAndFlush(modifiedOnServer);
        int currentServerVersion = inspectionRepository.findById(versionedId).orElseThrow().getVersion();
        assertTrue(currentServerVersion > 0);

        String staleVersionBatchJson = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "base_version": 0,
                      "client_timestamp": "2026-11-22T13:10:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "CONFORMING" }
                    }
                  ]
                }
                """.formatted(UUID.randomUUID(), UUID.randomUUID(), versionedId, versionedItemId);

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staleVersionBatchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.processed[0].success").value(false))
                .andExpect(jsonPath("$.processed[0].status").value("CONFLICT"))
                .andExpect(jsonPath("$.processed[0].error_code").value("CONFLICT"));
    }

    @Test
    @DisplayName("CA-04 / RF-07 / RT-03: Upload multipart de JPEG e PNG grava com UUID + SHA-256 e vincula à resposta e NC")
    void shouldUploadJpegAndPngWithUuidNameSha256AndLinkToResponseAndNonConformity() throws Exception {
        InspectionDetailsResponse scheduled = scheduleInspection(technicianUser.getId());
        UUID inspectionId = scheduled.id();
        UUID itemId = scheduled.items().get(0).id();

        // Cria resposta e não conformidade antes do upload
        UUID ncId = UUID.randomUUID();
        String prepBatch = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T14:00:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "NON_CONFORMING" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "CREATE_NON_CONFORMITY",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T14:01:00Z",
                      "payload": {
                        "id": "%s",
                        "inspectionId": "%s",
                        "itemId": "%s",
                        "title": "Lacre violado",
                        "description": "Evidência fotográfica anexa",
                        "severity": "ALTA"
                      }
                    }
                  ]
                }
                """.formatted(
                UUID.randomUUID(),
                UUID.randomUUID(), inspectionId, itemId,
                UUID.randomUUID(), ncId, ncId, inspectionId, itemId
        );

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(prepBatch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));

        InspectionResponse savedResponse = inspectionResponseRepository
                .findByInspectionIdAndInspectionItemId(inspectionId, itemId)
                .orElseThrow();

        // 1) Upload JPEG com evidenceId, operationId e checksum explícitos
        byte[] jpegBytes = createValidImageBytes("jpg");
        String jpegSha256 = sha256Hex(jpegBytes);
        UUID jpegEvidenceId = UUID.randomUUID();
        UUID jpegUploadOpId = UUID.randomUUID();

        MockMultipartFile jpegFile = new MockMultipartFile(
                "file",
                "foto-original-celular.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                jpegBytes
        );

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(jpegFile)
                        .param("inspectionId", inspectionId.toString())
                        .param("itemId", itemId.toString())
                        .param("evidenceId", jpegEvidenceId.toString())
                        .param("operationId", jpegUploadOpId.toString())
                        .param("checksumSha256", jpegSha256)
                        .param("clientTimestamp", "2026-11-22T14:02:00Z")
                        .param("description", "Foto frontal do lacre")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.evidence_id").value(jpegEvidenceId.toString()))
                .andExpect(jsonPath("$.operation_id").value(jpegUploadOpId.toString()))
                .andExpect(jsonPath("$.inspection_id").value(inspectionId.toString()))
                .andExpect(jsonPath("$.inspection_item_id").value(itemId.toString()))
                .andExpect(jsonPath("$.response_id").value(savedResponse.getId().toString()))
                .andExpect(jsonPath("$.file_name").value(jpegEvidenceId + ".jpg"))
                .andExpect(jsonPath("$.mime_type").value("image/jpeg"))
                .andExpect(jsonPath("$.checksum_sha256").value(jpegSha256))
                .andExpect(jsonPath("$.status").value("UPLOADED"))
                .andExpect(jsonPath("$.already_processed").value(false));

        // Reenvio idempotente do mesmo operationId retorna HTTP 200 sem duplicar
        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(jpegFile)
                        .param("inspectionId", inspectionId.toString())
                        .param("operationId", jpegUploadOpId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidence_id").value(jpegEvidenceId.toString()))
                .andExpect(jsonPath("$.already_processed").value(true));

        // 2) Upload PNG vinculado à não conformidade
        byte[] pngBytes = createValidImageBytes("png");
        String pngSha256 = sha256Hex(pngBytes);
        UUID pngEvidenceId = UUID.randomUUID();

        MockMultipartFile pngFile = new MockMultipartFile(
                "file",
                "detalhe-lacre.png",
                MediaType.IMAGE_PNG_VALUE,
                pngBytes
        );

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(pngFile)
                        .param("inspection_id", inspectionId.toString())
                        .param("evidence_id", pngEvidenceId.toString())
                        .param("non_conformity_id", ncId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.evidence_id").value(pngEvidenceId.toString()))
                .andExpect(jsonPath("$.non_conformity_id").value(ncId.toString()))
                .andExpect(jsonPath("$.file_name").value(pngEvidenceId + ".png"))
                .andExpect(jsonPath("$.mime_type").value("image/png"))
                .andExpect(jsonPath("$.checksum_sha256").value(pngSha256))
                .andExpect(jsonPath("$.status").value("UPLOADED"));

        // Verifica arquivos físicos no disco e download via API
        EvidenceFile storedJpeg = evidenceFileRepository.findById(jpegEvidenceId).orElseThrow();
        assertEquals(EvidenceFileStatus.UPLOADED, storedJpeg.getStatus());
        assertEquals(savedResponse.getId(), storedJpeg.getResponseId());
        assertTrue(Files.exists(TEST_EVIDENCE_DIR.resolve(storedJpeg.getStorageKey())));

        MvcResult downloadResult = mockMvc.perform(get("/api/v1/sync/evidences/" + jpegEvidenceId + "/content")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andReturn();
        assertArrayEquals(jpegBytes, downloadResult.getResponse().getContentAsByteArray());

        // Técnico diferente não pode baixar ou enviar evidência para inspeção de outro técnico
        mockMvc.perform(get("/api/v1/sync/evidences/" + jpegEvidenceId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + otherTechnicianToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("EX-02 / EX-01: Upload de arquivo com formato inválido ou imagem corrompida retorna HTTP 415 e inspeção aprovada retorna HTTP 409")
    void shouldReturnHttp415ForInvalidOrCorruptedImageAnd409ForApprovedInspection() throws Exception {
        InspectionDetailsResponse scheduled = scheduleInspection(technicianUser.getId());
        UUID inspectionId = scheduled.id();

        // 1) MIME type inválido (text/plain) -> HTTP 415
        MockMultipartFile textFile = new MockMultipartFile(
                "file",
                "observacoes.txt",
                MediaType.TEXT_PLAIN_VALUE,
                "isto nao e uma imagem".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(textFile)
                        .param("inspectionId", inspectionId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415))
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"))
                .andExpect(jsonPath("$.file_status").value("FAILED"))
                .andExpect(jsonPath("$.file_name").value("observacoes.txt"));

        // 2) Conteúdo corrompido disfarçado com MIME image/jpeg -> HTTP 415
        MockMultipartFile fakeJpeg = new MockMultipartFile(
                "file",
                "corrompida.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "BYTES_CORROMPIDOS_NAO_JPEG".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(fakeJpeg)
                        .param("inspectionId", inspectionId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415))
                .andExpect(jsonPath("$.code").value("CORRUPTED_OR_INVALID_JPEG"))
                .andExpect(jsonPath("$.file_status").value("FAILED"));

        // 3) Cabeçalho mágico JPEG válido seguido de bytes corrompidos -> HTTP 415
        MockMultipartFile truncatedJpeg = new MockMultipartFile(
                "file",
                "truncada.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46}
        );

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(truncatedJpeg)
                        .param("inspectionId", inspectionId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415))
                .andExpect(jsonPath("$.code").value("CORRUPTED_IMAGE_DATA"))
                .andExpect(jsonPath("$.file_status").value("FAILED"));

        // 4) Arquivo PNG vazio -> HTTP 415
        MockMultipartFile emptyPng = new MockMultipartFile(
                "file",
                "vazia.png",
                MediaType.IMAGE_PNG_VALUE,
                new byte[0]
        );

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(emptyPng)
                        .param("inspectionId", inspectionId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415))
                .andExpect(jsonPath("$.code").value("EMPTY_OR_CORRUPTED_IMAGE"))
                .andExpect(jsonPath("$.file_status").value("FAILED"));

        // 5) Upload válido para inspeção já APROVADA -> HTTP 409 CONFLICT
        Inspection entity = inspectionRepository.findById(inspectionId).orElseThrow();
        entity.setStatus(InspectionStatus.APROVADA);
        entity.setApprovedAt(Instant.now());
        inspectionRepository.saveAndFlush(entity);

        MockMultipartFile validPng = new MockMultipartFile(
                "file",
                "tardia.png",
                MediaType.IMAGE_PNG_VALUE,
                createValidImageBytes("png")
        );

        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(validPng)
                        .param("inspectionId", inspectionId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        assertEquals(0, evidenceFileRepository.countByInspectionId(inspectionId));
    }

    private InspectionDetailsResponse scheduleInspection(UUID technicianId) {
        AuthenticatedUser actor = new AuthenticatedUser(
                supervisorUser.getId(),
                supervisorUser.getEmail(),
                supervisorUser.getRole()
        );
        return inspectionSchedulingService.schedule(
                new ScheduleInspectionRequest(
                        publishedTemplate.id(),
                        null,
                        null,
                        client.getId(),
                        site.getId(),
                        equipment.getId(),
                        technicianId,
                        supervisorUser.getId(),
                        Instant.now().plus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString(),
                        null,
                        "Inspeção Teste Sync",
                        "Instruções de campo",
                        InspectionPriority.ALTA
                ),
                actor
        );
    }

    private BatchFixture build10OperationBatch(String batchId, UUID inspectionId, List<UUID> itemIds) {
        UUID startOpId = UUID.randomUUID();
        UUID opResp1 = UUID.randomUUID();
        UUID opResp2 = UUID.randomUUID();
        UUID opResp3 = UUID.randomUUID();
        UUID opResp4 = UUID.randomUUID();
        UUID opResp5 = UUID.randomUUID();
        UUID opResp6 = UUID.randomUUID();
        UUID opResp7 = UUID.randomUUID();
        UUID ncOpId = UUID.randomUUID();
        UUID completeOpId = UUID.randomUUID();

        String json = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "START_INSPECTION",
                      "entity_type": "INSPECTION",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:00:00Z",
                      "payload": {
                        "inspectionId": "%s",
                        "startedAt": "2026-11-22T10:00:00Z",
                        "location": { "latitude": -23.5015300, "longitude": -47.4525600, "accuracy": 8.5 }
                      }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "entity_type": "CHECKLIST_RESPONSE",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:05:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "NON_CONFORMING", "observation": "Lacre danificado" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "entity_type": "CHECKLIST_RESPONSE",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:07:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "true" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "entity_type": "CHECKLIST_RESPONSE",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:09:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "Manual" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "entity_type": "CHECKLIST_RESPONSE",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:11:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "1250.5" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "entity_type": "CHECKLIST_RESPONSE",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:13:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "2026-11-15" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "entity_type": "CHECKLIST_RESPONSE",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:15:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "Marcos Silva" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "entity_type": "CHECKLIST_RESPONSE",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:17:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "Equipamento em operação normal" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "CREATE_NON_CONFORMITY",
                      "entity_type": "NON_CONFORMITY",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:20:00Z",
                      "payload": {
                        "inspectionId": "%s",
                        "itemId": "%s",
                        "title": "Lacre rompido no painel",
                        "description": "Necessária substituição imediata do lacre de segurança.",
                        "severity": "ALTA",
                        "createdAtDevice": "2026-11-22T10:20:00Z"
                      }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "COMPLETE_INSPECTION",
                      "entity_type": "INSPECTION",
                      "global_id": "%s",
                      "client_timestamp": "2026-11-22T10:25:00Z",
                      "dependencies": ["%s", "%s"],
                      "payload": {
                        "inspectionId": "%s",
                        "completedAt": "2026-11-22T10:25:00Z",
                        "location": { "latitude": -23.5016100, "longitude": -47.4526100, "accuracy": 6.0 }
                      }
                    }
                  ]
                }
                """.formatted(
                batchId,
                startOpId, inspectionId, inspectionId,
                opResp1, UUID.randomUUID(), inspectionId, itemIds.get(0),
                opResp2, UUID.randomUUID(), inspectionId, itemIds.get(1),
                opResp3, UUID.randomUUID(), inspectionId, itemIds.get(2),
                opResp4, UUID.randomUUID(), inspectionId, itemIds.get(3),
                opResp5, UUID.randomUUID(), inspectionId, itemIds.get(4),
                opResp6, UUID.randomUUID(), inspectionId, itemIds.get(5),
                opResp7, UUID.randomUUID(), inspectionId, itemIds.get(6),
                ncOpId, UUID.randomUUID(), inspectionId, itemIds.get(0),
                completeOpId, inspectionId, startOpId, ncOpId, inspectionId
        );

        return new BatchFixture(startOpId, completeOpId, json);
    }

    private byte[] createValidImageBytes(String formatName) throws Exception {
        BufferedImage image = new BufferedImage(12, 12, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, 12, 12);
        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(image, formatName, baos));
        return baos.toByteArray();
    }

    private String sha256Hex(byte[] bytes) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return HexFormat.of().formatHex(digest.digest(bytes));
    }

    private record BatchFixture(UUID startOpId, UUID completeOpId, String jsonPayload) {
    }
}
