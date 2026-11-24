package com.fieldops.config;

import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.inspection.domain.InspectionPriority;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.dto.InspectionItemSnapshotResponse;
import com.fieldops.modules.inspection.dto.ScheduleInspectionRequest;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.inspection.service.InspectionSchedulingService;
import com.fieldops.modules.sync.domain.InspectionResponse;
import com.fieldops.modules.sync.domain.NonConformity;
import com.fieldops.modules.sync.domain.NonConformitySeverity;
import com.fieldops.modules.sync.domain.NonConformityStatus;
import com.fieldops.modules.sync.repository.InspectionResponseRepository;
import com.fieldops.modules.sync.repository.NonConformityRepository;
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
import com.fieldops.modules.template.domain.TemplateStatus;
import com.fieldops.modules.template.dto.TemplateItemRequest;
import com.fieldops.modules.template.dto.TemplateRequest;
import com.fieldops.modules.template.dto.TemplateResponse;
import com.fieldops.modules.template.dto.TemplateSectionRequest;
import com.fieldops.modules.template.repository.InspectionTemplateRepository;
import com.fieldops.modules.template.service.TemplateService;
import com.fieldops.security.jwt.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Inicializador idempotente para ambiente de desenvolvimento/validação humana (Swagger UI + Web Admin).
 * Garante contas padrão de acesso e massa mínima inicial de Clientes, Locais e Equipamentos caso o banco esteja vazio.
 */
@Configuration
@Profile("!test")
public class DevBootstrapSeedConfig {

    private static final Logger log = LoggerFactory.getLogger(DevBootstrapSeedConfig.class);

    @Bean
    ApplicationRunner devMasterDataInitializer(
            UserRepository userRepository,
            ClientRepository clientRepository,
            SiteRepository siteRepository,
            EquipmentRepository equipmentRepository,
            InspectionTemplateRepository templateRepository,
            TemplateService templateService,
            InspectionRepository inspectionRepository,
            InspectionSchedulingService inspectionSchedulingService,
            InspectionResponseRepository inspectionResponseRepository,
            NonConformityRepository nonConformityRepository,
            TransactionTemplate transactionTemplate,
            PasswordEncoder passwordEncoder
    ) {
        return args -> {
            seedInitialData(
                    userRepository,
                    clientRepository,
                    siteRepository,
                    equipmentRepository,
                    passwordEncoder
            );
            seedInitialTemplates(userRepository, templateRepository, templateService);
            transactionTemplate.executeWithoutResult(ignored -> seedInitialInspections(
                    userRepository,
                    equipmentRepository,
                    templateRepository,
                    inspectionRepository,
                    inspectionSchedulingService,
                    inspectionResponseRepository,
                    nonConformityRepository
            ));
        };
    }

    @Transactional
    void seedInitialData(
            UserRepository userRepository,
            ClientRepository clientRepository,
            SiteRepository siteRepository,
            EquipmentRepository equipmentRepository,
            PasswordEncoder passwordEncoder
    ) {
        seedDefaultUser(
                userRepository,
                passwordEncoder,
                "Administrador FieldOps",
                "admin@fieldops.com",
                UserRole.ADMIN,
                "+5511990000001"
        );
        seedDefaultUser(
                userRepository,
                passwordEncoder,
                "Supervisor Operacional",
                "supervisor@fieldops.com",
                UserRole.SUPERVISOR,
                "+5511990000002"
        );
        seedDefaultUser(
                userRepository,
                passwordEncoder,
                "Carlos Técnico",
                "tecnico@fieldops.com",
                UserRole.TECHNICIAN,
                "+5511990000003"
        );
        seedDefaultUser(
                userRepository,
                passwordEncoder,
                "Ana Ribeiro Técnica",
                "ana.tecnica@fieldops.com",
                UserRole.TECHNICIAN,
                "+5511990000004"
        );

        if (clientRepository.count() > 0) {
            return;
        }

        Client alfa = new Client();
        alfa.setId(UUID.randomUUID());
        alfa.setCode("CLI-ALFA");
        alfa.setName("Indústria Alfa");
        alfa.setLegalName("Indústria Alfa S.A.");
        alfa.setDocument("12.345.678/0001-90");
        alfa.setEmail("operacoes@alfa.com.br");
        alfa.setPhone("+551533334400");
        alfa.setStatus(MasterStatus.ACTIVE);
        alfa = clientRepository.save(alfa);

        Client beta = new Client();
        beta.setId(UUID.randomUUID());
        beta.setCode("CLI-BETA");
        beta.setName("Logística Beta");
        beta.setLegalName("Logística Beta Ltda.");
        beta.setDocument("98.765.432/0001-10");
        beta.setEmail("manutencao@beta.com.br");
        beta.setPhone("+551144445500");
        beta.setStatus(MasterStatus.ACTIVE);
        beta = clientRepository.save(beta);

        Site siteSorocaba = new Site();
        siteSorocaba.setId(UUID.randomUUID());
        siteSorocaba.setClient(alfa);
        siteSorocaba.setCode("SITE-SOR-01");
        siteSorocaba.setName("Planta Sorocaba");
        siteSorocaba.setDescription("Unidade fabril principal com subestação e utilidades.");
        siteSorocaba.setAddressLine("Av. Industrial, 1200");
        siteSorocaba.setCity("Sorocaba");
        siteSorocaba.setState("SP");
        siteSorocaba.setPostalCode("18010-000");
        siteSorocaba.setLatitude(new BigDecimal("-23.5015300"));
        siteSorocaba.setLongitude(new BigDecimal("-47.4525600"));
        siteSorocaba.setContactName("Marcos Silva");
        siteSorocaba.setContactPhone("+5515999991111");
        siteSorocaba.setStatus(MasterStatus.ACTIVE);
        siteSorocaba = siteRepository.save(siteSorocaba);

        Site siteCampinas = new Site();
        siteCampinas.setId(UUID.randomUUID());
        siteCampinas.setClient(beta);
        siteCampinas.setCode("SITE-CMP-01");
        siteCampinas.setName("Centro de Distribuição Campinas");
        siteCampinas.setDescription("Armazém refrigerado e docas de expedição.");
        siteCampinas.setAddressLine("Rod. Anhanguera, Km 98");
        siteCampinas.setCity("Campinas");
        siteCampinas.setState("SP");
        siteCampinas.setPostalCode("13050-000");
        siteCampinas.setContactName("Juliana Costa");
        siteCampinas.setContactPhone("+5519999992222");
        siteCampinas.setStatus(MasterStatus.ACTIVE);
        siteCampinas = siteRepository.save(siteCampinas);

        createSeedEquipment(
                equipmentRepository,
                siteSorocaba,
                "EQP-GD-001",
                "Gerador Diesel GD-001",
                "PAT-2026-0001",
                "SN-CAT-9001",
                "Caterpillar",
                "C15-500kVA",
                "QR-FIELDOPS-GD001",
                LocalDate.of(2025, 3, 10)
        );
        createSeedEquipment(
                equipmentRepository,
                siteSorocaba,
                "EQP-CP-002",
                "Compressor Parafuso CP-002",
                "PAT-2026-0002",
                "SN-ATL-8821",
                "Atlas Copco",
                "GA 55+",
                "QR-FIELDOPS-CP002",
                LocalDate.of(2025, 6, 20)
        );
        createSeedEquipment(
                equipmentRepository,
                siteCampinas,
                "EQP-TR-003",
                "Transformador Subestação TR-003",
                "PAT-2026-0003",
                "SN-WEG-4410",
                "WEG",
                "1500kVA-13.8kV",
                "QR-FIELDOPS-TR003",
                LocalDate.of(2024, 11, 5)
        );

        log.info("Massa inicial de desenvolvimento verificada/populada para validação (clientes, locais, equipamentos).");
    }

    private void seedDefaultUser(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            String name,
            String email,
            UserRole role,
            String phone
    ) {
        if (userRepository.existsByEmailIgnoreCase(email)) {
            return;
        }
        User user = new User(
                UUID.randomUUID(),
                name,
                email,
                passwordEncoder.encode("FieldOps@123"),
                role,
                UserStatus.ACTIVE,
                phone
        );
        userRepository.save(user);
    }

    private void createSeedEquipment(
            EquipmentRepository equipmentRepository,
            Site site,
            String code,
            String name,
            String assetNumber,
            String serialNumber,
            String manufacturer,
            String model,
            String qrCode,
            LocalDate installedAt
    ) {
        if (equipmentRepository.existsByQrCodeIgnoreCase(qrCode)) {
            return;
        }
        Equipment equipment = new Equipment();
        equipment.setId(UUID.randomUUID());
        equipment.setSite(site);
        equipment.setCode(code);
        equipment.setName(name);
        equipment.setAssetNumber(assetNumber);
        equipment.setSerialNumber(serialNumber);
        equipment.setManufacturer(manufacturer);
        equipment.setModel(model);
        equipment.setQrCode(qrCode);
        equipment.setStatus(EquipmentStatus.ACTIVE);
        equipment.setInstalledAt(installedAt);
        equipmentRepository.save(equipment);
    }

    private void seedInitialTemplates(
            UserRepository userRepository,
            InspectionTemplateRepository templateRepository,
            TemplateService templateService
    ) {
        if (templateRepository.count() > 0) {
            return;
        }

        UUID supervisorId = userRepository.findByEmailIgnoreCase("supervisor@fieldops.com")
                .map(User::getId)
                .orElse(null);

        TemplateResponse publishedTemplate = templateService.createDraft(
                new TemplateRequest(
                        "TPL-GER-01",
                        "Checklist Preventivo de Gerador Diesel",
                        "Inspeção periódica de segurança, partida, níveis de fluidos e painel elétrico de grupos geradores.",
                        "MECANICA",
                        List.of(
                                new TemplateSectionRequest(
                                        "Inspeção Visual e Segurança",
                                        "Verificações iniciais antes da partida.",
                                        0,
                                        List.of(
                                                new TemplateItemRequest(
                                                        "GER-01",
                                                        "Lacre e integridade externa do equipamento",
                                                        "Confirmar ausência de avarias na carenagem.",
                                                        ResponseType.CONFORMITY,
                                                        true,
                                                        true,
                                                        true,
                                                        null,
                                                        null,
                                                        0
                                                ),
                                                new TemplateItemRequest(
                                                        "GER-02",
                                                        "Área ao redor livre de vazamentos de óleo ou combustível?",
                                                        null,
                                                        ResponseType.BOOLEAN,
                                                        true,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        1
                                                ),
                                                new TemplateItemRequest(
                                                        "GER-03",
                                                        "Modo de operação selecionado no painel",
                                                        null,
                                                        ResponseType.SINGLE_CHOICE,
                                                        true,
                                                        false,
                                                        false,
                                                        List.of("Automático", "Manual", "Desligado"),
                                                        null,
                                                        2
                                                )
                                        )
                                ),
                                new TemplateSectionRequest(
                                        "Medições e Evidências",
                                        "Leituras operacionais e registros obrigatórios.",
                                        1,
                                        List.of(
                                                new TemplateItemRequest(
                                                        "GER-04",
                                                        "Horímetro atual (horas)",
                                                        null,
                                                        ResponseType.NUMBER,
                                                        true,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        0
                                                ),
                                                new TemplateItemRequest(
                                                        "GER-05",
                                                        "Data da última troca de óleo",
                                                        null,
                                                        ResponseType.DATE,
                                                        false,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        1
                                                ),
                                                new TemplateItemRequest(
                                                        "GER-06",
                                                        "Foto frontal do painel de controle",
                                                        null,
                                                        ResponseType.PHOTO,
                                                        true,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        2
                                                ),
                                                new TemplateItemRequest(
                                                        "GER-07",
                                                        "Responsável local acompanhante",
                                                        null,
                                                        ResponseType.TEXT_SHORT,
                                                        false,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        3
                                                ),
                                                new TemplateItemRequest(
                                                        "GER-08",
                                                        "Observações gerais de campo",
                                                        null,
                                                        ResponseType.TEXT_LONG,
                                                        false,
                                                        false,
                                                        false,
                                                        null,
                                                        null,
                                                        4
                                                )
                                        )
                                )
                        )
                ),
                supervisorId
        );
        templateService.publish(publishedTemplate.id(), supervisorId);

        templateService.createDraft(
                new TemplateRequest(
                        "TPL-SUB-02",
                        "Inspeção de Subestação e Transformadores",
                        "Rascunho inicial para validação de transformadores, proteção e aterramento.",
                        "ELETRICA",
                        List.of(
                                new TemplateSectionRequest(
                                        "Proteção e Aterramento",
                                        "Itens em definição pelo supervisor.",
                                        0,
                                        List.of(
                                                new TemplateItemRequest(
                                                        "SUB-01",
                                                        "Malha de aterramento e conexões sem oxidação",
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
                                                        "SUB-02",
                                                        "Temperatura do óleo isolante (°C)",
                                                        "Selecione o tipo Número antes de publicar.",
                                                        null,
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
                supervisorId
        );

        log.info("Massa inicial de modelos de inspeção (1 publicado e 1 rascunho) populada para validação.");
    }

    private void seedInitialInspections(
            UserRepository userRepository,
            EquipmentRepository equipmentRepository,
            InspectionTemplateRepository templateRepository,
            InspectionRepository inspectionRepository,
            InspectionSchedulingService inspectionSchedulingService,
            InspectionResponseRepository inspectionResponseRepository,
            NonConformityRepository nonConformityRepository
    ) {
        if (inspectionRepository.count() > 0) {
            return;
        }

        User supervisor = userRepository.findByEmailIgnoreCase("supervisor@fieldops.com").orElse(null);
        User carlos = userRepository.findByEmailIgnoreCase("tecnico@fieldops.com").orElse(null);
        User ana = userRepository.findByEmailIgnoreCase("ana.tecnica@fieldops.com").orElse(carlos);
        InspectionTemplate publishedTemplate = templateRepository.findAll().stream()
                .filter(t -> t.getStatus() == TemplateStatus.PUBLISHED && t.isActive())
                .findFirst()
                .orElse(null);

        Equipment generator = equipmentRepository.findByQrCodeIgnoreCase("QR-FIELDOPS-GD001").orElse(null);
        Equipment compressor = equipmentRepository.findByQrCodeIgnoreCase("QR-FIELDOPS-CP002").orElse(null);
        Equipment transformer = equipmentRepository.findByQrCodeIgnoreCase("QR-FIELDOPS-TR003").orElse(null);

        if (supervisor == null || carlos == null || ana == null || publishedTemplate == null
                || generator == null || compressor == null || transformer == null) {
            return;
        }

        AuthenticatedUser actor = new AuthenticatedUser(
                supervisor.getId(),
                supervisor.getEmail(),
                supervisor.getRole()
        );
        Instant now = Instant.now();

        inspectionSchedulingService.schedule(
                new ScheduleInspectionRequest(
                        publishedTemplate.getId(),
                        null,
                        null,
                        generator.getSite().getClient().getId(),
                        generator.getSite().getId(),
                        generator.getId(),
                        carlos.getId(),
                        supervisor.getId(),
                        now.plus(2, ChronoUnit.DAYS).toString(),
                        null,
                        "Inspeção Preventiva — Gerador Diesel GD-001",
                        "Conferir nível de óleo, integridade da carenagem e painel antes da partida.",
                        InspectionPriority.ALTA
                ),
                actor
        );

        inspectionSchedulingService.schedule(
                new ScheduleInspectionRequest(
                        publishedTemplate.getId(),
                        null,
                        null,
                        compressor.getSite().getClient().getId(),
                        compressor.getSite().getId(),
                        compressor.getId(),
                        ana.getId(),
                        supervisor.getId(),
                        now.minus(2, ChronoUnit.DAYS).toString(),
                        null,
                        "Inspeção Atrasada — Compressor Parafuso CP-002",
                        "Prioridade urgente devido a atraso operacional na planta.",
                        InspectionPriority.URGENTE
                ),
                actor
        );

        InspectionDetailsResponse approvedCreated = inspectionSchedulingService.schedule(
                new ScheduleInspectionRequest(
                        publishedTemplate.getId(),
                        null,
                        null,
                        transformer.getSite().getClient().getId(),
                        transformer.getSite().getId(),
                        transformer.getId(),
                        carlos.getId(),
                        supervisor.getId(),
                        now.minus(1, ChronoUnit.DAYS).toString(),
                        null,
                        "Inspeção Concluída e Aprovada — Transformador TR-003",
                        "Checklist concluído e validado pela supervisão.",
                        InspectionPriority.MEDIA
                ),
                actor
        );

        Inspection approvedEntity = inspectionRepository.findDetailedById(approvedCreated.id()).orElse(null);
        if (approvedEntity != null) {
            approvedEntity.setStatus(InspectionStatus.APROVADA);
            approvedEntity.setStartedAtDevice(now.minus(6, ChronoUnit.HOURS));
            approvedEntity.setStartedAtServer(now.minus(5, ChronoUnit.HOURS));
            approvedEntity.setCompletedAtDevice(now.minus(3, ChronoUnit.HOURS));
            approvedEntity.setSubmittedAtServer(now.minus(2, ChronoUnit.HOURS));
            approvedEntity.setApprovedAt(now.minus(1, ChronoUnit.HOURS));
            approvedEntity.setApprovedBy(supervisor.getId());
            inspectionRepository.save(approvedEntity);
        }

        InspectionDetailsResponse inProgressCreated = inspectionSchedulingService.schedule(
                new ScheduleInspectionRequest(
                        publishedTemplate.getId(),
                        null,
                        null,
                        compressor.getSite().getClient().getId(),
                        compressor.getSite().getId(),
                        compressor.getId(),
                        ana.getId(),
                        supervisor.getId(),
                        now.plus(4, ChronoUnit.HOURS).toString(),
                        null,
                        "Inspeção em Execução — Compressor Parafuso CP-002",
                        "Execução iniciada em campo para validação de pressão e ruído.",
                        InspectionPriority.MEDIA
                ),
                actor
        );
        Inspection inProgressEntity = inspectionRepository.findDetailedById(inProgressCreated.id()).orElse(null);
        if (inProgressEntity != null) {
            inProgressEntity.setStatus(InspectionStatus.EM_ANDAMENTO);
            inProgressEntity.setStartedAtDevice(now.minus(45, ChronoUnit.MINUTES));
            inProgressEntity.setStartedAtServer(now.minus(40, ChronoUnit.MINUTES));
            inProgressEntity.setStartLatitude(new BigDecimal("-23.5015300"));
            inProgressEntity.setStartLongitude(new BigDecimal("-47.4525600"));
            inProgressEntity.setStartAccuracy(new BigDecimal("8.50"));
            inspectionRepository.save(inProgressEntity);
        }

        InspectionDetailsResponse submittedCreated = inspectionSchedulingService.schedule(
                new ScheduleInspectionRequest(
                        publishedTemplate.getId(),
                        null,
                        null,
                        generator.getSite().getClient().getId(),
                        generator.getSite().getId(),
                        generator.getId(),
                        carlos.getId(),
                        supervisor.getId(),
                        now.minus(3, ChronoUnit.HOURS).toString(),
                        null,
                        "Inspeção Aguardando Revisão — Gerador Diesel GD-001",
                        "Sincronizada pelo aplicativo móvel com não conformidades para parecer técnico.",
                        InspectionPriority.ALTA
                ),
                actor
        );
        Inspection submittedEntity = inspectionRepository.findDetailedById(submittedCreated.id()).orElse(null);
        if (submittedEntity != null) {
            submittedEntity.setStatus(InspectionStatus.ENVIADA);
            submittedEntity.setStartedAtDevice(now.minus(2, ChronoUnit.HOURS));
            submittedEntity.setStartedAtServer(now.minus(110, ChronoUnit.MINUTES));
            submittedEntity.setCompletedAtDevice(now.minus(30, ChronoUnit.MINUTES));
            submittedEntity.setSubmittedAtServer(now.minus(25, ChronoUnit.MINUTES));
            submittedEntity.setStartLatitude(new BigDecimal("-23.5015300"));
            submittedEntity.setStartLongitude(new BigDecimal("-47.4525600"));
            submittedEntity.setStartAccuracy(new BigDecimal("7.20"));
            submittedEntity.setCompleteLatitude(new BigDecimal("-23.5018800"));
            submittedEntity.setCompleteLongitude(new BigDecimal("-47.4522100"));
            submittedEntity.setCompleteAccuracy(new BigDecimal("6.40"));
            inspectionRepository.save(submittedEntity);

            seedResponsesAndNonConformities(
                    submittedEntity,
                    submittedCreated.items(),
                    carlos.getId(),
                    now,
                    inspectionResponseRepository,
                    nonConformityRepository
            );
        }

        log.info("Massa inicial de inspeções populada para Dashboard e Revisão (ATRIBUÍDA, EM_ANDAMENTO, ENVIADA, APROVADA e 4 NCs).");
    }

    private void seedResponsesAndNonConformities(
            Inspection inspection,
            List<InspectionItemSnapshotResponse> items,
            UUID technicianId,
            Instant now,
            InspectionResponseRepository inspectionResponseRepository,
            NonConformityRepository nonConformityRepository
    ) {
        UUID firstItemId = null;
        String firstItemTitle = null;

        for (InspectionItemSnapshotResponse item : items) {
            InspectionResponse response = new InspectionResponse();
            response.setId(UUID.randomUUID());
            response.setInspectionId(inspection.getId());
            response.setInspectionItemId(item.id());
            response.setAnsweredBy(technicianId);
            response.setAnsweredAtDevice(now.minus(40, ChronoUnit.MINUTES));
            response.setServerReceivedAt(now.minus(25, ChronoUnit.MINUTES));

            switch (item.responseType()) {
                case CONFORMITY -> {
                    firstItemId = item.id();
                    firstItemTitle = item.itemTitle();
                    response.setValueRaw("NON_CONFORMING");
                    response.setConformity("NON_CONFORMING");
                    response.setNonConformity(true);
                    response.setNonConformityDescription("Lacre rompido na porta lateral do gerador.");
                    response.setObservation("Detectado durante vistoria visual inicial.");
                }
                case BOOLEAN -> {
                    response.setValueRaw("true");
                    response.setValueBoolean(true);
                    response.setObservation("Piso limpo e sem vestígios de vazamento.");
                }
                case SINGLE_CHOICE -> {
                    response.setValueRaw("Automático");
                    response.setValueText("Automático");
                }
                case NUMBER -> {
                    response.setValueRaw("1425.5");
                    response.setValueNumber(new BigDecimal("1425.5"));
                }
                case DATE -> {
                    response.setValueRaw("2026-10-15");
                    response.setValueDate(LocalDate.of(2026, 10, 15));
                }
                case TEXT_SHORT -> {
                    response.setValueRaw("Marcos Silva");
                    response.setValueText("Marcos Silva");
                }
                case TEXT_LONG -> {
                    response.setValueRaw("Equipamento operando em regime de stand-by; necessária reposição do lacre.");
                    response.setValueText("Equipamento operando em regime de stand-by; necessária reposição do lacre.");
                }
                case PHOTO -> {
                    response.setValueRaw("FOTO_ANEXADA");
                    response.setObservation("Registro fotográfico realizado em campo.");
                }
            }
            inspectionResponseRepository.save(response);
        }

        nonConformityRepository.saveAll(List.of(
                createSeedNonConformity(
                        inspection.getId(), firstItemId, firstItemTitle,
                        "Falha no sensor de parada de emergência",
                        "Botão de emergência apresentou travamento mecânico no teste.",
                        NonConformitySeverity.CRITICA, technicianId, now
                ),
                createSeedNonConformity(
                        inspection.getId(), firstItemId, firstItemTitle,
                        "Lacre lateral rompido na carenagem",
                        "Carenagem direita sem lacre de segurança intacto.",
                        NonConformitySeverity.ALTA, technicianId, now
                ),
                createSeedNonConformity(
                        inspection.getId(), null, null,
                        "Filtro de ar próximo ao limite de horas",
                        "Recomendar substituição preventiva na próxima parada programada.",
                        NonConformitySeverity.MEDIA, technicianId, now
                ),
                createSeedNonConformity(
                        inspection.getId(), null, null,
                        "Etiqueta de identificação parcialmente desgastada",
                        "Leitura ainda possível, porém recomenda-se reimpressão da etiqueta.",
                        NonConformitySeverity.BAIXA, technicianId, now
                )
        ));
    }

    private NonConformity createSeedNonConformity(
            UUID inspectionId,
            UUID itemId,
            String itemTitle,
            String title,
            String description,
            NonConformitySeverity severity,
            UUID createdBy,
            Instant now
    ) {
        NonConformity nc = new NonConformity();
        nc.setId(UUID.randomUUID());
        nc.setInspectionId(inspectionId);
        nc.setInspectionItemId(itemId);
        nc.setItemTitle(itemTitle);
        nc.setTitle(title);
        nc.setDescription(description);
        nc.setSeverity(severity);
        nc.setStatus(NonConformityStatus.OPEN);
        nc.setCreatedBy(createdBy);
        nc.setCreatedAtDevice(now.minus(35, ChronoUnit.MINUTES));
        nc.setServerReceivedAt(now.minus(25, ChronoUnit.MINUTES));
        return nc;
    }
}

