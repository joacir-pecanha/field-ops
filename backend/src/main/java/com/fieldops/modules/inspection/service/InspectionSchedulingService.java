package com.fieldops.modules.inspection.service;

import com.fieldops.modules.inspection.domain.AuditLog;
import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.inspection.domain.InspectionPriority;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.dto.AuditLogResponse;
import com.fieldops.modules.inspection.dto.CancelInspectionRequest;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.dto.InspectionItemSnapshotResponse;
import com.fieldops.modules.inspection.dto.ScheduleInspectionRequest;
import com.fieldops.modules.inspection.exception.InspectionSchedulingValidationException;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.inspection.repository.InspectionSpecifications;
import com.fieldops.modules.master.domain.Client;
import com.fieldops.modules.master.domain.Equipment;
import com.fieldops.modules.master.domain.Site;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.master.repository.ClientRepository;
import com.fieldops.modules.master.repository.EquipmentRepository;
import com.fieldops.modules.master.repository.SiteRepository;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.TemplateStatus;
import com.fieldops.modules.template.domain.TemplateVersion;
import com.fieldops.modules.template.domain.TemplateVersionStatus;
import com.fieldops.modules.template.dto.TemplateItemSnapshotDto;
import com.fieldops.modules.template.dto.TemplateSnapshotResponse;
import com.fieldops.modules.template.repository.InspectionTemplateRepository;
import com.fieldops.modules.template.repository.TemplateVersionRepository;
import com.fieldops.modules.template.service.TemplateSnapshotService;
import com.fieldops.security.jwt.AuthenticatedUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Serviço de domínio responsável pelo agendamento, geração transacional de snapshots,
 * consulta de atribuições para sincronização, cancelamento administrativo e trilha de auditoria
 * (TASK-011, RN-014, RN-021, RN-024..RN-031, RN-086).
 */
@Service
public class InspectionSchedulingService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "scheduledFor", "createdAt", "updatedAt", "status", "priority", "title"
    );
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "scheduledFor");

    private final InspectionRepository inspectionRepository;
    private final InspectionItemSnapshotRepository snapshotRepository;
    private final AuditLogRepository auditLogRepository;
    private final ClientRepository clientRepository;
    private final SiteRepository siteRepository;
    private final EquipmentRepository equipmentRepository;
    private final UserRepository userRepository;
    private final InspectionTemplateRepository templateRepository;
    private final TemplateVersionRepository templateVersionRepository;
    private final TemplateSnapshotService templateSnapshotService;

    public InspectionSchedulingService(
            InspectionRepository inspectionRepository,
            InspectionItemSnapshotRepository snapshotRepository,
            AuditLogRepository auditLogRepository,
            ClientRepository clientRepository,
            SiteRepository siteRepository,
            EquipmentRepository equipmentRepository,
            UserRepository userRepository,
            InspectionTemplateRepository templateRepository,
            TemplateVersionRepository templateVersionRepository,
            TemplateSnapshotService templateSnapshotService
    ) {
        this.inspectionRepository = inspectionRepository;
        this.snapshotRepository = snapshotRepository;
        this.auditLogRepository = auditLogRepository;
        this.clientRepository = clientRepository;
        this.siteRepository = siteRepository;
        this.equipmentRepository = equipmentRepository;
        this.userRepository = userRepository;
        this.templateRepository = templateRepository;
        this.templateVersionRepository = templateVersionRepository;
        this.templateSnapshotService = templateSnapshotService;
    }

    /**
     * Agenda uma nova inspeção, valida compatibilidades e gera o snapshot imutável do checklist
     * em uma única transação atômica (RT-02, CA-01).
     */
    @Transactional
    public InspectionDetailsResponse schedule(ScheduleInspectionRequest request, AuthenticatedUser actor) {
        String rawScheduledFor = request.effectiveScheduledFor();
        if (rawScheduledFor == null) {
            throw new InspectionSchedulingValidationException(
                    "SCHEDULED_FOR_REQUIRED",
                    "A data prevista (scheduledFor) é obrigatória para agendar uma inspeção."
            );
        }
        Instant scheduledFor = parseScheduledFor(rawScheduledFor, "SCHEDULED_FOR", false);

        if (request.templateVersionId() == null && request.templateId() == null) {
            throw new InspectionSchedulingValidationException(
                    "TEMPLATE_REQUIRED",
                    "É obrigatório informar o modelo (templateId) ou a versão publicada (templateVersionId)."
            );
        }

        Client client = clientRepository.findById(request.clientId())
                .orElseThrow(() -> ResourceNotFoundException.of("Cliente", request.clientId()));
        if (!client.isActive()) {
            throw new BusinessRuleException(
                    "INACTIVE_CLIENT",
                    "O cliente selecionado está inativo e não pode ser utilizado em novos agendamentos."
            );
        }

        Site site = siteRepository.findById(request.siteId())
                .orElseThrow(() -> ResourceNotFoundException.of("Local de inspeção", request.siteId()));
        if (!site.getClient().getId().equals(client.getId())) {
            throw new BusinessRuleException(
                    "INCOMPATIBLE_SITE_CLIENT",
                    "O local selecionado (" + site.getName() + ") não pertence ao cliente informado ("
                            + client.getName() + ")."
            );
        }
        if (!site.isActive()) {
            throw new BusinessRuleException(
                    "INACTIVE_SITE",
                    "O local selecionado está inativo e não pode receber novas inspeções."
            );
        }

        Equipment equipment = null;
        if (request.equipmentId() != null) {
            equipment = equipmentRepository.findById(request.equipmentId())
                    .orElseThrow(() -> ResourceNotFoundException.of("Equipamento", request.equipmentId()));
            if (!equipment.getSite().getId().equals(site.getId())) {
                throw new BusinessRuleException(
                        "INCOMPATIBLE_EQUIPMENT_SITE",
                        "O equipamento selecionado (" + equipment.getName() + ") não pertence ao local informado ("
                                + site.getName() + ")."
                );
            }
            if (!equipment.isActive()) {
                throw new BusinessRuleException(
                        "INACTIVE_EQUIPMENT",
                        "O equipamento selecionado está inativo ou descomissionado e não pode ser utilizado em novas inspeções."
                );
            }
        }

        User technician = userRepository.findById(request.technicianId())
                .orElseThrow(() -> ResourceNotFoundException.of("Técnico", request.technicianId()));
        if (technician.getRole() != UserRole.TECHNICIAN) {
            throw new InspectionSchedulingValidationException(
                    "INVALID_TECHNICIAN_ROLE",
                    "O usuário '" + technician.getName() + "' não possui perfil de técnico (TECHNICIAN)."
            );
        }
        if (!technician.isActive()) {
            throw new InspectionSchedulingValidationException(
                    "INACTIVE_TECHNICIAN",
                    "Não é possível agendar inspeção para o técnico '" + technician.getName()
                            + "' pois ele está inativo ou bloqueado (status: " + technician.getStatus() + ")."
            );
        }

        User supervisor = resolveSupervisor(request.supervisorId(), actor);

        TemplateVersion publishedVersion = resolvePublishedTemplateVersion(request);
        InspectionTemplate template = publishedVersion.getTemplate();

        TemplateSnapshotResponse templateSnapshot =
                templateSnapshotService.generateSnapshotByVersionId(publishedVersion.getId());
        if (templateSnapshot.items().isEmpty()) {
            throw new BusinessRuleException(
                    "EMPTY_TEMPLATE_VERSION",
                    "A versão selecionada do modelo não possui itens de checklist válidos."
            );
        }

        Inspection inspection = new Inspection();
        inspection.setId(UUID.randomUUID());
        inspection.setTemplate(template);
        inspection.setTemplateVersion(publishedVersion);
        inspection.setTemplateVersionNumber(publishedVersion.getVersionNumber());
        inspection.setClient(client);
        inspection.setSite(site);
        inspection.setEquipment(equipment);
        inspection.setTechnician(technician);
        inspection.setSupervisor(supervisor);
        inspection.setCreatedBy(actor != null ? actor.getId() : null);
        inspection.setTitle(resolveInspectionTitle(request.title(), publishedVersion.getTitleSnapshot(), equipment, site));
        inspection.setInstructions(trimToNull(request.instructions()));
        inspection.setPriority(request.priority() != null ? request.priority() : InspectionPriority.MEDIA);
        inspection.setStatus(InspectionStatus.ATRIBUÍDA);
        inspection.setScheduledFor(scheduledFor);

        for (TemplateItemSnapshotDto itemDto : templateSnapshot.items()) {
            InspectionItemSnapshot snapshot = new InspectionItemSnapshot();
            snapshot.setId(UUID.randomUUID());
            snapshot.setSourceTemplateItemId(itemDto.sourceTemplateItemId());
            snapshot.setSectionTitle(itemDto.sectionTitle());
            snapshot.setSectionDescription(itemDto.sectionDescription());
            snapshot.setSectionOrder(itemDto.sectionOrder());
            snapshot.setItemCode(itemDto.itemCode());
            snapshot.setItemTitle(itemDto.itemTitle());
            snapshot.setItemDescription(itemDto.itemDescription());
            snapshot.setResponseType(itemDto.responseType());
            snapshot.setRequired(itemDto.required());
            snapshot.setObservationRequiredOnFailure(itemDto.observationRequiredOnFailure());
            snapshot.setEvidenceRequiredOnFailure(itemDto.evidenceRequiredOnFailure());
            snapshot.setRulesJson(itemDto.rulesJson());
            snapshot.setOptions(itemDto.options() != null ? new ArrayList<>(itemDto.options()) : null);
            snapshot.setItemOrder(itemDto.itemOrder());
            inspection.addItemSnapshot(snapshot);
        }

        Inspection saved = inspectionRepository.saveAndFlush(inspection);

        recordAuditEvent(
                saved.getId(),
                actor,
                "INSPECTION_CREATED",
                "INSPECTION",
                saved.getId(),
                null,
                saved.getStatus().name(),
                null,
                buildSchedulingSummaryJson(saved),
                buildSnapshotMetadataJson(saved, saved.getItemSnapshots().size()),
                "Inspeção agendada com geração de " + saved.getItemSnapshots().size() + " item(ns) em snapshot."
        );
        recordAuditEvent(
                saved.getId(),
                actor,
                "INSPECTION_ASSIGNED",
                "INSPECTION",
                saved.getId(),
                null,
                saved.getStatus().name(),
                null,
                "{\"technicianId\":\"" + technician.getId() + "\",\"technicianName\":\"" + escapeJson(technician.getName()) + "\"}",
                buildSnapshotMetadataJson(saved, saved.getItemSnapshots().size()),
                "Inspeção atribuída ao técnico " + technician.getName() + "."
        );

        return InspectionDetailsResponse.fromEntity(saved, saved.getItemSnapshots());
    }

    /**
     * Cancela administrativamente uma inspeção exigindo justificativa e bloqueando inspeções já aprovadas
     * (RF-07, RF-08, EX-02, RT-03).
     */
    @Transactional
    public InspectionDetailsResponse cancel(
            UUID inspectionId,
            CancelInspectionRequest request,
            AuthenticatedUser actor
    ) {
        String reason = request != null ? request.effectiveReason() : null;
        if (reason == null) {
            throw new BusinessRuleException(
                    "CANCEL_REASON_REQUIRED",
                    "A justificativa é obrigatória para cancelar uma inspeção."
            );
        }

        Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));

        if (inspection.getStatus() == InspectionStatus.APROVADA) {
            throw new BusinessRuleException(
                    "APPROVED_INSPECTION_CANNOT_BE_CANCELED",
                    "Inspeções já aprovadas não podem ser canceladas pelo fluxo comum."
            );
        }
        if (inspection.getStatus() == InspectionStatus.CANCELADA) {
            throw new BusinessRuleException(
                    "INSPECTION_ALREADY_CANCELED",
                    "A inspeção informada já foi cancelada anteriormente."
            );
        }

        InspectionStatus previousStatus = inspection.getStatus();
        Instant canceledAt = Instant.now();

        inspection.setStatus(InspectionStatus.CANCELADA);
        inspection.setCanceledAt(canceledAt);
        inspection.setCanceledBy(actor != null ? actor.getId() : null);
        inspection.setCanceledReason(reason);

        Inspection saved = inspectionRepository.saveAndFlush(inspection);

        recordAuditEvent(
                saved.getId(),
                actor,
                "INSPECTION_CANCELED",
                "INSPECTION",
                saved.getId(),
                previousStatus.name(),
                saved.getStatus().name(),
                "{\"status\":\"" + previousStatus.name() + "\"}",
                "{\"status\":\"CANCELADA\",\"canceledReason\":\"" + escapeJson(reason) + "\"}",
                "{\"canceledAt\":\"" + canceledAt + "\",\"canceledReason\":\"" + escapeJson(reason) + "\"}",
                "Inspeção cancelada administrativamente. Justificativa: " + reason
        );

        List<InspectionItemSnapshot> snapshots = snapshotRepository
                .findByInspectionIdOrderBySectionOrderAscItemOrderAsc(saved.getId());
        return InspectionDetailsResponse.fromEntity(saved, snapshots);
    }

    /**
     * Lista inspeções atribuídas a um técnico específico para sincronização offline (Passo 5, CA-03, RN-004).
     */
    @Transactional(readOnly = true)
    public List<InspectionDetailsResponse> listAssigned(
            UUID requestedTechnicianId,
            InspectionStatus status,
            boolean includeCanceled,
            AuthenticatedUser actor
    ) {
        UUID effectiveTechnicianId;
        if (actor != null && actor.getRole() == UserRole.TECHNICIAN) {
            if (requestedTechnicianId != null && !requestedTechnicianId.equals(actor.getId())) {
                throw new AccessDeniedException(
                        "Um técnico somente pode consultar as inspeções atribuídas ao próprio usuário."
                );
            }
            effectiveTechnicianId = actor.getId();
        } else {
            effectiveTechnicianId = requestedTechnicianId != null
                    ? requestedTechnicianId
                    : (actor != null ? actor.getId() : null);
        }

        if (effectiveTechnicianId == null) {
            return List.of();
        }

        List<Inspection> inspections;
        if (status != null) {
            inspections = inspectionRepository.findByTechnicianIdAndStatusOrderByScheduledForAsc(
                    effectiveTechnicianId,
                    status
            );
        } else {
            inspections = inspectionRepository.findByTechnicianIdOrderByScheduledForAsc(effectiveTechnicianId).stream()
                    .filter(inspection -> inspection.getStatus() != InspectionStatus.RASCUNHO)
                    .filter(inspection -> includeCanceled || inspection.getStatus() != InspectionStatus.CANCELADA)
                    .toList();
        }

        if (inspections.isEmpty()) {
            return List.of();
        }

        List<UUID> inspectionIds = inspections.stream().map(Inspection::getId).toList();
        List<InspectionItemSnapshot> allSnapshots = snapshotRepository
                .findByInspectionIdInOrderByInspectionIdAscSectionOrderAscItemOrderAsc(inspectionIds);

        Map<UUID, List<InspectionItemSnapshot>> groupedSnapshots = new HashMap<>();
        for (InspectionItemSnapshot snapshot : allSnapshots) {
            UUID inspId = snapshot.getInspection().getId();
            groupedSnapshots.computeIfAbsent(inspId, ignored -> new ArrayList<>()).add(snapshot);
        }

        return inspections.stream()
                .map(inspection -> InspectionDetailsResponse.fromEntity(
                        inspection,
                        groupedSnapshots.getOrDefault(inspection.getId(), List.of())
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<InspectionDetailsResponse> list(
            String search,
            InspectionStatus status,
            InspectionPriority priority,
            UUID clientId,
            UUID siteId,
            UUID equipmentId,
            UUID technicianId,
            UUID supervisorId,
            String scheduledFromRaw,
            String scheduledToRaw,
            Boolean overdue,
            Pageable pageable,
            AuthenticatedUser actor
    ) {
        UUID effectiveTechnicianId = technicianId;
        if (actor != null && actor.getRole() == UserRole.TECHNICIAN) {
            if (technicianId != null && !technicianId.equals(actor.getId())) {
                throw new AccessDeniedException(
                        "Um técnico somente pode consultar as inspeções atribuídas ao próprio usuário."
                );
            }
            effectiveTechnicianId = actor.getId();
        }

        Instant scheduledFrom = scheduledFromRaw != null && !scheduledFromRaw.isBlank()
                ? parseScheduledFor(scheduledFromRaw.trim(), "scheduledFrom", false)
                : null;
        Instant scheduledTo = scheduledToRaw != null && !scheduledToRaw.isBlank()
                ? parseScheduledFor(scheduledToRaw.trim(), "scheduledTo", true)
                : null;

        Pageable safePageable = sanitizePageable(pageable);
        Page<Inspection> page = inspectionRepository.findAll(
                InspectionSpecifications.filterInspections(
                        search,
                        status,
                        priority,
                        clientId,
                        siteId,
                        equipmentId,
                        effectiveTechnicianId,
                        supervisorId,
                        scheduledFrom,
                        scheduledTo,
                        overdue,
                        Instant.now()
                ),
                safePageable
        );

        Map<UUID, Integer> snapshotCounts = new HashMap<>();
        List<UUID> ids = page.getContent().stream().map(Inspection::getId).toList();
        if (!ids.isEmpty()) {
            for (Object[] row : snapshotRepository.countByInspectionIds(ids)) {
                UUID inspId = (UUID) row[0];
                Long count = (Long) row[1];
                snapshotCounts.put(inspId, count != null ? count.intValue() : 0);
            }
        }

        Page<InspectionDetailsResponse> mapped = page.map(inspection ->
                InspectionDetailsResponse.summaryFromEntity(
                        inspection,
                        snapshotCounts.getOrDefault(inspection.getId(), 0)
                )
        );
        return PageResponse.from(mapped);
    }

    @Transactional(readOnly = true)
    public InspectionDetailsResponse getById(UUID id, AuthenticatedUser actor) {
        Inspection inspection = findDetailedAndAuthorize(id, actor);
        List<InspectionItemSnapshot> snapshots = snapshotRepository
                .findByInspectionIdOrderBySectionOrderAscItemOrderAsc(inspection.getId());
        return InspectionDetailsResponse.fromEntity(inspection, snapshots);
    }

    @Transactional(readOnly = true)
    public List<InspectionItemSnapshotResponse> getSnapshots(UUID id, AuthenticatedUser actor) {
        Inspection inspection = findDetailedAndAuthorize(id, actor);
        return snapshotRepository.findByInspectionIdOrderBySectionOrderAscItemOrderAsc(inspection.getId()).stream()
                .map(InspectionItemSnapshotResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> getAuditLogs(UUID id) {
        if (!inspectionRepository.existsById(id)) {
            throw ResourceNotFoundException.of("Inspeção", id);
        }
        return auditLogRepository.findByInspectionIdOrderByOccurredAtAsc(id).stream()
                .map(AuditLogResponse::fromEntity)
                .toList();
    }

    private Inspection findDetailedAndAuthorize(UUID id, AuthenticatedUser actor) {
        Inspection inspection = inspectionRepository.findDetailedById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", id));
        if (actor != null && actor.getRole() == UserRole.TECHNICIAN
                && !inspection.getTechnician().getId().equals(actor.getId())) {
            throw new AccessDeniedException(
                    "Você não possui permissão para acessar inspeções atribuídas a outro técnico."
            );
        }
        return inspection;
    }

    private User resolveSupervisor(UUID requestedSupervisorId, AuthenticatedUser actor) {
        if (requestedSupervisorId != null) {
            User supervisor = userRepository.findById(requestedSupervisorId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Supervisor", requestedSupervisorId));
            if (supervisor.getRole() != UserRole.SUPERVISOR && supervisor.getRole() != UserRole.ADMIN) {
                throw new InspectionSchedulingValidationException(
                        "INVALID_SUPERVISOR_ROLE",
                        "O usuário selecionado como supervisor não possui perfil SUPERVISOR ou ADMIN."
                );
            }
            if (!supervisor.isActive()) {
                throw new InspectionSchedulingValidationException(
                        "INACTIVE_SUPERVISOR",
                        "O supervisor selecionado está inativo ou bloqueado."
                );
            }
            return supervisor;
        }
        if (actor != null) {
            return userRepository.findById(actor.getId())
                    .filter(user -> user.getRole() == UserRole.SUPERVISOR || user.getRole() == UserRole.ADMIN)
                    .orElse(null);
        }
        return null;
    }

    private TemplateVersion resolvePublishedTemplateVersion(ScheduleInspectionRequest request) {
        TemplateVersion version;
        if (request.templateVersionId() != null) {
            version = templateVersionRepository.findById(request.templateVersionId())
                    .orElseThrow(() -> ResourceNotFoundException.of(
                            "Versão de modelo de inspeção",
                            request.templateVersionId()
                    ));
            if (request.templateId() != null && !version.getTemplate().getId().equals(request.templateId())) {
                throw new BusinessRuleException(
                        "TEMPLATE_VERSION_MISMATCH",
                        "A versão de modelo informada não pertence ao modelo especificado."
                );
            }
        } else {
            InspectionTemplate template = templateRepository.findById(request.templateId())
                    .orElseThrow(() -> ResourceNotFoundException.of("Modelo de inspeção", request.templateId()));

            if (request.templateVersionNumber() != null) {
                version = templateVersionRepository
                        .findByTemplateIdAndVersionNumber(template.getId(), request.templateVersionNumber())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "TEMPLATE_VERSION_NOT_FOUND",
                                "Versão " + request.templateVersionNumber()
                                        + " não encontrada para o modelo " + template.getId() + "."
                        ));
            } else {
                version = template.getVersions().stream()
                        .filter(v -> v.isPublished() && v.isActiveForNewInspections())
                        .findFirst()
                        .orElseGet(() -> templateVersionRepository
                                .findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(
                                        template.getId(),
                                        TemplateVersionStatus.PUBLISHED
                                )
                                .orElseThrow(() -> new BusinessRuleException(
                                        "TEMPLATE_VERSION_NOT_PUBLISHED",
                                        "O modelo selecionado não possui versão publicada disponível para agendamento."
                                )));
            }
        }

        if (!version.isPublished()) {
            throw new BusinessRuleException(
                    "TEMPLATE_VERSION_NOT_PUBLISHED",
                    "Toda inspeção deve estar vinculada a uma versão publicada de modelo (status atual: "
                            + version.getStatus() + ")."
            );
        }

        InspectionTemplate template = version.getTemplate();
        if (!template.isActive() || template.getStatus() == TemplateStatus.INACTIVE) {
            throw new BusinessRuleException(
                    "INACTIVE_TEMPLATE",
                    "O modelo de inspeção selecionado está inativo e não pode ser utilizado em novos agendamentos."
            );
        }

        return version;
    }

    private void recordAuditEvent(
            UUID inspectionId,
            AuthenticatedUser actor,
            String action,
            String entityType,
            UUID entityId,
            String previousStatus,
            String newStatus,
            String previousValueJson,
            String newValueJson,
            String metadataJson,
            String details
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setId(UUID.randomUUID());
        auditLog.setInspectionId(inspectionId);
        auditLog.setActorId(actor != null ? actor.getId() : null);
        auditLog.setActorEmail(actor != null ? actor.getEmail() : null);
        auditLog.setAction(action);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setPreviousStatus(previousStatus);
        auditLog.setNewStatus(newStatus);
        auditLog.setPreviousValueJson(previousValueJson);
        auditLog.setNewValueJson(newValueJson);
        auditLog.setMetadataJson(metadataJson);
        auditLog.setDetails(details);
        auditLog.setOccurredAt(Instant.now());
        auditLogRepository.save(auditLog);
    }

    private String buildSchedulingSummaryJson(Inspection inspection) {
        return "{"
                + "\"status\":\"" + inspection.getStatus().name() + "\","
                + "\"templateVersionId\":\"" + inspection.getTemplateVersion().getId() + "\","
                + "\"templateVersionNumber\":" + inspection.getTemplateVersionNumber() + ","
                + "\"clientId\":\"" + inspection.getClient().getId() + "\","
                + "\"siteId\":\"" + inspection.getSite().getId() + "\","
                + "\"equipmentId\":" + (inspection.getEquipment() != null
                    ? "\"" + inspection.getEquipment().getId() + "\""
                    : "null") + ","
                + "\"technicianId\":\"" + inspection.getTechnician().getId() + "\","
                + "\"scheduledFor\":\"" + inspection.getScheduledFor() + "\""
                + "}";
    }

    private String buildSnapshotMetadataJson(Inspection inspection, int snapshotCount) {
        return "{"
                + "\"templateId\":\"" + inspection.getTemplate().getId() + "\","
                + "\"templateVersionId\":\"" + inspection.getTemplateVersion().getId() + "\","
                + "\"templateVersionNumber\":" + inspection.getTemplateVersionNumber() + ","
                + "\"snapshotItemsCount\":" + snapshotCount
                + "}";
    }

    private String resolveInspectionTitle(
            String customTitle,
            String templateTitle,
            Equipment equipment,
            Site site
    ) {
        String trimmed = trimToNull(customTitle);
        if (trimmed != null) {
            return trimmed;
        }
        String target = equipment != null ? equipment.getName() : site.getName();
        String combined = templateTitle + " - " + target;
        return combined.length() > 250 ? combined.substring(0, 250) : combined;
    }

    private Instant parseScheduledFor(String raw, String fieldLabel, boolean endOfDayIfDateOnly) {
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return OffsetDateTime.parse(raw).toInstant();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDateTime.parse(raw).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
        }
        try {
            LocalDate date = LocalDate.parse(raw);
            return endOfDayIfDateOnly
                    ? date.plusDays(1).atStartOfDay(ZoneOffset.UTC).minusNanos(1).toInstant()
                    : date.atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (DateTimeParseException ignored) {
        }
        throw new InspectionSchedulingValidationException(
                "INVALID_DATE_FORMAT",
                "Formato de data inválido para '" + fieldLabel
                        + "'. Utilize ISO-8601 (ex.: 2026-11-20T14:00:00Z ou 2026-11-20)."
        );
    }

    private Pageable sanitizePageable(Pageable pageable) {
        if (pageable == null || pageable.isUnpaged()) {
            return PageRequest.of(0, 20, DEFAULT_SORT);
        }
        int page = Math.max(0, pageable.getPageNumber());
        int size = Math.min(Math.max(1, pageable.getPageSize()), MAX_PAGE_SIZE);

        Sort sort = pageable.getSort();
        if (sort.isUnsorted()) {
            return PageRequest.of(page, size, DEFAULT_SORT);
        }

        for (Sort.Order order : sort) {
            if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
                throw new BusinessRuleException(
                        "INVALID_SORT_FIELD",
                        "Campo de ordenação inválido: '" + order.getProperty() + "'."
                );
            }
        }
        return PageRequest.of(page, size, sort);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
