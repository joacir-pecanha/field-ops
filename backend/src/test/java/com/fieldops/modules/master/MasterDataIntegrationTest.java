package com.fieldops.modules.master;

import com.fieldops.modules.auth.domain.RefreshToken;
import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.repository.ClientRepository;
import com.fieldops.modules.master.repository.EquipmentRepository;
import com.fieldops.modules.master.repository.SiteRepository;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.modules.master.service.ClientService;
import com.fieldops.modules.master.service.EquipmentService;
import com.fieldops.modules.master.service.SiteService;
import com.fieldops.modules.master.service.UserMasterService;
import com.fieldops.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
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
 * Testes de integração completos da API de Cadastros Mestres (TASK-007 Passo 6).
 * Valida migrações Flyway, mapeamento JPA, Specifications paginadas, Bean Validation,
 * unicidade de QR Code (HTTP 409), inativação lógica, bloqueio de vínculos inativos,
 * autorização por roles e geração OpenAPI/Swagger.
 */
@SpringBootTest
@ActiveProfiles("test")
class MasterDataIntegrationTest {

    private static final Pattern ID_EXTRACTOR = Pattern.compile("\"id\"\\s*:\\s*\"([0-9a-fA-F-]+)\"");

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private SiteRepository siteRepository;

    @Autowired
    private EquipmentRepository equipmentRepository;

    @Autowired
    private ClientService clientService;

    @Autowired
    private SiteService siteService;

    @Autowired
    private EquipmentService equipmentService;

    @Autowired
    private UserMasterService userMasterService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private MockMvc mockMvc;

    private String adminToken;
    private String supervisorToken;
    private String technicianToken;
    private User technicianUser;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        equipmentRepository.deleteAll();
        siteRepository.deleteAll();
        clientRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

        String hash = passwordEncoder.encode("SenhaForte@123");

        User adminUser = userRepository.save(new User(
                UUID.randomUUID(), "Admin Master", "admin.master@fieldops.com", hash,
                UserRole.ADMIN, UserStatus.ACTIVE, "+5511999990001"
        ));
        User supervisorUser = userRepository.save(new User(
                UUID.randomUUID(), "Supervisor Master", "supervisor.master@fieldops.com", hash,
                UserRole.SUPERVISOR, UserStatus.ACTIVE, "+5511999990002"
        ));
        technicianUser = userRepository.save(new User(
                UUID.randomUUID(), "Técnico Campo", "tecnico.master@fieldops.com", hash,
                UserRole.TECHNICIAN, UserStatus.ACTIVE, "+5511999990003"
        ));

        adminToken = jwtTokenProvider.generateAccessToken(adminUser);
        supervisorToken = jwtTokenProvider.generateAccessToken(supervisorUser);
        technicianToken = jwtTokenProvider.generateAccessToken(technicianUser);
    }

    @Test
    @DisplayName("CA-01 / RF-06: Criação hierárquica (Cliente -> Local -> Equipamento) e busca paginada com filtro textual")
    void shouldCreateHierarchyAndSupportPaginatedSearchAndSorting() throws Exception {
        String client1Id = createClient("CLI-001", "Indústria Alfa", "12.345.678/0001-90");
        String client2Id = createClient("CLI-002", "Logística Beta", "98.765.432/0001-10");

        String site1Id = createSite(client1Id, "SITE-SOR-01", "Unidade Sorocaba", "Sorocaba", "SP");
        String site2Id = createSite(client1Id, "SITE-ITU-02", "Unidade Itu", "Itu", "SP");
        createSite(client2Id, "SITE-CPS-01", "Centro Campinas", "Campinas", "SP");

        createEquipment(site1Id, "EQP-001", "Gerador Diesel GD-001", "QR-GD-001");
        createEquipment(site1Id, "EQP-002", "Compressor Atlas 02", "QR-CMP-002");
        createEquipment(site2Id, "EQP-003", "Empilhadeira Elétrica 03", "QR-EMP-003");

        // Paginação e ordenação descendente em clientes
        mockMvc.perform(get("/api/v1/clients?page=0&size=1&sort=name,desc")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].name").value("Logística Beta"))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(false));

        // Pesquisa textual por código do cliente
        mockMvc.perform(get("/api/v1/clients?search=CLI-001")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(client1Id));

        // Filtro de locais por cliente via endpoint aninhado e query param
        mockMvc.perform(get("/api/v1/clients/" + client1Id + "/sites?search=Sorocaba")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].clientId").value(client1Id))
                .andExpect(jsonPath("$.content[0].clientName").value("Indústria Alfa"));

        // Filtro de equipamentos por local e consulta direta por QR Code
        mockMvc.perform(get("/api/v1/sites/" + site1Id + "/equipments?sort=name,asc")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].name").value("Compressor Atlas 02"))
                .andExpect(jsonPath("$.content[1].name").value("Gerador Diesel GD-001"));

        mockMvc.perform(get("/api/v1/equipments/qr/QR-GD-001")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.qrCode").value("QR-GD-001"))
                .andExpect(jsonPath("$.siteId").value(site1Id))
                .andExpect(jsonPath("$.clientId").value(client1Id));
    }

    @Test
    @DisplayName("CA-02 / EX-01 / RT-04: Colisão de QR Code retorna HTTP 409 Conflict e índice único impede duplicidade no banco")
    void shouldRejectDuplicateQrCodeWith409Conflict() throws Exception {
        String clientId = createClient("CLI-QR", "Cliente QR", "11.222.333/0001-44");
        String siteId = createSite(clientId, "SITE-QR", "Unidade Matriz", "São Paulo", "SP");
        String eq1Id = createEquipment(siteId, "EQP-A", "Caldeira 01", "QR-UNICO-100");
        String eq2Id = createEquipment(siteId, "EQP-B", "Caldeira 02", "QR-UNICO-200");

        // Tentativa de cadastrar outro equipamento com o mesmo QR Code (inclusive variando maiúsculas/minúsculas)
        String duplicatePayload = """
                {
                  "siteId": "%s",
                  "code": "EQP-C",
                  "name": "Caldeira Duplicada",
                  "qrCode": "qr-unico-100"
                }
                """.formatted(siteId);

        mockMvc.perform(post("/api/v1/equipments")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(duplicatePayload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("DUPLICATE_QR_CODE"))
                .andExpect(jsonPath("$.detail", containsString("QR Code")));

        // Tentativa de atualizar equipamento 2 usando o QR Code do equipamento 1
        String updateDuplicatePayload = """
                {
                  "siteId": "%s",
                  "code": "EQP-B",
                  "name": "Caldeira 02",
                  "qrCode": "QR-UNICO-100"
                }
                """.formatted(siteId);

        mockMvc.perform(put("/api/v1/equipments/" + eq2Id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateDuplicatePayload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_QR_CODE"));

        // Garante também que a restrição UNIQUE(qr_code) existe no banco de dados
        var siteEntity = siteRepository.findById(UUID.fromString(siteId)).orElseThrow();
        var duplicateEntity = new com.fieldops.modules.master.domain.Equipment();
        duplicateEntity.setId(UUID.randomUUID());
        duplicateEntity.setSite(siteEntity);
        duplicateEntity.setName("Bypass Direto");
        duplicateEntity.setQrCode("QR-UNICO-100");

        assertThrows(DataIntegrityViolationException.class, () -> equipmentRepository.saveAndFlush(duplicateEntity));
        assertTrue(equipmentRepository.findById(UUID.fromString(eq1Id)).isPresent());
    }

    @Test
    @DisplayName("CA-03 / RF-05 / EX-02: Inativação lógica preserva registros no banco e revoga sessões de usuário inativado")
    void shouldPerformLogicalInactivationPreservingEntitiesInDatabase() throws Exception {
        String clientId = createClient("CLI-HIST", "Cliente Histórico", "22.333.444/0001-55");
        String siteId = createSite(clientId, "SITE-HIST", "Unidade Histórica", "Campinas", "SP");
        String equipmentId = createEquipment(siteId, "EQP-HIST", "Transformador 01", "QR-HIST-001");

        // Cria token de refresh ativo para testar revogação ao inativar usuário
        RefreshToken token = new RefreshToken(
                UUID.randomUUID(),
                technicianUser,
                "refresh-token-to-revoke",
                "127.0.0.1",
                "JUnit",
                Instant.now().plusSeconds(3600)
        );
        refreshTokenRepository.save(token);

        // DELETE lógico no equipamento
        mockMvc.perform(delete("/api/v1/equipments/" + equipmentId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.status").value("INACTIVE"));

        var savedEquipment = equipmentRepository.findById(UUID.fromString(equipmentId)).orElseThrow();
        assertFalse(savedEquipment.isActive());

        // DELETE lógico no local e no cliente
        mockMvc.perform(delete("/api/v1/sites/" + siteId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        assertTrue(siteRepository.findById(UUID.fromString(siteId)).isPresent());

        mockMvc.perform(delete("/api/v1/clients/" + clientId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        assertTrue(clientRepository.findById(UUID.fromString(clientId)).isPresent());

        // DELETE lógico no usuário revoga sessões e preserva o usuário
        mockMvc.perform(delete("/api/v1/users/" + technicianUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.status").value("INACTIVE"));

        assertTrue(userRepository.findById(technicianUser.getId()).isPresent());
        RefreshToken reloadedToken = refreshTokenRepository.findById(token.getId()).orElseThrow();
        assertTrue(reloadedToken.isRevoked());
    }

    @Test
    @DisplayName("RF-04 / RN-012: Registros inativos não podem ser vinculados a novos cadastros ou inspeções")
    void shouldBlockLinkingInactiveRecordsToNewParentsOrInspections() throws Exception {
        String clientId = createClient("CLI-INAT", "Cliente Inativo Teste", "33.444.555/0001-66");
        String siteId = createSite(clientId, "SITE-INAT", "Local Inativo Teste", "Jundiaí", "SP");
        String equipmentId = createEquipment(siteId, "EQP-INAT", "Compressor Inativo", "QR-INAT-001");

        mockMvc.perform(patch("/api/v1/equipments/" + equipmentId + "/deactivate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk());

        assertThrows(BusinessRuleException.class, () ->
                equipmentService.requireActiveEquipmentBelongingToSite(
                        UUID.fromString(equipmentId), UUID.fromString(siteId)
                ));

        mockMvc.perform(patch("/api/v1/sites/" + siteId + "/deactivate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk());

        // Tentar criar novo equipamento em local inativo deve falhar com HTTP 422
        String newEquipmentPayload = """
                {
                  "siteId": "%s",
                  "name": "Bomba Nova",
                  "qrCode": "QR-NOVO-999"
                }
                """.formatted(siteId);

        mockMvc.perform(post("/api/v1/equipments")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(newEquipmentPayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INACTIVE_SITE"));

        assertThrows(BusinessRuleException.class, () ->
                siteService.requireActiveSiteBelongingToClient(
                        UUID.fromString(siteId), UUID.fromString(clientId)
                ));

        mockMvc.perform(patch("/api/v1/clients/" + clientId + "/deactivate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Tentar criar novo local em cliente inativo deve falhar com HTTP 422
        String newSitePayload = """
                {
                  "clientId": "%s",
                  "name": "Local Novo",
                  "state": "SP"
                }
                """.formatted(clientId);

        mockMvc.perform(post("/api/v1/sites")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(newSitePayload))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("INACTIVE_CLIENT"));

        assertThrows(BusinessRuleException.class, () ->
                clientService.requireActiveClient(UUID.fromString(clientId)));

        // Técnico inativo não pode ser atribuído a novas inspeções
        userMasterService.deactivate(technicianUser.getId());
        assertThrows(BusinessRuleException.class, () ->
                userMasterService.requireActiveTechnician(technicianUser.getId()));
    }

    @Test
    @DisplayName("RT-03 / RF-01 / RF-02: Bean Validation rejeita payloads inválidos e faltando vínculos obrigatórios")
    void shouldValidatePayloadsWithBeanValidation() throws Exception {
        String invalidClientPayload = """
                {
                  "code": "INVALID CODE",
                  "name": " ",
                  "document": "abc",
                  "email": "email-invalido"
                }
                """;

        mockMvc.perform(post("/api/v1/clients")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidClientPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.code").exists())
                .andExpect(jsonPath("$.errors.document").exists())
                .andExpect(jsonPath("$.errors.email").exists());

        // Site sem clientId e Equipment sem siteId/qrCode válido
        mockMvc.perform(post("/api/v1/sites")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Local Sem Cliente\",\"state\":\"SAO\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.clientId").exists())
                .andExpect(jsonPath("$.errors.state").exists());

        mockMvc.perform(post("/api/v1/equipments")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Equipamento Sem Local\",\"qrCode\":\"qr invalido\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.siteId").exists())
                .andExpect(jsonPath("$.errors.qrCode").exists());
    }

    @Test
    @DisplayName("AC-USERS / RN-003: Controle de acesso por perfil e gestão administrativa de usuários")
    void shouldEnforceRoleBasedAccessControlAndManageUsers() throws Exception {
        // Técnico não acessa escrita de cadastros nem gestão de usuários
        mockMvc.perform(post("/api/v1/clients")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Cliente Proibido\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/v1/users")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isForbidden());

        // Supervisor pode listar usuários, mas não pode criar usuário (restrito a ADMIN)
        mockMvc.perform(get("/api/v1/users?role=TECHNICIAN&active=true")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());

        String createUserPayload = """
                {
                  "name": "Novo Inspetor",
                  "email": "inspetor.novo@fieldops.com",
                  "password": "Password@2026",
                  "role": "TECHNICIAN",
                  "phone": "+5511988887777"
                }
                """;

        mockMvc.perform(post("/api/v1/users")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createUserPayload))
                .andExpect(status().isForbidden());

        // Admin cria usuário com sucesso e duplicidade de e-mail retorna 409
        mockMvc.perform(post("/api/v1/users")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createUserPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("inspetor.novo@fieldops.com"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        mockMvc.perform(post("/api/v1/users")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createUserPayload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
    }

    @Test
    @DisplayName("CA-04: Especificação OpenAPI / Swagger gera sem erros e documenta endpoints /api/v1/...")
    void shouldExposeOpenApiDocumentationWithoutSerializationErrors() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();

        String apiDocsJson = result.getResponse().getContentAsString();
        assertNotNull(apiDocsJson);
        assertTrue(apiDocsJson.contains("/api/v1/clients"));
        assertTrue(apiDocsJson.contains("/api/v1/sites"));
        assertTrue(apiDocsJson.contains("/api/v1/equipments"));
        assertTrue(apiDocsJson.contains("/api/v1/users"));
        assertTrue(apiDocsJson.contains("/api/v1/equipments/qr/{qrCode}"));
        assertEquals("application/json", result.getResponse().getContentType());
    }

    private String createClient(String code, String name, String document) throws Exception {
        String payload = """
                {
                  "code": "%s",
                  "name": "%s",
                  "legalName": "%s Ltda",
                  "document": "%s",
                  "email": "contato@fieldops.com",
                  "phone": "+551133334444"
                }
                """.formatted(code, name, name, document);

        MvcResult result = mockMvc.perform(post("/api/v1/clients")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty())
                .andReturn();

        return extractId(result.getResponse().getContentAsString());
    }

    private String createSite(String clientId, String code, String name, String city, String state) throws Exception {
        String payload = """
                {
                  "clientId": "%s",
                  "code": "%s",
                  "name": "%s",
                  "addressLine": "Av. Industrial, 100",
                  "city": "%s",
                  "state": "%s",
                  "postalCode": "18010-000",
                  "latitude": -23.50153,
                  "longitude": -47.45256
                }
                """.formatted(clientId, code, name, city, state);

        MvcResult result = mockMvc.perform(post("/api/v1/sites")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clientId").value(clientId))
                .andReturn();

        return extractId(result.getResponse().getContentAsString());
    }

    private String createEquipment(String siteId, String code, String name, String qrCode) throws Exception {
        String payload = """
                {
                  "siteId": "%s",
                  "code": "%s",
                  "name": "%s",
                  "assetNumber": "PAT-%s",
                  "serialNumber": "SN-%s",
                  "manufacturer": "FieldOps Mfg",
                  "model": "MK-2026",
                  "qrCode": "%s",
                  "installedAt": "2026-01-15"
                }
                """.formatted(siteId, code, name, code, code, qrCode);

        MvcResult result = mockMvc.perform(post("/api/v1/equipments")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.siteId").value(siteId))
                .andExpect(jsonPath("$.qrCode").value(qrCode))
                .andReturn();

        return extractId(result.getResponse().getContentAsString());
    }

    private String extractId(String json) {
        Matcher matcher = ID_EXTRACTOR.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        throw new IllegalStateException("Campo id não encontrado na resposta JSON: " + json);
    }
}

