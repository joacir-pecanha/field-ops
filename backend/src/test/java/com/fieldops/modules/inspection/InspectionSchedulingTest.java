package com.fieldops.modules.inspection;

import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.inspection.domain.AuditLog;
import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionRepository;
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
import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.ResponseType;
import com.fieldops.modules.template.dto.TemplateItemRequest;
import com.fieldops.modules.template.dto.TemplateRequest;
import com.fieldops.modules.template.dto.TemplateResponse;
import com.fieldops.modules.template.dto.TemplateSectionRequest;
import com.fieldops.modules.template.dto.TemplateVersionResponse;
import com.fieldops.modules.template.repository.InspectionTemplateRepository;
import com.fieldops.modules.template.service.TemplateService;
import com.fieldops.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes de integração completos do módulo de Agendamento, Atribuição, Snapshots Imutáveis
 * e Cancelamento de Inspeções (TASK-011 Passo 6).
 */
@SpringBootTest
@ActiveProfiles("test")
class InspectionSchedulingTest {

    private static final Pattern ID_EXTRACTOR = Pattern.compile("\"id\"\\s*:\\s*\"([0-9a-fA-F-]+)\"");

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private InspectionRepository inspectionRepository;

    @Autowired
    private InspectionItemSnapshotRepository snapshotRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

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
    private User activeTechnician;
    private User secondTechnician;
    private User inactiveTechnician;
    private User blockedTechnician;

    private String adminToken;
    private String supervisorToken;
    private String activeTechnicianToken;
    private String secondTechnicianToken;

    private Client clientAlfa;
    private Client clientBeta;
    private Client inactiveClient;

    private Site siteAlfa;
    private Site siteBeta;
    private Site inactiveSite;

    private Equipment equipmentAlfa;
    private Equipment equipmentBeta;
    private Equipment inactiveEquipment;

    private TemplateResponse publishedTemplate;
    private TemplateVersionResponse publishedTemplateV1;
    private TemplateResponse draftOnlyTemplate;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        cleanDatabase();

        String hash = passwordEncoder.encode("SenhaForte@123");

        adminUser = userRepository.save(new User(
                UUID.randomUUID(), "Admin Agendamento", "admin.sched@fieldops.com", hash,
                UserRole.ADMIN, UserStatus.ACTIVE, "+5511999992001"
        ));
        supervisorUser = userRepository.save(new User(
                UUID.randomUUID(), "Supervisor Agendamento", "supervisor.sched@fieldops.com", hash,
                UserRole.SUPERVISOR, UserStatus.ACTIVE, "+5511999992002"
        ));
        activeTechnician = userRepository.save(new User(
                UUID.randomUUID(), "Carlos Técnico Ativo", "tecnico1.sched@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.ACTIVE, "+5511999992003"
        ));
        secondTechnician = userRepository.save(new User(
                UUID.randomUUID(), "Mariana Técnica Ativa", "tecnico2.sched@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.ACTIVE, "+5511999992004"
        ));
        inactiveTechnician = userRepository.save(new User(
                UUID.randomUUID(), "João Técnico Inativo", "tecnico.inativo@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.INACTIVE, "+5511999992005"
        ));
        blockedTechnician = userRepository.save(new User(
                UUID.randomUUID(), "Pedro Técnico Bloqueado", "tecnico.bloqueado@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.BLOCKED, "+5511999992006"
        ));

        adminToken = jwtTokenProvider.generateAccessToken(adminUser);
        supervisorToken = jwtTokenProvider.generateAccessToken(supervisorUser);
        activeTechnicianToken = jwtTokenProvider.generateAccessToken(activeTechnician);
        secondTechnicianToken = jwtTokenProvider.generateAccessToken(secondTechnician);

        clientAlfa = createClient("CLI-S-ALFA", "Indústria Alfa", MasterStatus.ACTIVE);
        clientBeta = createClient("CLI-S-BETA", "Logística Beta", MasterStatus.ACTIVE);
        inactiveClient = createClient("CLI-S-INACT", "Cliente Inativo", MasterStatus.INACTIVE);

        siteAlfa = createSite(clientAlfa, "SITE-A1", "Planta Sorocaba", MasterStatus.ACTIVE);
        siteBeta = createSite(clientBeta, "SITE-B1", "CD Campinas", MasterStatus.ACTIVE);
        inactiveSite = createSite(clientAlfa, "SITE-A2", "Unidade Desativada", MasterStatus.INACTIVE);

        equipmentAlfa = createEquipment(siteAlfa, "EQP-A1", "Gerador GD-001", "QR-SCHED-A1", EquipmentStatus.ACTIVE);
        equipmentBeta = createEquipment(siteBeta, "EQP-B1", "Compressor CP-002", "QR-SCHED-B1", EquipmentStatus.ACTIVE);
        inactiveEquipment = createEquipment(siteAlfa, "EQP-A2", "Bomba Inativa", "QR-SCHED-A2", EquipmentStatus.INACTIVE);

        publishedTemplate = templateService.createDraft(
                new TemplateRequest(
                        "TPL-SCHED-01",
                        "Checklist Preventivo de Gerador",
                        "Inspeção padrão v1",
                        "MECANICA",
                        List.of(
                                new TemplateSectionRequest(
                                        "Segurança Inicial",
                                        "Conferências visuais",
                                        1,
                                        List.of(
                                                new TemplateItemRequest(
                                                        "SEG-01",
                                                        "O lacre de segurança está intacto?",
                                                        "Verificar integridade do lacre",
                                                        ResponseType.CONFORMITY,
                                                        true,
                                                        true,
                                                        true,
                                                        null,
                                                        null,
                                                        0
                                                ),
                                                new TemplateItemRequest(
                                                        "SEG-02",
                                                        "Modo do painel",
                                                        null,
                                                        ResponseType.SINGLE_CHOICE,
                                                        true,
                                                        false,
                                                        false,
                                                        List.of("Automático", "Manual", "Desligado"),
                                                        null,
                                                        1
                                                )
                                        )
                                ),
                                new TemplateSectionRequest(
                                        "Medições",
                                        "Registros finais",
                                        2,
                                        List.of(
                                                new TemplateItemRequest(
                                                        "MED-01",
                                                        "Horímetro atual",
                                                        null,
                                                        ResponseType.NUMBER,
                                                        true,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        0
                                                )
                                        )
                                )
                        )
                ),
                supervisorUser.getId()
        );
        publishedTemplateV1 = templateService.publish(publishedTemplate.id(), supervisorUser.getId());

        draftOnlyTemplate = templateService.createDraft(
                new TemplateRequest(
                        "TPL-SCHED-DRAFT",
                        "Modelo Apenas Rascunho",
                        "Não publicado",
                        "ELETRICA",
                        List.of(
                                new TemplateSectionRequest(
                                        "Seção 1",
                                        null,
                                        0,
                                        List.of(
                                                new TemplateItemRequest(
                                                        "DRF-01",
                                                        "Pergunta de rascunho",
                                                        null,
                                                        ResponseType.BOOLEAN,
                                                        true,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        0
                                                )
                                        )
                                )
                        )
                ),
                supervisorUser.getId()
        );
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    private void cleanDatabase() {
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
    @DisplayName("CA-01 / RF-01..RF-06 / RT-02 / RT-03: Agendamento válido cria inspeção ATRIBUÍDA, gera snapshots e audita")
    void shouldScheduleInspectionSuccessfullyWithSnapshotsAndAuditLogs() throws Exception {
        String scheduledFor = Instant.now().plus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString();
        String payload = """
                {
                  "templateId": "%s",
                  "templateVersionId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "equipmentId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s",
                  "title": "Inspeção Programada GD-001",
                  "instructions": "Validar partida a frio e nível de óleo.",
                  "priority": "ALTA"
                }
                """.formatted(
                publishedTemplate.id(),
                publishedTemplateV1.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                equipmentAlfa.getId(),
                activeTechnician.getId(),
                scheduledFor
        );

        MvcResult result = mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ATRIBUÍDA"))
                .andExpect(jsonPath("$.priority").value("ALTA"))
                .andExpect(jsonPath("$.title").value("Inspeção Programada GD-001"))
                .andExpect(jsonPath("$.templateId").value(publishedTemplate.id().toString()))
                .andExpect(jsonPath("$.templateVersionId").value(publishedTemplateV1.id().toString()))
                .andExpect(jsonPath("$.templateVersion").value(1))
                .andExpect(jsonPath("$.clientId").value(clientAlfa.getId().toString()))
                .andExpect(jsonPath("$.siteId").value(siteAlfa.getId().toString()))
                .andExpect(jsonPath("$.equipmentId").value(equipmentAlfa.getId().toString()))
                .andExpect(jsonPath("$.technicianId").value(activeTechnician.getId().toString()))
                .andExpect(jsonPath("$.supervisorId").value(supervisorUser.getId().toString()))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].sectionTitle").value("Segurança Inicial"))
                .andExpect(jsonPath("$.items[0].itemCode").value("SEG-01"))
                .andExpect(jsonPath("$.items[0].observationRequiredOnFailure").value(true))
                .andExpect(jsonPath("$.items[0].evidenceRequiredOnFailure").value(true))
                .andExpect(jsonPath("$.items[1].itemCode").value("SEG-02"))
                .andExpect(jsonPath("$.items[1].options", hasSize(3)))
                .andExpect(jsonPath("$.items[2].sectionTitle").value("Medições"))
                .andExpect(jsonPath("$.items[2].itemCode").value("MED-01"))
                .andReturn();

        UUID inspectionId = UUID.fromString(extractId(result.getResponse().getContentAsString()));

        Inspection persisted = inspectionRepository.findById(inspectionId).orElseThrow();
        assertEquals(InspectionStatus.ATRIBUÍDA, persisted.getStatus());

        List<InspectionItemSnapshot> snapshots =
                snapshotRepository.findByInspectionIdOrderBySectionOrderAscItemOrderAsc(inspectionId);
        assertEquals(3, snapshots.size());
        assertEquals("SEG-01", snapshots.get(0).getItemCode());
        assertEquals("MED-01", snapshots.get(2).getItemCode());

        List<AuditLog> logs = auditLogRepository.findByInspectionIdOrderByOccurredAtAsc(inspectionId);
        assertEquals(2, logs.size());
        assertEquals("INSPECTION_CREATED", logs.get(0).getAction());
        assertEquals("INSPECTION_ASSIGNED", logs.get(1).getAction());
        assertEquals(supervisorUser.getId(), logs.get(0).getActorId());
        assertEquals("ATRIBUÍDA", logs.get(0).getNewStatus());

        // Consulta da trilha de auditoria via REST
        mockMvc.perform(get("/api/v1/inspections/" + inspectionId + "/audit-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].action").value("INSPECTION_CREATED"))
                .andExpect(jsonPath("$[1].action").value("INSPECTION_ASSIGNED"));

        // RN-026: Inspeção de local/ambiente sem equipamento específico também é permitida
        String siteOnlyPayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "2026-11-25"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                activeTechnician.getId()
        );
        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(siteOnlyPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ATRIBUÍDA"))
                .andExpect(jsonPath("$.totalItems").value(3));
    }

    @Test
    @DisplayName("RF-03 / RN-012 / RN-014: Rejeita incompatibilidade Cliente->Local->Equipamento e cadastros inativos")
    void shouldRejectIncompatibleSiteEquipmentAndInactiveMasterEntities() throws Exception {
        String scheduledFor = Instant.now().plus(1, ChronoUnit.DAYS).toString();

        // 1) Local pertence a outro cliente (siteBeta -> clientBeta, mas enviado com clientAlfa)
        String wrongSitePayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteBeta.getId(),
                activeTechnician.getId(),
                scheduledFor
        );

        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wrongSitePayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INCOMPATIBLE_SITE_CLIENT"));

        // 2) Equipamento pertence a outro local (equipmentBeta -> siteBeta, mas enviado com siteAlfa)
        String wrongEquipmentPayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "equipmentId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                equipmentBeta.getId(),
                activeTechnician.getId(),
                scheduledFor
        );

        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wrongEquipmentPayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INCOMPATIBLE_EQUIPMENT_SITE"));

        // 3) Cliente inativo
        String inactiveClientPayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                inactiveClient.getId(),
                siteAlfa.getId(),
                activeTechnician.getId(),
                scheduledFor
        );
        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inactiveClientPayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INACTIVE_CLIENT"));

        // 4) Local inativo
        String inactiveSitePayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                inactiveSite.getId(),
                activeTechnician.getId(),
                scheduledFor
        );
        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inactiveSitePayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INACTIVE_SITE"));

        // 5) Equipamento inativo
        String inactiveEquipmentPayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "equipmentId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                inactiveEquipment.getId(),
                activeTechnician.getId(),
                scheduledFor
        );
        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inactiveEquipmentPayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INACTIVE_EQUIPMENT"));

        assertEquals(0, inspectionRepository.count());
        assertEquals(0, snapshotRepository.count());
    }

    @Test
    @DisplayName("RF-01 / RN-024: Bloqueia agendamento com modelo não publicado ou inativo")
    void shouldRejectDraftOrInactiveTemplates() throws Exception {
        String scheduledFor = Instant.now().plus(1, ChronoUnit.DAYS).toString();

        String draftTemplatePayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                draftOnlyTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                activeTechnician.getId(),
                scheduledFor
        );

        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draftTemplatePayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("TEMPLATE_VERSION_NOT_PUBLISHED"));

        templateService.deactivate(publishedTemplate.id());
        String inactiveTemplatePayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                activeTechnician.getId(),
                scheduledFor
        );

        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inactiveTemplatePayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INACTIVE_TEMPLATE"));
    }

    @Test
    @DisplayName("EX-01 / RF-04 / RN-027: Agendamento com técnico inativo, bloqueado ou perfil inválido retorna HTTP 400")
    void shouldReturnHttp400WhenTechnicianIsInactiveBlockedOrInvalidRole() throws Exception {
        String scheduledFor = Instant.now().plus(1, ChronoUnit.DAYS).toString();

        // 1) Técnico INACTIVE -> HTTP 400 com mensagem descritiva
        String inactiveTechPayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "equipmentId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                equipmentAlfa.getId(),
                inactiveTechnician.getId(),
                scheduledFor
        );

        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inactiveTechPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("INACTIVE_TECHNICIAN"))
                .andExpect(jsonPath("$.detail", containsString("inativo")));

        // 2) Técnico BLOCKED -> HTTP 400
        String blockedTechPayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                blockedTechnician.getId(),
                scheduledFor
        );

        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(blockedTechPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INACTIVE_TECHNICIAN"));

        // 3) Usuário com perfil SUPERVISOR informado como técnico -> HTTP 400
        String supervisorAsTechPayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                supervisorUser.getId(),
                scheduledFor
        );

        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(supervisorAsTechPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_TECHNICIAN_ROLE"));

        // 4) Falta de data prevista -> HTTP 400
        String missingDatePayload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "technicianId": "%s"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                activeTechnician.getId()
        );

        mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(missingDatePayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SCHEDULED_FOR_REQUIRED"));
    }

    @Test
    @DisplayName("CA-02 / EX-02 / RF-07 / RF-08: Cancelamento exige justificativa (422), registra auditoria e bloqueia inspeção APROVADA")
    void shouldEnforceJustificationAndAuditOnCancelAndBlockApprovedInspection() throws Exception {
        UUID inspectionId = scheduleBasicInspection(activeTechnician.getId());

        // Técnico não pode agendar nem cancelar
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/cancel")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + activeTechnicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Tentativa indevida\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        // Cancelamento sem justificativa -> HTTP 422 (EX-02)
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/cancel")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.code").value("CANCEL_REASON_REQUIRED"));

        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/cancel")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"   \"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("CANCEL_REASON_REQUIRED"));

        // Cancelamento válido registra usuário, data, justificativa e auditoria
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/cancel")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Cliente solicitou reagendamento por parada elétrica.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELADA"))
                .andExpect(jsonPath("$.canceledBy").value(supervisorUser.getId().toString()))
                .andExpect(jsonPath("$.canceledAt").isNotEmpty())
                .andExpect(jsonPath("$.canceledReason").value("Cliente solicitou reagendamento por parada elétrica."));

        List<AuditLog> logs = auditLogRepository.findByInspectionIdOrderByOccurredAtAsc(inspectionId);
        assertEquals(3, logs.size());
        AuditLog cancelLog = logs.get(2);
        assertEquals("INSPECTION_CANCELED", cancelLog.getAction());
        assertEquals("ATRIBUÍDA", cancelLog.getPreviousStatus());
        assertEquals("CANCELADA", cancelLog.getNewStatus());
        assertEquals(supervisorUser.getId(), cancelLog.getActorId());
        assertTrue(cancelLog.getDetails().contains("Cliente solicitou reagendamento"));

        // Recancelar inspeção já cancelada -> HTTP 422
        mockMvc.perform(post("/api/v1/inspections/" + inspectionId + "/cancel")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Segunda tentativa\"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INSPECTION_ALREADY_CANCELED"));

        // RF-08 / RN-030: Inspeção já APROVADA não pode ser cancelada pelo fluxo comum
        UUID approvedInspectionId = scheduleBasicInspection(activeTechnician.getId());
        Inspection approvedInspection = inspectionRepository.findById(approvedInspectionId).orElseThrow();
        approvedInspection.setStatus(InspectionStatus.APROVADA);
        approvedInspection.setApprovedAt(Instant.now());
        inspectionRepository.saveAndFlush(approvedInspection);

        mockMvc.perform(post("/api/v1/inspections/" + approvedInspectionId + "/cancel")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Tentativa de cancelar aprovada\"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("APPROVED_INSPECTION_CANNOT_BE_CANCELED"));
    }

    @Test
    @DisplayName("CA-03 / RN-004 / RN-028 / AC-SECURITY: Técnico lista apenas suas inspeções atribuídas para sincronização")
    void shouldListAssignedInspectionsForTechnicianSyncAndEnforceIsolation() throws Exception {
        UUID inspTech1Active = scheduleBasicInspection(activeTechnician.getId());
        UUID inspTech1Canceled = scheduleBasicInspection(activeTechnician.getId());
        UUID inspTech2 = scheduleBasicInspection(secondTechnician.getId());

        mockMvc.perform(post("/api/v1/inspections/" + inspTech1Canceled + "/cancel")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Cancelada antes do envio\"}"))
                .andExpect(status().isOk());

        // Técnico 1 consulta suas atribuições ativas (não vê a cancelada nem a do Técnico 2)
        mockMvc.perform(get("/api/v1/inspections/assigned")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + activeTechnicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(inspTech1Active.toString()))
                .andExpect(jsonPath("$[0].status").value("ATRIBUÍDA"))
                .andExpect(jsonPath("$[0].items", hasSize(3)));

        // Com includeCanceled=true, recebe também a cancelada para aviso offline (RN-077)
        mockMvc.perform(get("/api/v1/inspections/assigned?includeCanceled=true")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + activeTechnicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        // Técnico 1 não pode consultar atribuições ou detalhes do Técnico 2
        mockMvc.perform(get("/api/v1/inspections/assigned?technicianId=" + secondTechnician.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + activeTechnicianToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/v1/inspections/" + inspTech2)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + activeTechnicianToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        // Técnico 2 vê apenas a sua
        mockMvc.perform(get("/api/v1/inspections/assigned")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + secondTechnicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(inspTech2.toString()));

        // Supervisor consulta atribuídas por técnicoId e listagem paginada filtrada
        mockMvc.perform(get("/api/v1/inspections/assigned?technicianId=" + activeTechnician.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(inspTech1Active.toString()));

        mockMvc.perform(get("/api/v1/inspections?status=ATRIBUIDA&clientId=" + clientAlfa.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    @DisplayName("CA-04 / RN-021 / RN-090: Alterações futuras no modelo não modificam snapshots existentes e OpenAPI documenta endpoints")
    void shouldPreserveInspectionSnapshotsWhenTemplateEvolvesToNewVersionAndExposeOpenApi() throws Exception {
        UUID inspectionV1Id = scheduleBasicInspection(activeTechnician.getId());

        // Evolui o modelo publicado para v2 com títulos alterados e mais um item
        templateService.createNewVersion(
                publishedTemplate.id(),
                new TemplateRequest(
                        "TPL-SCHED-01",
                        "Checklist Preventivo de Gerador v2",
                        "Versão evoluída",
                        "MECANICA",
                        List.of(
                                new TemplateSectionRequest(
                                        "Nova Seção v2",
                                        "Seção revisada",
                                        0,
                                        List.of(
                                                new TemplateItemRequest(
                                                        "SEG-01-V2",
                                                        "Pergunta completamente alterada na v2",
                                                        null,
                                                        ResponseType.BOOLEAN,
                                                        true,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        0
                                                ),
                                                new TemplateItemRequest(
                                                        "NOVO-02",
                                                        "Novo item 2 da v2",
                                                        null,
                                                        ResponseType.TEXT_SHORT,
                                                        true,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        1
                                                ),
                                                new TemplateItemRequest(
                                                        "NOVO-03",
                                                        "Novo item 3 da v2",
                                                        null,
                                                        ResponseType.NUMBER,
                                                        false,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        2
                                                ),
                                                new TemplateItemRequest(
                                                        "NOVO-04",
                                                        "Novo item 4 da v2",
                                                        null,
                                                        ResponseType.PHOTO,
                                                        false,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        3
                                                )
                                        )
                                )
                        )
                )
        );
        TemplateVersionResponse publishedV2 = templateService.publish(publishedTemplate.id(), supervisorUser.getId());
        assertEquals(2, publishedV2.versionNumber());

        // Snapshot da inspeção criada na v1 permanece 100% intacto
        mockMvc.perform(get("/api/v1/inspections/" + inspectionV1Id + "/snapshots")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + activeTechnicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].sectionTitle").value("Segurança Inicial"))
                .andExpect(jsonPath("$[0].itemCode").value("SEG-01"))
                .andExpect(jsonPath("$[0].itemTitle").value("O lacre de segurança está intacto?"));

        // Nova inspeção sem especificar templateVersionId usa a nova versão publicada v2 (4 itens)
        UUID inspectionV2Id = scheduleBasicInspection(activeTechnician.getId());
        mockMvc.perform(get("/api/v1/inspections/" + inspectionV2Id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templateVersion").value(2))
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.items[0].itemTitle").value("Pergunta completamente alterada na v2"));

        // Documentação OpenAPI expõe os novos endpoints sem erros
        MvcResult apiDocsResult = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        String apiDocs = apiDocsResult.getResponse().getContentAsString();
        assertNotNull(apiDocs);
        assertTrue(apiDocs.contains("/api/v1/inspections/schedule"));
        assertTrue(apiDocs.contains("/api/v1/inspections/{id}/cancel"));
        assertTrue(apiDocs.contains("/api/v1/inspections/assigned"));
    }

    private UUID scheduleBasicInspection(UUID technicianId) throws Exception {
        String scheduledFor = Instant.now().plus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString();
        String payload = """
                {
                  "templateId": "%s",
                  "clientId": "%s",
                  "siteId": "%s",
                  "equipmentId": "%s",
                  "technicianId": "%s",
                  "scheduledFor": "%s",
                  "priority": "MEDIA"
                }
                """.formatted(
                publishedTemplate.id(),
                clientAlfa.getId(),
                siteAlfa.getId(),
                equipmentAlfa.getId(),
                technicianId,
                scheduledFor
        );

        MvcResult result = mockMvc.perform(post("/api/v1/inspections/schedule")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();

        return UUID.fromString(extractId(result.getResponse().getContentAsString()));
    }

    private Client createClient(String code, String name, MasterStatus status) {
        Client client = new Client();
        client.setId(UUID.randomUUID());
        client.setCode(code);
        client.setName(name);
        client.setStatus(status);
        return clientRepository.save(client);
    }

    private Site createSite(Client client, String code, String name, MasterStatus status) {
        Site site = new Site();
        site.setId(UUID.randomUUID());
        site.setClient(client);
        site.setCode(code);
        site.setName(name);
        site.setCity("Sorocaba");
        site.setState("SP");
        site.setStatus(status);
        return siteRepository.save(site);
    }

    private Equipment createEquipment(
            Site site,
            String code,
            String name,
            String qrCode,
            EquipmentStatus status
    ) {
        Equipment equipment = new Equipment();
        equipment.setId(UUID.randomUUID());
        equipment.setSite(site);
        equipment.setCode(code);
        equipment.setName(name);
        equipment.setQrCode(qrCode);
        equipment.setStatus(status);
        return equipmentRepository.save(equipment);
    }

    private String extractId(String json) {
        Matcher matcher = ID_EXTRACTOR.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        throw new IllegalStateException("Campo id não encontrado na resposta JSON: " + json);
    }
}
