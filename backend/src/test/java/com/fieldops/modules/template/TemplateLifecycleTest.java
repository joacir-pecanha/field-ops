package com.fieldops.modules.template;

import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.ResponseType;
import com.fieldops.modules.template.domain.TemplateStatus;
import com.fieldops.modules.template.domain.TemplateVersion;
import com.fieldops.modules.template.domain.TemplateVersionStatus;
import com.fieldops.modules.template.dto.TemplateSnapshotResponse;
import com.fieldops.modules.template.repository.InspectionTemplateRepository;
import com.fieldops.modules.template.repository.TemplateVersionRepository;
import com.fieldops.modules.template.service.TemplateSnapshotService;
import com.fieldops.security.jwt.JwtTokenProvider;
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

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes de integração completos do ciclo de vida de Modelos de Inspeção,
 * versionamento imutável e geração de snapshots (TASK-009 Passo 6).
 */
@SpringBootTest
@ActiveProfiles("test")
class TemplateLifecycleTest {

    private static final Pattern ID_EXTRACTOR = Pattern.compile("\"id\"\\s*:\\s*\"([0-9a-fA-F-]+)\"");

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private InspectionTemplateRepository templateRepository;

    @Autowired
    private TemplateVersionRepository templateVersionRepository;

    @Autowired
    private TemplateSnapshotService templateSnapshotService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private MockMvc mockMvc;
    private String adminToken;
    private String supervisorToken;
    private String technicianToken;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        templateRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

        String hash = passwordEncoder.encode("SenhaForte@123");

        User adminUser = userRepository.save(new User(
                UUID.randomUUID(), "Admin Templates", "admin.tpl@fieldops.com", hash,
                UserRole.ADMIN, UserStatus.ACTIVE, "+5511999991001"
        ));
        User supervisorUser = userRepository.save(new User(
                UUID.randomUUID(), "Supervisor Templates", "supervisor.tpl@fieldops.com", hash,
                UserRole.SUPERVISOR, UserStatus.ACTIVE, "+5511999991002"
        ));
        User technicianUser = userRepository.save(new User(
                UUID.randomUUID(), "Técnico Campo", "tecnico.tpl@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.ACTIVE, "+5511999991003"
        ));

        adminToken = jwtTokenProvider.generateAccessToken(adminUser);
        supervisorToken = jwtTokenProvider.generateAccessToken(supervisorUser);
        technicianToken = jwtTokenProvider.generateAccessToken(technicianUser);
    }

    @Test
    @DisplayName("CA-01 / RF-01 / RF-03 / RF-05: Ciclo de rascunho, ordenação explícita (orderIndex) e publicação com version = 1")
    void shouldCreateEditDraftWithOrderingAndPublishVersionOne() throws Exception {
        String createDraftPayload = """
                {
                  "code": "TPL-EXT-001",
                  "title": "Checklist Inicial de Extintores",
                  "description": "Versão inicial em rascunho",
                  "category": "SEGURANCA",
                  "sections": [
                    {
                      "title": "Seção B - Segurança",
                      "orderIndex": 2,
                      "items": [
                        {
                          "code": "EXT-02",
                          "title": "O manômetro está na faixa verde?",
                          "responseType": "CONFORMITY",
                          "required": true,
                          "observationRequiredOnFailure": true,
                          "evidenceRequiredOnFailure": true,
                          "orderIndex": 1
                        },
                        {
                          "code": "EXT-01",
                          "title": "O lacre está intacto?",
                          "responseType": "BOOLEAN",
                          "required": true,
                          "orderIndex": 0
                        }
                      ]
                    },
                    {
                      "title": "Seção A - Identificação",
                      "orderIndex": 1,
                      "items": [
                        {
                          "code": "ID-01",
                          "title": "Número do patrimônio",
                          "responseType": "TEXT_SHORT",
                          "required": true,
                          "orderIndex": 0
                        }
                      ]
                    }
                  ]
                }
                """;

        MvcResult createResult = mockMvc.perform(post("/api/v1/inspection-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createDraftPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.currentVersion").value(0))
                .andExpect(jsonPath("$.totalSections").value(2))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.sections[0].title").value("Seção A - Identificação"))
                .andExpect(jsonPath("$.sections[0].orderIndex").value(1))
                .andExpect(jsonPath("$.sections[1].title").value("Seção B - Segurança"))
                .andExpect(jsonPath("$.sections[1].orderIndex").value(2))
                .andExpect(jsonPath("$.sections[1].items[0].code").value("EXT-01"))
                .andExpect(jsonPath("$.sections[1].items[1].code").value("EXT-02"))
                .andReturn();

        String templateId = extractId(createResult.getResponse().getContentAsString());

        // Edição livre enquanto o modelo está em rascunho (RF-01 / RN-018)
        String updateDraftPayload = """
                {
                  "code": "TPL-EXT-001",
                  "title": "Checklist de Inspeção de Extintores",
                  "description": "Modelo revisado antes da publicação",
                  "category": "SEGURANCA_INCENDIO",
                  "sections": [
                    {
                      "title": "Identificação",
                      "orderIndex": 0,
                      "items": [
                        {
                          "code": "ID-01",
                          "title": "Número do patrimônio",
                          "responseType": "TEXT_SHORT",
                          "required": true,
                          "orderIndex": 0
                        }
                      ]
                    },
                    {
                      "title": "Condições Físicas",
                      "orderIndex": 1,
                      "items": [
                        {
                          "code": "FIS-01",
                          "title": "O lacre está intacto?",
                          "responseType": "CONFORMITY",
                          "required": true,
                          "observationRequiredOnFailure": true,
                          "evidenceRequiredOnFailure": true,
                          "orderIndex": 0
                        },
                        {
                          "code": "FIS-02",
                          "title": "Pressão aferida (bar)",
                          "responseType": "NUMBER",
                          "required": true,
                          "orderIndex": 1
                        }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(put("/api/v1/inspection-templates/" + templateId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateDraftPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Checklist de Inspeção de Extintores"))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.sections", hasSize(2)))
                .andExpect(jsonPath("$.sections[0].title").value("Identificação"))
                .andExpect(jsonPath("$.sections[1].title").value("Condições Físicas"));

        // Publicação atômica gerando version = 1 (CA-01 / RF-05 / RT-03)
        mockMvc.perform(post("/api/v1/inspection-templates/" + templateId + "/publish")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templateId").value(templateId))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.versionNumber").value(1))
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.activeForNewInspections").value(true))
                .andExpect(jsonPath("$.publishedAt").isNotEmpty())
                .andExpect(jsonPath("$.totalSections").value(2))
                .andExpect(jsonPath("$.totalItems").value(3));

        // Consulta do modelo consolidado reflete status PUBLISHED e version = 1
        mockMvc.perform(get("/api/v1/inspection-templates/" + templateId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.currentVersion").value(1))
                .andExpect(jsonPath("$.sections[1].items[0].observationRequiredOnFailure").value(true))
                .andExpect(jsonPath("$.sections[1].items[0].evidenceRequiredOnFailure").value(true));
    }

    @Test
    @DisplayName("EX-02 / RF-04: Publicação de template sem itens ou com pendências retorna HTTP 400")
    void shouldBlockPublicationWithHttp400WhenTemplateHasNoValidItems() throws Exception {
        // 1) Modelo sem nenhuma seção
        String emptySectionsPayload = """
                {
                  "code": "TPL-EMPTY-01",
                  "title": "Modelo Sem Seções",
                  "category": "GERAL",
                  "sections": []
                }
                """;

        String emptyTemplateId = extractId(mockMvc.perform(post("/api/v1/inspection-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(emptySectionsPayload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());

        mockMvc.perform(post("/api/v1/inspection-templates/" + emptyTemplateId + "/publish")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("TEMPLATE_PUBLISH_PENDING"))
                .andExpect(jsonPath("$.pendencies", hasSize(1)));

        // 2) Seção vazia, item sem responseType e item SINGLE_CHOICE sem opções
        String invalidItemsPayload = """
                {
                  "code": "TPL-INVALID-02",
                  "title": "Modelo Com Pendências",
                  "category": "ELETRICA",
                  "sections": [
                    {
                      "title": "Seção Sem Itens",
                      "orderIndex": 0,
                      "items": []
                    },
                    {
                      "title": "Seção Com Itens Incompletos",
                      "orderIndex": 1,
                      "items": [
                        {
                          "title": "Item Sem Tipo de Resposta",
                          "orderIndex": 0
                        },
                        {
                          "title": "Item Escolha Única Sem Opções",
                          "responseType": "SINGLE_CHOICE",
                          "options": [],
                          "orderIndex": 1
                        }
                      ]
                    }
                  ]
                }
                """;

        String invalidTemplateId = extractId(mockMvc.perform(post("/api/v1/inspection-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidItemsPayload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());

        mockMvc.perform(post("/api/v1/inspection-templates/" + invalidTemplateId + "/publish")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TEMPLATE_PUBLISH_PENDING"))
                .andExpect(jsonPath("$.pendencies", hasSize(3)));

        // Garante que o rascunho não foi publicado
        InspectionTemplate persisted = templateRepository.findById(UUID.fromString(invalidTemplateId)).orElseThrow();
        assertEquals(TemplateStatus.DRAFT, persisted.getStatus());
        assertEquals(0, persisted.getCurrentVersion());
    }

    @Test
    @DisplayName("CA-02 / EX-01 / RN-019: Alteração direta em versão publicada retorna HTTP 422 com orientação")
    void shouldRejectDirectModificationOfPublishedTemplateWithHttp422() throws Exception {
        String templateId = createAndPublishBasicTemplate("TPL-IMMUT-01", "Checklist Imutável");

        String attemptedEditPayload = """
                {
                  "code": "TPL-IMMUT-01",
                  "title": "Tentativa de Edição Destrutiva",
                  "category": "MECANICA",
                  "sections": [
                    {
                      "title": "Seção Alterada",
                      "orderIndex": 0,
                      "items": [
                        {
                          "title": "Pergunta Alterada",
                          "responseType": "TEXT_SHORT",
                          "orderIndex": 0
                        }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(put("/api/v1/inspection-templates/" + templateId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(attemptedEditPayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.code").value("PUBLISHED_VERSION_IMMUTABLE"))
                .andExpect(jsonPath("$.detail", containsString("nova versão")));

        mockMvc.perform(put("/api/v1/inspection-templates/" + templateId + "/versions/1")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(attemptedEditPayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("PUBLISHED_VERSION_IMMUTABLE"));
    }

    @Test
    @DisplayName("CA-03 / RF-06 / RN-020 / RN-021: Criação de nova versão (N+1) preserva versões anteriores e seus snapshots")
    void shouldCreateNewVersionPreservingPreviousVersionAndSnapshots() throws Exception {
        String templateId = createAndPublishBasicTemplate("TPL-VER-01", "Checklist Compressores");

        // Gera snapshot da versão 1 antes de evoluir o modelo
        TemplateSnapshotResponse snapshotV1Before =
                templateSnapshotService.generateSnapshotForVersion(UUID.fromString(templateId), 1);
        assertEquals(1, snapshotV1Before.versionNumber());
        assertEquals(1, snapshotV1Before.totalItems());
        assertEquals("O compressor apresenta vazamentos?", snapshotV1Before.items().get(0).itemTitle());

        // Inicia versão 2 em rascunho clonando a versão 1 (sem body)
        mockMvc.perform(post("/api/v1/inspection-templates/" + templateId + "/versions")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.totalSections").value(1))
                .andExpect(jsonPath("$.totalItems").value(1));

        // Tentar gerar snapshot da versão 2 ainda em DRAFT deve falhar com HTTP 422
        assertThrows(BusinessRuleException.class, () ->
                templateSnapshotService.generateSnapshotForVersion(UUID.fromString(templateId), 2));

        // Edita livremente a versão 2 em rascunho
        String v2UpdatePayload = """
                {
                  "code": "TPL-VER-01",
                  "title": "Checklist Compressores v2",
                  "description": "Inclui medição de pressão e evidência",
                  "category": "MECANICA",
                  "sections": [
                    {
                      "title": "Inspeção Visual",
                      "orderIndex": 0,
                      "items": [
                        {
                          "code": "CMP-01",
                          "title": "O compressor apresenta vazamentos no cabeçote?",
                          "responseType": "CONFORMITY",
                          "required": true,
                          "observationRequiredOnFailure": true,
                          "evidenceRequiredOnFailure": true,
                          "orderIndex": 0
                        },
                        {
                          "code": "CMP-02",
                          "title": "Pressão de trabalho (bar)",
                          "responseType": "NUMBER",
                          "required": true,
                          "orderIndex": 1
                        }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(put("/api/v1/inspection-templates/" + templateId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(v2UpdatePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.currentVersion").value(1))
                .andExpect(jsonPath("$.totalItems").value(2));

        // Publica a versão 2
        mockMvc.perform(patch("/api/v1/inspection-templates/" + templateId + "/publish")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.activeForNewInspections").value(true));

        // Histórico de versões mostra v1 e v2 preservadas
        mockMvc.perform(get("/api/v1/inspection-templates/" + templateId + "/versions")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].version").value(1))
                .andExpect(jsonPath("$[0].status").value("PUBLISHED"))
                .andExpect(jsonPath("$[0].activeForNewInspections").value(false))
                .andExpect(jsonPath("$[0].titleSnapshot").value("Checklist Compressores"))
                .andExpect(jsonPath("$[0].totalItems").value(1))
                .andExpect(jsonPath("$[1].version").value(2))
                .andExpect(jsonPath("$[1].status").value("PUBLISHED"))
                .andExpect(jsonPath("$[1].activeForNewInspections").value(true))
                .andExpect(jsonPath("$[1].totalItems").value(2));

        // Snapshot da versão 1 continua idêntico ao que era antes da versão 2
        mockMvc.perform(get("/api/v1/inspection-templates/" + templateId + "/versions/1/snapshot")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.titleSnapshot").value("Checklist Compressores"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].itemTitle").value("O compressor apresenta vazamentos?"));

        // Snapshot padrão do modelo agora aponta para a versão 2 ativa
        mockMvc.perform(get("/api/v1/inspection-templates/" + templateId + "/snapshot")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].itemTitle").value("O compressor apresenta vazamentos no cabeçote?"))
                .andExpect(jsonPath("$.items[1].responseType").value("NUMBER"));

        // Versão 1 continua imutável mesmo após publicação da versão 2
        mockMvc.perform(put("/api/v1/inspection-templates/" + templateId + "/versions/1")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(v2UpdatePayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("PUBLISHED_VERSION_IMMUTABLE"));
    }

    @Test
    @DisplayName("CA-04 / RF-02 / RT-01 / RT-02: Aceita todos os tipos de resposta do MVP e JSONB para SINGLE_CHOICE")
    void shouldAcceptAllSupportedMvpResponseTypesAndPersistSingleChoiceOptionsAsJsonb() throws Exception {
        String allTypesPayload = """
                {
                  "code": "TPL-TYPES-ALL",
                  "title": "Checklist Completo de Tipos",
                  "category": "QUALIDADE",
                  "sections": [
                    {
                      "title": "Todos os Tipos Suportados",
                      "orderIndex": 0,
                      "items": [
                        { "title": "Texto curto", "responseType": "TEXT_SHORT", "orderIndex": 0 },
                        { "title": "Texto longo", "responseType": "TEXT_LONG", "orderIndex": 1 },
                        { "title": "Valor numérico", "responseType": "NUMBER", "orderIndex": 2 },
                        { "title": "Sim ou Não", "responseType": "BOOLEAN", "orderIndex": 3 },
                        { "title": "Conformidade", "responseType": "CONFORMITY", "orderIndex": 4 },
                        {
                          "title": "Seleção única",
                          "responseType": "SINGLE_CHOICE",
                          "options": ["Normal", "Atenção", "Crítico"],
                          "orderIndex": 5
                        },
                        { "title": "Data da calibração", "responseType": "DATE", "orderIndex": 6 },
                        { "title": "Foto da etiqueta", "responseType": "PHOTO", "orderIndex": 7 }
                      ]
                    }
                  ]
                }
                """;

        MvcResult result = mockMvc.perform(post("/api/v1/inspection-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(allTypesPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalItems").value(8))
                .andExpect(jsonPath("$.sections[0].items[5].responseType").value("SINGLE_CHOICE"))
                .andExpect(jsonPath("$.sections[0].items[5].options", hasSize(3)))
                .andExpect(jsonPath("$.sections[0].items[5].options[0]").value("Normal"))
                .andExpect(jsonPath("$.sections[0].items[5].options[2]").value("Crítico"))
                .andExpect(jsonPath("$.sections[0].items[5].optionsJson").value("[\"Normal\",\"Atenção\",\"Crítico\"]"))
                .andExpect(jsonPath("$.sections[0].items[7].responseType").value("PHOTO"))
                .andReturn();

        String templateId = extractId(result.getResponse().getContentAsString());

        mockMvc.perform(post("/api/v1/inspection-templates/" + templateId + "/publish")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.totalItems").value(8));

        TemplateSnapshotResponse snapshot =
                templateSnapshotService.generateSnapshotForTemplate(UUID.fromString(templateId));
        assertEquals(8, snapshot.items().size());
        assertEquals(ResponseType.PHOTO, snapshot.items().get(7).responseType());
        assertEquals(3, snapshot.items().get(5).options().size());
        assertEquals("[\"Normal\",\"Atenção\",\"Crítico\"]", snapshot.items().get(5).optionsJson());

        // Tipo de resposta desconhecido/não suportado deve ser rejeitado com HTTP 400
        String unsupportedTypePayload = """
                {
                  "code": "TPL-UNSUP",
                  "title": "Checklist Inválido",
                  "category": "QUALIDADE",
                  "sections": [
                    {
                      "title": "Seção",
                      "orderIndex": 0,
                      "items": [
                        { "title": "Tipo inválido", "responseType": "VIDEO_4K", "orderIndex": 0 }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/v1/inspection-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(unsupportedTypePayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST_BODY"));
    }

    @Test
    @DisplayName("RBAC, inativação lógica, paginação, unicidade de código e OpenAPI")
    void shouldEnforceRbacLogicalDeactivationSearchAndOpenApi() throws Exception {
        String templateId = createAndPublishBasicTemplate("TPL-RBAC-01", "Checklist Subestação");

        // Técnico não pode criar, editar, publicar ou desativar templates
        mockMvc.perform(post("/api/v1/inspection-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Proibido\",\"category\":\"GERAL\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(delete("/api/v1/inspection-templates/" + templateId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isForbidden());

        // Técnico pode listar e consultar
        mockMvc.perform(get("/api/v1/inspection-templates?search=Subestação&status=PUBLISHED")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].code").value("TPL-RBAC-01"));

        // Duplicidade de código retorna HTTP 409 Conflict
        mockMvc.perform(post("/api/v1/inspection-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"tpl-rbac-01\",\"title\":\"Duplicado\",\"category\":\"ELETRICA\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_TEMPLATE_CODE"));

        // Inativação lógica preserva o registro e suas versões no banco
        mockMvc.perform(delete("/api/v1/inspection-templates/" + templateId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.status").value("INACTIVE"));

        InspectionTemplate saved = templateRepository.findById(UUID.fromString(templateId)).orElseThrow();
        assertFalse(saved.isActive());
        TemplateVersion preservedVersion = templateVersionRepository
                .findByTemplateIdAndVersionNumber(UUID.fromString(templateId), 1)
                .orElseThrow();
        assertEquals(TemplateVersionStatus.PUBLISHED, preservedVersion.getStatus());

        // Reativação retorna ao estado PUBLISHED porque já possui versão publicada
        mockMvc.perform(patch("/api/v1/inspection-templates/" + templateId + "/activate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        // OpenAPI / Swagger documenta /api/v1/inspection-templates sem erros
        MvcResult apiDocsResult = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        String apiDocsJson = apiDocsResult.getResponse().getContentAsString();
        assertNotNull(apiDocsJson);
        assertTrue(apiDocsJson.contains("/api/v1/inspection-templates"));
        assertTrue(apiDocsJson.contains("/api/v1/inspection-templates/{id}/publish"));
        assertTrue(apiDocsJson.contains("/api/v1/inspection-templates/{id}/snapshot"));
    }

    private String createAndPublishBasicTemplate(String code, String title) throws Exception {
        String payload = """
                {
                  "code": "%s",
                  "title": "%s",
                  "description": "Modelo padrão de teste",
                  "category": "MECANICA",
                  "sections": [
                    {
                      "title": "Verificação Geral",
                      "orderIndex": 0,
                      "items": [
                        {
                          "code": "GEN-01",
                          "title": "O compressor apresenta vazamentos?",
                          "responseType": "CONFORMITY",
                          "required": true,
                          "observationRequiredOnFailure": true,
                          "evidenceRequiredOnFailure": false,
                          "orderIndex": 0
                        }
                      ]
                    }
                  ]
                }
                """.formatted(code, title);

        MvcResult createResult = mockMvc.perform(post("/api/v1/inspection-templates")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();

        String templateId = extractId(createResult.getResponse().getContentAsString());

        mockMvc.perform(post("/api/v1/inspection-templates/" + templateId + "/publish")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));

        return templateId;
    }

    private String extractId(String json) {
        Matcher matcher = ID_EXTRACTOR.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        throw new IllegalStateException("Campo id não encontrado na resposta JSON: " + json);
    }
}
