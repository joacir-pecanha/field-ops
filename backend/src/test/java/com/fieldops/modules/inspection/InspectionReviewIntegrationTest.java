package com.fieldops.modules.inspection;

import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.inspection.domain.AuditLog;
import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionPriority;
import com.fieldops.modules.inspection.domain.InspectionReview;
import com.fieldops.modules.inspection.domain.InspectionReviewDecision;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.dto.ScheduleInspectionRequest;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.inspection.repository.InspectionReviewRepository;
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
import com.fieldops.modules.sync.domain.InspectionResponse;
import com.fieldops.modules.sync.domain.NonConformity;
import com.fieldops.modules.sync.domain.NonConformitySeverity;
import com.fieldops.modules.sync.domain.NonConformityStatus;
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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes de integração da máquina de estados de revisão, aprovação, reprovação,
 * bloqueio pós-aprovação, ajustes administrativos e trilha assíncrona de auditoria (TASK-019 Passo 6).
 */
@SpringBootTest
@ActiveProfiles("test")
class InspectionReviewIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private InspectionRepository inspectionRepository;

    @Autowired
    private InspectionReviewRepository inspectionReviewRepository;

    @Autowired
    private InspectionItemSnapshotRepository snapshotRepository;

    @Autowired
    private InspectionResponseRepository inspectionResponseRepository;

    @Autowired
    private NonConformityRepository nonConformityRepository;

    @Autowired
    private EvidenceFileRepository evidenceFileRepository;

    @Autowired
    private ProcessedOperationRepository processedOperationRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

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

    private User adminUser;
    private User supervisorUser;
    private User inactiveSupervisorUser;
    private User technicianUser;

    private String adminToken;
    private String supervisorToken;
    private String inactiveSupervisorToken;
    private String technicianToken;

    private Client client;
    private Site site;
    private Equipment equipment;
    private TemplateResponse publishedTemplate;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        cleanDatabase();

        String hash = passwordEncoder.encode("FieldOps@123");
        adminUser = userRepository.save(new User(
                UUID.randomUUID(), "Admin Revisão", "admin.review@fieldops.com", hash,
                UserRole.ADMIN, UserStatus.ACTIVE, "+5511999994001"
        ));
        supervisorUser = userRepository.save(new User(
                UUID.randomUUID(), "Supervisor Revisão", "supervisor.review@fieldops.com", hash,
                UserRole.SUPERVISOR, UserStatus.ACTIVE, "+5511999994002"
        ));
        inactiveSupervisorUser = userRepository.save(new User(
                UUID.randomUUID(), "Supervisor Inativo", "supervisor.inativo@fieldops.com", hash,
                UserRole.SUPERVISOR, UserStatus.INACTIVE, "+5511999994003"
        ));
        technicianUser = userRepository.save(new User(
                UUID.randomUUID(), "Técnico Revisão", "tecnico.review@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.ACTIVE, "+5511999994004"
        ));

        adminToken = jwtTokenProvider.generateAccessToken(adminUser);
        supervisorToken = jwtTokenProvider.generateAccessToken(supervisorUser);
        inactiveSupervisorToken = jwtTokenProvider.generateAccessToken(inactiveSupervisorUser);
        technicianToken = jwtTokenProvider.generateAccessToken(technicianUser);

        client = new Client();
        client.setId(UUID.randomUUID());
        client.setCode("CLI-REV-01");
        client.setName("Indústria Revisão S.A.");
        client.setStatus(MasterStatus.ACTIVE);
        client = clientRepository.save(client);

        site = new Site();
        site.setId(UUID.randomUUID());
        site.setClient(client);
        site.setCode("SITE-REV-01");
        site.setName("Unidade Itu");
        site.setCity("Itu");
        site.setState("SP");
        site.setStatus(MasterStatus.ACTIVE);
        site = siteRepository.save(site);

        equipment = new Equipment();
        equipment.setId(UUID.randomUUID());
        equipment.setSite(site);
        equipment.setCode("EQP-REV-01");
        equipment.setName("Compressor Industrial CP-10");
        equipment.setQrCode("QR-REV-01");
        equipment.setStatus(EquipmentStatus.ACTIVE);
        equipment = equipmentRepository.save(equipment);

        publishedTemplate = templateService.createDraft(
                new TemplateRequest(
                        "TPL-REV-01",
                        "Checklist de Revisão Técnica",
                        "Modelo para validação de ciclo de revisão",
                        "MECANICA",
                        List.of(
                                new TemplateSectionRequest(
                                        "Verificações Gerais",
                                        "Itens obrigatórios",
                                        0,
                                        List.of(
                                                new TemplateItemRequest(
                                                        "REV-01",
                                                        "Integridade do lacre",
                                                        null,
                                                        ResponseType.CONFORMITY,
                                                        true,
                                                        true,
                                                        false,
                                                        null,
                                                        null,
                                                        0
                                                ),
                                                new TemplateItemRequest(
                                                        "REV-02",
                                                        "Leitura do horímetro",
                                                        null,
                                                        ResponseType.NUMBER,
                                                        true,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        1
                                                )
                                        )
                                )
                        )
                ),
                supervisorUser.getId()
        );
        templateService.publish(publishedTemplate.id(), supervisorUser.getId());
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    private void cleanDatabase() {
        processedOperationRepository.deleteAll();
        evidenceFileRepository.deleteAll();
        nonConformityRepository.deleteAll();
        inspectionResponseRepository.deleteAll();
        inspectionReviewRepository.deleteAll();
        auditLogRepository.deleteAll();
        snapshotRepository.deleteAll();
        inspectionRepository.deleteAll();
        templateRepository.deleteAll();
        equipmentRepository.deleteAll();
        siteRepository.deleteAll();
        clientRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("CA-01 / CA-02 / CA-04 / RF-02..RF-04: Iniciar revisão (ENVIADA->EM_REVISÃO), aprovar e bloquear alterações comuns")
    void shouldStartReviewApproveWithAuditAndLockApprovedInspection() throws Exception {
        InspectionDetailsResponse submitted = createSubmittedInspection();
        UUID inspectionId = submitted.id();

        // 1. Supervisor inicia revisão: ENVIADA -> EM_REVISÃO
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_REVISÃO"))
                .andExpect(jsonPath("$.reviewStartedBy").value(supervisorUser.getId().toString()))
                .andExpect(jsonPath("$.reviewStartedAt").isNotEmpty())
                .andExpect(jsonPath("$.reviewCycle").value(1))
                .andExpect(jsonPath("$.responses", hasSize(2)))
                .andExpect(jsonPath("$.reviews", hasSize(1)));

        // 2. Supervisor aprova a inspeção com comentários opcionais
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comments": "Inspeção validada em conformidade total."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APROVADA"))
                .andExpect(jsonPath("$.approvedBy").value(supervisorUser.getId().toString()))
                .andExpect(jsonPath("$.approvedByName").value("Supervisor Revisão"))
                .andExpect(jsonPath("$.approvedAt").isNotEmpty())
                .andExpect(jsonPath("$.reviewComments").value("Inspeção validada em conformidade total."))
                .andExpect(jsonPath("$.reviews", hasSize(2)));

        Inspection approvedEntity = inspectionRepository.findById(inspectionId).orElseThrow();
        assertEquals(InspectionStatus.APROVADA, approvedEntity.getStatus());
        assertEquals(supervisorUser.getId(), approvedEntity.getApprovedBy());
        assertNotNull(approvedEntity.getApprovedAt());

        // CA-04 / RT-02: Auditoria registra usuário, data, ação, estado anterior e novo estado
        List<AuditLog> logs = auditLogRepository.findByInspectionIdOrderByOccurredAtAsc(inspectionId);
        AuditLog reviewStartedLog = logs.stream()
                .filter(l -> "REVIEW_STARTED".equals(l.getAction()))
                .findFirst()
                .orElseThrow();
        assertEquals("ENVIADA", reviewStartedLog.getPreviousStatus());
        assertEquals("EM_REVISÃO", reviewStartedLog.getNewStatus());
        assertEquals(supervisorUser.getId(), reviewStartedLog.getActorId());
        assertEquals("supervisor.review@fieldops.com", reviewStartedLog.getActorEmail());
        assertNotNull(reviewStartedLog.getOccurredAt());

        AuditLog approvedLog = logs.stream()
                .filter(l -> "INSPECTION_APPROVED".equals(l.getAction()))
                .findFirst()
                .orElseThrow();
        assertEquals("EM_REVISÃO", approvedLog.getPreviousStatus());
        assertEquals("APROVADA", approvedLog.getNewStatus());
        assertEquals(supervisorUser.getId(), approvedLog.getActorId());
        assertTrue(approvedLog.getDetails().contains("Inspeção validada em conformidade total."));

        // RF-04 / RN-082: Inspeção APROVADA fica estritamente bloqueada para edição/revisão/cancelamento/sync
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INSPECTION_LOCKED_APPROVED"));

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INSPECTION_ALREADY_APPROVED"));

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/reject")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rejection_reason\":\"Tentativa após aprovação\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INSPECTION_LOCKED_APPROVED"));

        UUID itemId = submitted.items().get(1).id();
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/responses/" + itemId + "/admin-adjustment")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adjustedValue\":\"1500\",\"reason\":\"Tentativa após aprovação\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INSPECTION_LOCKED_FOR_EDIT"));

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/cancel")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Tentativa de cancelar aprovada\"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("APPROVED_INSPECTION_CANNOT_BE_CANCELED"));

        // Técnico não consegue enviar mutações via sync/batch nem upload de evidência após aprovação
        String lateSyncBatch = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T22:00:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "999" }
                    }
                  ]
                }
                """.formatted(UUID.randomUUID(), UUID.randomUUID(), inspectionId, itemId);

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(lateSyncBatch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.processed[0].status").value("CONFLICT"));

        MockMultipartFile latePhoto = new MockMultipartFile(
                "file",
                "tardia.png",
                MediaType.IMAGE_PNG_VALUE,
                createValidPngBytes()
        );
        mockMvc.perform(multipart("/api/v1/sync/upload")
                        .file(latePhoto)
                        .param("inspectionId", inspectionId.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("CA-03 / EX-01 / RF-05 / RF-06: Bloqueia reprovação sem motivo (400), reprova com motivo, libera download e suporta ciclo de correção")
    void shouldRejectWithoutReasonWith400AndAllowCorrectionCycleWhenRejectedWithReason() throws Exception {
        InspectionDetailsResponse submitted = createSubmittedInspection();
        UUID inspectionId = submitted.id();
        UUID numericItemId = submitted.items().get(1).id();

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_REVISÃO"));

        // EX-01: Sem corpo -> HTTP 400 com mensagem exata
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/reject")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("REJECTION_REASON_REQUIRED"))
                .andExpect(jsonPath("$.detail").value("O motivo da reprovação é obrigatório"))
                .andExpect(jsonPath("$.message").value("O motivo da reprovação é obrigatório"));

        // EX-01: Motivo vazio / espaços -> HTTP 400
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/reject")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rejection_reason\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("O motivo da reprovação é obrigatório"))
                .andExpect(jsonPath("$.errors.rejection_reason").value("O motivo da reprovação é obrigatório"));

        assertEquals(InspectionStatus.EM_REVISÃO, inspectionRepository.findById(inspectionId).orElseThrow().getStatus());

        // RF-05: Reprovação com motivo válido transita para REPROVADA
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/reject")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "rejection_reason": "Leitura do horímetro inconsistente com o histórico do equipamento.",
                                  "comments": "Conferir marcador digital no painel."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REPROVADA"))
                .andExpect(jsonPath("$.rejectedBy").value(supervisorUser.getId().toString()))
                .andExpect(jsonPath("$.rejectedByName").value("Supervisor Revisão"))
                .andExpect(jsonPath("$.rejectedAt").isNotEmpty())
                .andExpect(jsonPath("$.rejectionReason").value("Leitura do horímetro inconsistente com o histórico do equipamento."))
                .andExpect(jsonPath("$.rejection_reason").value("Leitura do horímetro inconsistente com o histórico do equipamento."))
                .andExpect(jsonPath("$.reviewCycle").value(1));

        // RF-06: Técnico baixa a inspeção REPROVADA para correção via GET /assigned
        mockMvc.perform(get("/api/v1/inspections/assigned?status=REPROVADA")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(inspectionId.toString()))
                .andExpect(jsonPath("$[0].status").value("REPROVADA"))
                .andExpect(jsonPath("$[0].rejectionReason").value("Leitura do horímetro inconsistente com o histórico do equipamento."))
                .andExpect(jsonPath("$[0].rejection_reason").value("Leitura do horímetro inconsistente com o histórico do equipamento."))
                .andExpect(jsonPath("$[0].responses", hasSize(2)))
                .andExpect(jsonPath("$[0].reviews", hasSize(2)));

        // Técnico corrige resposta via sync/batch (RN-083: histórico preservado em audit_logs) e conclui novamente
        String correctionBatch = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T20:10:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "1480.5", "observation": "Horímetro conferido presencialmente" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "COMPLETE_INSPECTION",
                      "client_timestamp": "2026-11-22T20:15:00Z",
                      "payload": { "inspectionId": "%s", "completedAt": "2026-11-22T20:15:00Z" }
                    }
                  ]
                }
                """.formatted(
                UUID.randomUUID(),
                UUID.randomUUID(), inspectionId, numericItemId,
                UUID.randomUUID(), inspectionId
        );

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(correctionBatch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.succeeded_count").value(2));

        assertEquals(InspectionStatus.ENVIADA, inspectionRepository.findById(inspectionId).orElseThrow().getStatus());

        // Ciclo 2: Supervisor (ou Admin) inicia revisão e aprova
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_REVISÃO"))
                .andExpect(jsonPath("$.reviewCycle").value(2));

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comments\":\"Correção validada e aprovada.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APROVADA"))
                .andExpect(jsonPath("$.approvedBy").value(adminUser.getId().toString()))
                .andExpect(jsonPath("$.reviewCycle").value(2));

        // Consulta histórico completo de ciclos de revisão
        mockMvc.perform(get("/api/v1/inspections/" + inspectionId + "/reviews")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].decision").value("REVIEW_STARTED"))
                .andExpect(jsonPath("$[0].reviewCycle").value(1))
                .andExpect(jsonPath("$[1].decision").value("REJECTED"))
                .andExpect(jsonPath("$[1].reviewCycle").value(1))
                .andExpect(jsonPath("$[2].decision").value("REVIEW_STARTED"))
                .andExpect(jsonPath("$[2].reviewCycle").value(2))
                .andExpect(jsonPath("$[3].decision").value("APPROVED"))
                .andExpect(jsonPath("$[3].reviewCycle").value(2));

        List<InspectionReview> reviews = inspectionReviewRepository.findByInspectionIdOrderByReviewCycleAscCreatedAtAsc(inspectionId);
        assertEquals(4, reviews.size());
        assertEquals(InspectionReviewDecision.REJECTED, reviews.get(1).getDecision());
        assertEquals(InspectionReviewDecision.APPROVED, reviews.get(3).getDecision());

        // RN-083: Log de atualização preservou o valor anterior antes da correção
        List<AuditLog> logs = auditLogRepository.findByInspectionIdOrderByOccurredAtAsc(inspectionId);
        AuditLog responseUpdatedLog = logs.stream()
                .filter(l -> "RESPONSE_UPDATED".equals(l.getAction()))
                .findFirst()
                .orElseThrow();
        assertNotNull(responseUpdatedLog.getPreviousValueJson());
        assertTrue(responseUpdatedLog.getPreviousValueJson().contains("1400"));
        assertTrue(responseUpdatedLog.getNewValueJson().contains("1480.5"));
    }

    @Test
    @DisplayName("RT-01 / EX-02: Bloqueia transições inválidas com HTTP 409 e permite aprovação direta a partir de ENVIADA")
    void shouldRejectInvalidTransitionsWithHttp409AndAllowDirectApprovalFromEnviada() throws Exception {
        InspectionDetailsResponse scheduled = scheduleInspection();
        UUID assignedId = scheduled.id();

        // ATRIBUÍDA não pode iniciar revisão, aprovar ou reprovar -> HTTP 409
        mockMvc.perform(post("/api/v1/inspections/" + assignedId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("INVALID_REVIEW_START_STATE"))
                .andExpect(jsonPath("$.currentStatus").value("ATRIBUÍDA"));

        mockMvc.perform(post("/api/v1/inspections/" + assignedId + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("INVALID_APPROVAL_STATE"));

        mockMvc.perform(post("/api/v1/inspections/" + assignedId + "/reject")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rejection_reason\":\"Estado inválido\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("INVALID_REJECTION_STATE"));

        // EM_ANDAMENTO também não pode aprovar ou iniciar revisão -> HTTP 409
        Inspection inProgress = inspectionRepository.findById(assignedId).orElseThrow();
        inProgress.setStatus(InspectionStatus.EM_ANDAMENTO);
        inspectionRepository.saveAndFlush(inProgress);

        mockMvc.perform(post("/api/v1/inspections/" + assignedId + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_APPROVAL_STATE"));

        // EX-02: ENVIADA pode ser aprovada diretamente (sem start-review explícito)
        InspectionDetailsResponse submittedDirect = createSubmittedInspection();
        mockMvc.perform(post("/api/v1/inspections/" + submittedDirect.id() + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comments\":\"Aprovação direta a partir de ENVIADA\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APROVADA"))
                .andExpect(jsonPath("$.approvedBy").value(adminUser.getId().toString()))
                .andExpect(jsonPath("$.reviewCycle").value(1));
    }

    @Test
    @DisplayName("RF-01 / RT-03 / AC-SECURITY: Bloqueia técnico (403), usuário inativo (403) e anônimo (401) nos endpoints de revisão")
    void shouldEnforceRolePermissionsOnReviewEndpoints() throws Exception {
        InspectionDetailsResponse submitted = createSubmittedInspection();
        UUID inspectionId = submitted.id();
        UUID itemId = submitted.items().get(0).id();

        // Sem autenticação -> HTTP 401
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review"))
                .andExpect(status().isUnauthorized());

        // Técnico não pode iniciar revisão, aprovar, reprovar, ver histórico de revisão ou ajustar administrativamente -> HTTP 403
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/reject")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rejection_reason\":\"Tentativa indevida\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/v1/inspections/" + inspectionId + "/reviews")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/responses/" + itemId + "/admin-adjustment")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adjustedValue\":\"CONFORMING\",\"reason\":\"Tentativa\"}"))
                .andExpect(status().isForbidden());

        // Supervisor inativo é bloqueado pelo filtro JWT antes de alcançar o controller -> HTTP 401
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + inactiveSupervisorToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("RF-07 / RN-084 / RN-085 / RN-090: Bloqueia edição silenciosa pelo supervisor e audita ajuste administrativo diferenciado + OpenAPI")
    void shouldPreventSilentResponseOverwriteAndAuditDifferentiatedAdminAdjustment() throws Exception {
        InspectionDetailsResponse submitted = createSubmittedInspection();
        UUID inspectionId = submitted.id();
        UUID numericItemId = submitted.items().get(1).id();

        // 1. Supervisor não pode sobrescrever silenciosamente resposta via /api/v1/sync/batch
        String silentEditBatch = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T21:00:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "9999" }
                    }
                  ]
                }
                """.formatted(UUID.randomUUID(), UUID.randomUUID(), inspectionId, numericItemId);

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(silentEditBatch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.processed[0].success").value(false))
                .andExpect(jsonPath("$.processed[0].error_code").value("SILENT_RESPONSE_EDIT_FORBIDDEN"));

        InspectionResponse originalResponse = inspectionResponseRepository
                .findByInspectionIdAndInspectionItemId(inspectionId, numericItemId)
                .orElseThrow();
        assertEquals("1400", originalResponse.getValueRaw());

        // 2. Inicia revisão e aplica ajuste administrativo auditado preservando o dado original do técnico
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/start-review")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk());

        // Ajuste sem justificativa -> HTTP 400
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/responses/" + numericItemId + "/admin-adjustment")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adjustedValue\":\"1420\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ADJUSTMENT_REASON_REQUIRED"));

        // Ajuste com justificativa preserva valueRaw/valueNumber originais e grava campos administrativos + auditoria
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/responses/" + numericItemId + "/admin-adjustment")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "adjustedValue": "1420",
                                  "reason": "Dígito invertido validado por foto do painel."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valueRaw").value("1400"))
                .andExpect(jsonPath("$.valueNumber").value(1400))
                .andExpect(jsonPath("$.adminAdjusted").value(true))
                .andExpect(jsonPath("$.adminAdjustedValue").value("1420"))
                .andExpect(jsonPath("$.adminAdjustmentReason").value("Dígito invertido validado por foto do painel."))
                .andExpect(jsonPath("$.adminAdjustedBy").value(supervisorUser.getId().toString()))
                .andExpect(jsonPath("$.adminAdjustedByName").value("Supervisor Revisão"));

        InspectionResponse afterAdjustment = inspectionResponseRepository
                .findByInspectionIdAndInspectionItemId(inspectionId, numericItemId)
                .orElseThrow();
        assertEquals("1400", afterAdjustment.getValueRaw());
        assertEquals(0, new BigDecimal("1400").compareTo(afterAdjustment.getValueNumber()));
        assertTrue(afterAdjustment.isAdminAdjusted());
        assertEquals("1420", afterAdjustment.getAdminAdjustedValue());

        List<AuditLog> logs = auditLogRepository.findByInspectionIdOrderByOccurredAtAsc(inspectionId);
        AuditLog adminAdjustLog = logs.stream()
                .filter(l -> "ADMIN_RESPONSE_ADJUSTED".equals(l.getAction()))
                .findFirst()
                .orElseThrow();
        assertEquals("INSPECTION_RESPONSE", adminAdjustLog.getEntityType());
        assertEquals(afterAdjustment.getId(), adminAdjustLog.getEntityId());
        assertEquals(supervisorUser.getId(), adminAdjustLog.getActorId());
        assertTrue(adminAdjustLog.getNewValueJson().contains("1420"));

        // RN-090: OpenAPI documenta todos os endpoints de revisão
        MvcResult apiDocs = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        String json = apiDocs.getResponse().getContentAsString();
        assertTrue(json.contains("/api/v1/inspections/{id}/start-review"));
        assertTrue(json.contains("/api/v1/inspections/{id}/approve"));
        assertTrue(json.contains("/api/v1/inspections/{id}/reject"));
        assertTrue(json.contains("/api/v1/inspections/{id}/reviews"));
        assertTrue(json.contains("/api/v1/inspections/{id}/responses/{itemId}/admin-adjustment"));
        assertTrue(json.contains("ApproveInspectionRequest"));
        assertTrue(json.contains("RejectInspectionRequest"));
    }

    @Test
    @DisplayName("TASK-021 RT-01 / CA-03: Endpoint /api/v1/dashboard/metrics consolida contadores, atrasadas, severidades e respeita RBAC")
    void shouldAggregateDashboardMetricsAndEnforceRbac() throws Exception {
        // Sem autenticação -> 401; Técnico -> 403
        mockMvc.perform(get("/api/v1/dashboard/metrics"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/dashboard/metrics")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        // 1. Inspeção enviada (aguardando revisão)
        InspectionDetailsResponse submitted = createSubmittedInspection();

        // 2. Inspeção atribuída em atraso
        InspectionDetailsResponse overdueScheduled = inspectionSchedulingService.schedule(
                new ScheduleInspectionRequest(
                        publishedTemplate.id(),
                        null,
                        null,
                        client.getId(),
                        site.getId(),
                        equipment.getId(),
                        technicianUser.getId(),
                        supervisorUser.getId(),
                        Instant.now().minus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString(),
                        null,
                        "Inspeção Atrasada Dashboard",
                        null,
                        InspectionPriority.URGENTE
                ),
                new AuthenticatedUser(supervisorUser.getId(), supervisorUser.getEmail(), supervisorUser.getRole())
        );

        // 3. Inspeção em andamento no prazo
        InspectionDetailsResponse inProgressScheduled = scheduleInspection();
        Inspection inProgressEntity = inspectionRepository.findById(inProgressScheduled.id()).orElseThrow();
        inProgressEntity.setStatus(InspectionStatus.EM_ANDAMENTO);
        inspectionRepository.saveAndFlush(inProgressEntity);

        // 4. Não conformidades ativas + 1 cancelada (que não deve contar)
        nonConformityRepository.saveAllAndFlush(List.of(
                createNc(submitted.id(), "Falha crítica", NonConformitySeverity.CRITICA, NonConformityStatus.OPEN),
                createNc(submitted.id(), "Falha alta", NonConformitySeverity.ALTA, NonConformityStatus.OPEN),
                createNc(submitted.id(), "Falha média", NonConformitySeverity.MEDIA, NonConformityStatus.RESOLVED),
                createNc(submitted.id(), "Falha baixa", NonConformitySeverity.BAIXA, NonConformityStatus.OPEN),
                createNc(submitted.id(), "Falha cancelada", NonConformitySeverity.CRITICA, NonConformityStatus.CANCELED)
        ));

        mockMvc.perform(get("/api/v1/dashboard/metrics")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalInspections").value(3))
                .andExpect(jsonPath("$.inProgressCount").value(1))
                .andExpect(jsonPath("$.awaitingReviewCount").value(1))
                .andExpect(jsonPath("$.overdueCount").value(1))
                .andExpect(jsonPath("$.assignedCount").value(1))
                .andExpect(jsonPath("$.submittedCount").value(1))
                .andExpect(jsonPath("$.totalNonConformities").value(4))
                .andExpect(jsonPath("$.nonConformitiesBySeverity.CRITICA").value(1))
                .andExpect(jsonPath("$.nonConformitiesBySeverity.ALTA").value(1))
                .andExpect(jsonPath("$.nonConformitiesBySeverity.MEDIA").value(1))
                .andExpect(jsonPath("$.nonConformitiesBySeverity.BAIXA").value(1))
                .andExpect(jsonPath("$.recentInspections", hasSize(3)))
                .andExpect(jsonPath("$.generatedAt").isNotEmpty());

        // Documentação OpenAPI expõe /api/v1/dashboard/metrics
        MvcResult apiDocs = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(apiDocs.getResponse().getContentAsString().contains("/api/v1/dashboard/metrics"));
    }

    private NonConformity createNc(
            UUID inspectionId,
            String title,
            NonConformitySeverity severity,
            NonConformityStatus status
    ) {
        NonConformity nc = new NonConformity();
        nc.setId(UUID.randomUUID());
        nc.setInspectionId(inspectionId);
        nc.setTitle(title);
        nc.setDescription("Descrição de " + title);
        nc.setSeverity(severity);
        nc.setStatus(status);
        nc.setCreatedBy(technicianUser.getId());
        nc.setServerReceivedAt(Instant.now());
        return nc;
    }

    private InspectionDetailsResponse scheduleInspection() {
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
                        technicianUser.getId(),
                        supervisorUser.getId(),
                        Instant.now().plus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString(),
                        null,
                        "Inspeção Revisão Técnica",
                        "Validar equipamento",
                        InspectionPriority.ALTA
                ),
                actor
        );
    }

    private InspectionDetailsResponse createSubmittedInspection() throws Exception {
        InspectionDetailsResponse scheduled = scheduleInspection();
        UUID inspectionId = scheduled.id();
        UUID item1 = scheduled.items().get(0).id();
        UUID item2 = scheduled.items().get(1).id();

        String batchJson = """
                {
                  "batch_id": "%s",
                  "operations": [
                    {
                      "operation_id": "%s",
                      "operation_type": "START_INSPECTION",
                      "client_timestamp": "2026-11-22T18:00:00Z",
                      "payload": { "inspectionId": "%s", "startedAt": "2026-11-22T18:00:00Z" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T18:05:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "CONFORMING", "observation": "Lacre ok" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "SAVE_RESPONSE",
                      "client_timestamp": "2026-11-22T18:10:00Z",
                      "payload": { "inspectionId": "%s", "itemId": "%s", "value": "1400" }
                    },
                    {
                      "operation_id": "%s",
                      "operation_type": "COMPLETE_INSPECTION",
                      "client_timestamp": "2026-11-22T18:20:00Z",
                      "payload": { "inspectionId": "%s", "completedAt": "2026-11-22T18:20:00Z" }
                    }
                  ]
                }
                """.formatted(
                UUID.randomUUID(),
                UUID.randomUUID(), inspectionId,
                UUID.randomUUID(), inspectionId, item1,
                UUID.randomUUID(), inspectionId, item2,
                UUID.randomUUID(), inspectionId
        );

        mockMvc.perform(post("/api/v1/sync/batch")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(batchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));

        return scheduled;
    }

    private byte[] createValidPngBytes() throws Exception {
        BufferedImage image = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.GREEN);
        g.fillRect(0, 0, 8, 8);
        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(image, "png", baos));
        return baos.toByteArray();
    }
}
