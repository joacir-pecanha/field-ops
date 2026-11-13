package com.fieldops.modules.template.service;

import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.exception.DuplicateResourceException;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.ResponseType;
import com.fieldops.modules.template.domain.TemplateItem;
import com.fieldops.modules.template.domain.TemplateJsonSupport;
import com.fieldops.modules.template.domain.TemplateSection;
import com.fieldops.modules.template.domain.TemplateStatus;
import com.fieldops.modules.template.domain.TemplateVersion;
import com.fieldops.modules.template.domain.TemplateVersionStatus;
import com.fieldops.modules.template.dto.TemplateItemRequest;
import com.fieldops.modules.template.dto.TemplateRequest;
import com.fieldops.modules.template.dto.TemplateResponse;
import com.fieldops.modules.template.dto.TemplateSectionRequest;
import com.fieldops.modules.template.dto.TemplateVersionResponse;
import com.fieldops.modules.template.exception.TemplatePublishValidationException;
import com.fieldops.modules.template.repository.InspectionTemplateRepository;
import com.fieldops.modules.template.repository.TemplateSpecifications;
import com.fieldops.modules.template.repository.TemplateVersionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Serviço de domínio para criação, edição em rascunho, publicação imutável e versionamento
 * de Modelos de Inspeção (RN-015..RN-023, AC-TEMPLATE).
 */
@Service
public class TemplateService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "title", "code", "category", "status", "active", "version", "currentVersion", "createdAt", "updatedAt"
    );
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "title");

    private final InspectionTemplateRepository templateRepository;
    private final TemplateVersionRepository templateVersionRepository;

    public TemplateService(
            InspectionTemplateRepository templateRepository,
            TemplateVersionRepository templateVersionRepository
    ) {
        this.templateRepository = templateRepository;
        this.templateVersionRepository = templateVersionRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<TemplateResponse> list(
            String search,
            String category,
            TemplateStatus status,
            Boolean active,
            Pageable pageable
    ) {
        Pageable safePageable = sanitizePageable(pageable);
        Page<TemplateResponse> page = templateRepository
                .findAll(TemplateSpecifications.filterTemplates(search, category, status, active), safePageable)
                .map(template -> {
                    TemplateVersion workingVersion = resolveWorkingVersion(template);
                    return TemplateResponse.summaryFromEntity(template, workingVersion);
                });
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public TemplateResponse getById(UUID id) {
        InspectionTemplate template = findTemplateById(id);
        TemplateVersion workingVersion = resolveWorkingVersion(template);
        return TemplateResponse.fromEntity(template, workingVersion);
    }

    @Transactional
    public TemplateResponse createDraft(TemplateRequest request, UUID actorUserId) {
        String code = trimToNull(request.code());
        if (code != null && templateRepository.existsByCodeIgnoreCase(code)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_TEMPLATE_CODE",
                    "Já existe um modelo de inspeção cadastrado com o código informado."
            );
        }

        InspectionTemplate template = new InspectionTemplate();
        template.setId(UUID.randomUUID());
        template.setCode(code);
        template.setTitle(request.title().trim());
        template.setDescription(trimToNull(request.description()));
        template.setCategory(request.category().trim());
        template.setStatus(TemplateStatus.DRAFT);
        template.setActive(true);
        template.setVersion(0);
        template.setCurrentVersion(0);
        template.setCreatedBy(actorUserId);

        TemplateVersion initialDraft = new TemplateVersion();
        initialDraft.setId(UUID.randomUUID());
        initialDraft.setVersionNumber(1);
        initialDraft.setStatus(TemplateVersionStatus.DRAFT);
        initialDraft.setTitleSnapshot(template.getTitle());
        initialDraft.setDescriptionSnapshot(template.getDescription());
        initialDraft.setCategorySnapshot(template.getCategory());
        initialDraft.setActiveForNewInspections(false);
        initialDraft.clearAndSetSections(buildSections(request.sections()));

        template.addVersion(initialDraft);

        InspectionTemplate saved = templateRepository.saveAndFlush(template);
        TemplateVersion savedVersion = resolveWorkingVersion(saved);
        return TemplateResponse.fromEntity(saved, savedVersion);
    }

    @Transactional
    public TemplateResponse updateDraft(UUID id, TemplateRequest request) {
        InspectionTemplate template = findTemplateById(id);
        if (template.getStatus() == TemplateStatus.PUBLISHED) {
            throw immutablePublishedVersionException();
        }
        if (template.getStatus() == TemplateStatus.INACTIVE) {
            throw new BusinessRuleException(
                    "INACTIVE_TEMPLATE",
                    "O modelo informado está inativo. Reative o modelo antes de editar."
            );
        }

        TemplateVersion draftVersion = templateVersionRepository
                .findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(id, TemplateVersionStatus.DRAFT)
                .orElseThrow(this::immutablePublishedVersionException);

        applyUpdateToTemplateAndDraft(template, draftVersion, request);

        InspectionTemplate saved = templateRepository.saveAndFlush(template);
        TemplateVersion savedVersion = resolveWorkingVersion(saved);
        return TemplateResponse.fromEntity(saved, savedVersion);
    }

    @Transactional
    public TemplateVersionResponse updateVersion(UUID templateId, Integer versionNumber, TemplateRequest request) {
        InspectionTemplate template = findTemplateById(templateId);
        TemplateVersion targetVersion = templateVersionRepository
                .findByTemplateIdAndVersionNumber(templateId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TEMPLATE_VERSION_NOT_FOUND",
                        "Versão " + versionNumber + " não encontrada para o modelo " + templateId + "."
                ));

        if (targetVersion.isPublished()) {
            throw immutablePublishedVersionException();
        }
        if (template.getStatus() == TemplateStatus.INACTIVE) {
            throw new BusinessRuleException(
                    "INACTIVE_TEMPLATE",
                    "O modelo informado está inativo. Reative o modelo antes de editar."
            );
        }

        applyUpdateToTemplateAndDraft(template, targetVersion, request);
        templateRepository.saveAndFlush(template);

        TemplateVersion reloaded = templateVersionRepository
                .findByTemplateIdAndVersionNumber(templateId, versionNumber)
                .orElse(targetVersion);
        return TemplateVersionResponse.fromEntity(reloaded);
    }

    /**
     * Publica atomicamente a versão em rascunho atual do modelo, congelando suas seções e itens (RT-03).
     */
    @Transactional
    public TemplateVersionResponse publish(UUID id, UUID actorUserId) {
        InspectionTemplate template = findTemplateById(id);
        if (template.getStatus() == TemplateStatus.INACTIVE) {
            throw new BusinessRuleException(
                    "INACTIVE_TEMPLATE",
                    "Não é possível publicar um modelo inativo. Reative o modelo antes de publicar."
            );
        }

        TemplateVersion draftVersion = templateVersionRepository
                .findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(id, TemplateVersionStatus.DRAFT)
                .orElseThrow(() -> new BusinessRuleException(
                        "ALREADY_PUBLISHED",
                        "Não há versão em rascunho pendente para publicação. Crie uma nova versão para publicar alterações."
                ));

        List<String> pendencies = validateForPublish(template, draftVersion);
        if (!pendencies.isEmpty()) {
            throw new TemplatePublishValidationException(
                    "TEMPLATE_PUBLISH_PENDING",
                    "Publicação bloqueada: o modelo possui pendências de validação.",
                    pendencies
            );
        }

        for (TemplateVersion existingVersion : template.getVersions()) {
            if (existingVersion.isActiveForNewInspections()) {
                existingVersion.setActiveForNewInspections(false);
            }
        }

        int currentVersion = template.getCurrentVersion() != null ? template.getCurrentVersion() : 0;
        int publishedVersionNumber = Math.max(currentVersion + 1, draftVersion.getVersionNumber());

        draftVersion.setVersionNumber(publishedVersionNumber);
        draftVersion.setStatus(TemplateVersionStatus.PUBLISHED);
        draftVersion.setTitleSnapshot(template.getTitle());
        draftVersion.setDescriptionSnapshot(template.getDescription());
        draftVersion.setCategorySnapshot(template.getCategory());
        draftVersion.setPublishedBy(actorUserId);
        draftVersion.setPublishedAt(Instant.now());
        draftVersion.setActiveForNewInspections(true);

        template.setStatus(TemplateStatus.PUBLISHED);
        template.setVersion(publishedVersionNumber);
        template.setCurrentVersion(publishedVersionNumber);

        templateRepository.saveAndFlush(template);
        return TemplateVersionResponse.fromEntity(draftVersion);
    }

    /**
     * Inicia uma nova versão editável (version = N + 1) preservando intactas todas as versões publicadas anteriores.
     */
    @Transactional
    public TemplateVersionResponse createNewVersion(UUID id, TemplateRequest optionalRequest) {
        InspectionTemplate template = findTemplateById(id);
        if (template.getStatus() == TemplateStatus.INACTIVE) {
            throw new BusinessRuleException(
                    "INACTIVE_TEMPLATE",
                    "Não é possível criar nova versão de um modelo inativo. Reative o modelo primeiro."
            );
        }

        templateVersionRepository
                .findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(id, TemplateVersionStatus.DRAFT)
                .ifPresent(existingDraft -> {
                    throw new BusinessRuleException(
                            "DRAFT_VERSION_ALREADY_EXISTS",
                            "Já existe uma versão em rascunho aberta (versão "
                                    + existingDraft.getVersionNumber()
                                    + "). Edite ou publique o rascunho atual antes de iniciar outra versão."
                    );
                });

        TemplateVersion baseVersion = templateVersionRepository
                .findFirstByTemplateIdOrderByVersionNumberDesc(id)
                .orElseThrow(() -> new BusinessRuleException(
                        "NO_BASE_VERSION_FOUND",
                        "Nenhuma versão base encontrada para criação da nova versão."
                ));

        int nextVersionNumber = baseVersion.getVersionNumber() + 1;

        if (optionalRequest != null) {
            String code = trimToNull(optionalRequest.code());
            if (code != null && templateRepository.existsByCodeIgnoreCaseAndIdNot(code, template.getId())) {
                throw new DuplicateResourceException(
                        "DUPLICATE_TEMPLATE_CODE",
                        "Já existe outro modelo de inspeção cadastrado com o código informado."
                );
            }
            if (code != null) {
                template.setCode(code);
            }
            template.setTitle(optionalRequest.title().trim());
            template.setDescription(trimToNull(optionalRequest.description()));
            template.setCategory(optionalRequest.category().trim());
        }

        TemplateVersion newVersion = new TemplateVersion();
        newVersion.setId(UUID.randomUUID());
        newVersion.setVersionNumber(nextVersionNumber);
        newVersion.setStatus(TemplateVersionStatus.DRAFT);
        newVersion.setTitleSnapshot(template.getTitle());
        newVersion.setDescriptionSnapshot(template.getDescription());
        newVersion.setCategorySnapshot(template.getCategory());
        newVersion.setActiveForNewInspections(false);

        if (optionalRequest != null) {
            newVersion.clearAndSetSections(buildSections(optionalRequest.sections()));
        } else {
            newVersion.clearAndSetSections(cloneSections(baseVersion.getSections()));
        }

        template.setStatus(TemplateStatus.DRAFT);
        template.setVersion(nextVersionNumber);
        template.addVersion(newVersion);

        templateRepository.saveAndFlush(template);
        return TemplateVersionResponse.fromEntity(newVersion);
    }

    @Transactional(readOnly = true)
    public List<TemplateVersionResponse> listVersions(UUID templateId) {
        findTemplateById(templateId);
        return templateVersionRepository.findByTemplateIdOrderByVersionNumberAsc(templateId).stream()
                .map(TemplateVersionResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public TemplateVersionResponse getVersion(UUID templateId, Integer versionNumber) {
        findTemplateById(templateId);
        TemplateVersion version = templateVersionRepository
                .findByTemplateIdAndVersionNumber(templateId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TEMPLATE_VERSION_NOT_FOUND",
                        "Versão " + versionNumber + " não encontrada para o modelo " + templateId + "."
                ));
        return TemplateVersionResponse.fromEntity(version);
    }

    @Transactional
    public TemplateResponse deactivate(UUID id) {
        InspectionTemplate template = findTemplateById(id);
        template.deactivate();
        InspectionTemplate saved = templateRepository.saveAndFlush(template);
        return TemplateResponse.fromEntity(saved, resolveWorkingVersion(saved));
    }

    @Transactional
    public TemplateResponse activate(UUID id) {
        InspectionTemplate template = findTemplateById(id);
        boolean hasOpenDraft = templateVersionRepository
                .findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(id, TemplateVersionStatus.DRAFT)
                .isPresent();
        template.setActive(true);
        template.setStatus(hasOpenDraft ? TemplateStatus.DRAFT : TemplateStatus.PUBLISHED);
        InspectionTemplate saved = templateRepository.saveAndFlush(template);
        return TemplateResponse.fromEntity(saved, resolveWorkingVersion(saved));
    }

    private void applyUpdateToTemplateAndDraft(
            InspectionTemplate template,
            TemplateVersion draftVersion,
            TemplateRequest request
    ) {
        String code = trimToNull(request.code());
        if (code != null && templateRepository.existsByCodeIgnoreCaseAndIdNot(code, template.getId())) {
            throw new DuplicateResourceException(
                    "DUPLICATE_TEMPLATE_CODE",
                    "Já existe outro modelo de inspeção cadastrado com o código informado."
            );
        }

        template.setCode(code);
        template.setTitle(request.title().trim());
        template.setDescription(trimToNull(request.description()));
        template.setCategory(request.category().trim());

        draftVersion.setTitleSnapshot(template.getTitle());
        draftVersion.setDescriptionSnapshot(template.getDescription());
        draftVersion.setCategorySnapshot(template.getCategory());
        draftVersion.clearAndSetSections(buildSections(request.sections()));
    }

    private List<String> validateForPublish(InspectionTemplate template, TemplateVersion draftVersion) {
        List<String> pendencies = new ArrayList<>();

        if (template.getTitle() == null || template.getTitle().isBlank()) {
            pendencies.add("O modelo deve possuir um título válido antes da publicação.");
        }
        if (template.getCategory() == null || template.getCategory().isBlank()) {
            pendencies.add("O modelo deve possuir uma categoria válida antes da publicação.");
        }

        List<TemplateSection> sections = draftVersion.getSections();
        if (sections == null || sections.isEmpty()) {
            pendencies.add("O modelo deve possuir ao menos uma seção com um item válido antes da publicação.");
            return pendencies;
        }

        int totalItems = 0;
        for (int sIdx = 0; sIdx < sections.size(); sIdx++) {
            TemplateSection section = sections.get(sIdx);
            String sectionLabel = (section.getTitle() != null && !section.getTitle().isBlank())
                    ? section.getTitle()
                    : "Seção #" + (sIdx + 1);

            if (section.getTitle() == null || section.getTitle().isBlank()) {
                pendencies.add("A seção #" + (sIdx + 1) + " deve possuir um título.");
            }

            List<TemplateItem> items = section.getItems();
            if (items == null || items.isEmpty()) {
                pendencies.add("A seção '" + sectionLabel + "' não possui itens cadastrados.");
                continue;
            }

            for (int iIdx = 0; iIdx < items.size(); iIdx++) {
                TemplateItem item = items.get(iIdx);
                totalItems++;
                String itemLabel = (item.getTitle() != null && !item.getTitle().isBlank())
                        ? item.getTitle()
                        : "Item #" + (iIdx + 1);

                if (item.getTitle() == null || item.getTitle().isBlank()) {
                    pendencies.add("O item #" + (iIdx + 1) + " da seção '" + sectionLabel + "' deve possuir título.");
                }
                if (item.getResponseType() == null) {
                    pendencies.add("O item '" + itemLabel + "' da seção '" + sectionLabel + "' não possui tipo de resposta definido.");
                } else if (item.getResponseType() == ResponseType.SINGLE_CHOICE) {
                    List<String> opts = item.getOptions();
                    boolean hasValidOption = opts != null && opts.stream().anyMatch(opt -> opt != null && !opt.isBlank());
                    if (!hasValidOption) {
                        pendencies.add("O item '" + itemLabel + "' (SINGLE_CHOICE) da seção '" + sectionLabel + "' deve possuir ao menos uma opção.");
                    }
                }
            }
        }

        if (totalItems == 0) {
            pendencies.add("O modelo deve possuir ao menos um item válido antes da publicação.");
        }

        return pendencies;
    }

    private List<TemplateSection> buildSections(List<TemplateSectionRequest> sectionRequests) {
        if (sectionRequests == null || sectionRequests.isEmpty()) {
            return List.of();
        }

        record IndexedSection(int originalIndex, int effectiveOrder, TemplateSectionRequest request) {
        }

        List<IndexedSection> indexed = new ArrayList<>(sectionRequests.size());
        for (int i = 0; i < sectionRequests.size(); i++) {
            TemplateSectionRequest req = sectionRequests.get(i);
            int order = resolveOrderIndex(req.orderIndex(), i);
            indexed.add(new IndexedSection(i, order, req));
        }

        indexed.sort(Comparator
                .comparingInt(IndexedSection::effectiveOrder)
                .thenComparingInt(IndexedSection::originalIndex));

        List<TemplateSection> sections = new ArrayList<>(indexed.size());
        for (IndexedSection entry : indexed) {
            TemplateSectionRequest req = entry.request();
            TemplateSection section = new TemplateSection();
            section.setId(UUID.randomUUID());
            section.setTitle(req.title().trim());
            section.setDescription(trimToNull(req.description()));
            section.setOrderIndex(entry.effectiveOrder());
            section.clearAndSetItems(buildItems(req.items()));
            sections.add(section);
        }
        return sections;
    }

    private List<TemplateItem> buildItems(List<TemplateItemRequest> itemRequests) {
        if (itemRequests == null || itemRequests.isEmpty()) {
            return List.of();
        }

        record IndexedItem(int originalIndex, int effectiveOrder, TemplateItemRequest request) {
        }

        List<IndexedItem> indexed = new ArrayList<>(itemRequests.size());
        for (int i = 0; i < itemRequests.size(); i++) {
            TemplateItemRequest req = itemRequests.get(i);
            int order = resolveOrderIndex(req.orderIndex(), i);
            indexed.add(new IndexedItem(i, order, req));
        }

        indexed.sort(Comparator
                .comparingInt(IndexedItem::effectiveOrder)
                .thenComparingInt(IndexedItem::originalIndex));

        List<TemplateItem> items = new ArrayList<>(indexed.size());
        for (IndexedItem entry : indexed) {
            TemplateItemRequest req = entry.request();
            TemplateItem item = new TemplateItem();
            item.setId(UUID.randomUUID());
            item.setCode(trimToNull(req.code()));
            item.setTitle(req.title().trim());
            item.setDescription(trimToNull(req.description()));
            item.setResponseType(req.responseType());
            item.setRequired(req.required() == null || req.required());
            item.setObservationRequiredOnFailure(Boolean.TRUE.equals(req.observationRequiredOnFailure()));
            item.setEvidenceRequiredOnFailure(Boolean.TRUE.equals(req.evidenceRequiredOnFailure()));
            item.setOptions(resolveItemOptions(req));
            item.setOrderIndex(entry.effectiveOrder());
            items.add(item);
        }
        return items;
    }

    private List<TemplateSection> cloneSections(List<TemplateSection> sourceSections) {
        if (sourceSections == null || sourceSections.isEmpty()) {
            return List.of();
        }
        List<TemplateSection> clonedSections = new ArrayList<>(sourceSections.size());
        for (TemplateSection srcSection : sourceSections) {
            TemplateSection clonedSection = new TemplateSection();
            clonedSection.setId(UUID.randomUUID());
            clonedSection.setTitle(srcSection.getTitle());
            clonedSection.setDescription(srcSection.getDescription());
            clonedSection.setOrderIndex(srcSection.getOrderIndex());

            List<TemplateItem> clonedItems = new ArrayList<>(srcSection.getItems().size());
            for (TemplateItem srcItem : srcSection.getItems()) {
                TemplateItem clonedItem = new TemplateItem();
                clonedItem.setId(UUID.randomUUID());
                clonedItem.setCode(srcItem.getCode());
                clonedItem.setTitle(srcItem.getTitle());
                clonedItem.setDescription(srcItem.getDescription());
                clonedItem.setResponseType(srcItem.getResponseType());
                clonedItem.setRequired(srcItem.isRequired());
                clonedItem.setObservationRequiredOnFailure(srcItem.isObservationRequiredOnFailure());
                clonedItem.setEvidenceRequiredOnFailure(srcItem.isEvidenceRequiredOnFailure());
                clonedItem.setOptions(srcItem.getOptions() != null ? new ArrayList<>(srcItem.getOptions()) : null);
                clonedItem.setOrderIndex(srcItem.getOrderIndex());
                clonedItems.add(clonedItem);
            }

            clonedSection.clearAndSetItems(clonedItems);
            clonedSections.add(clonedSection);
        }
        return clonedSections;
    }

    private List<String> resolveItemOptions(TemplateItemRequest request) {
        List<String> rawOptions = null;
        if (request.options() != null && !request.options().isEmpty()) {
            rawOptions = request.options();
        } else if (request.optionsJson() != null && !request.optionsJson().isBlank()) {
            try {
                rawOptions = TemplateJsonSupport.parseJsonStringArray(request.optionsJson());
            } catch (IllegalArgumentException ex) {
                throw new BusinessRuleException("INVALID_ITEM_OPTIONS", ex.getMessage());
            }
        }

        if (rawOptions == null) {
            return null;
        }

        List<String> sanitized = rawOptions.stream()
                .filter(opt -> opt != null && !opt.isBlank())
                .map(String::trim)
                .toList();
        return sanitized.isEmpty() ? null : new ArrayList<>(sanitized);
    }

    private int resolveOrderIndex(Integer providedOrder, int fallbackIndex) {
        if (providedOrder == null) {
            return fallbackIndex;
        }
        if (providedOrder < 0) {
            throw new BusinessRuleException(
                    "INVALID_ORDER_INDEX",
                    "O índice de ordenação (orderIndex) não pode ser negativo."
            );
        }
        return providedOrder;
    }

    private TemplateVersion resolveWorkingVersion(InspectionTemplate template) {
        if (template.getStatus() == TemplateStatus.DRAFT) {
            return templateVersionRepository
                    .findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(template.getId(), TemplateVersionStatus.DRAFT)
                    .orElseGet(() -> templateVersionRepository
                            .findFirstByTemplateIdOrderByVersionNumberDesc(template.getId())
                            .orElse(null));
        }
        return templateVersionRepository
                .findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(template.getId(), TemplateVersionStatus.PUBLISHED)
                .orElseGet(() -> templateVersionRepository
                        .findFirstByTemplateIdOrderByVersionNumberDesc(template.getId())
                        .orElse(null));
    }

    private InspectionTemplate findTemplateById(UUID id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Modelo de inspeção", id));
    }

    private BusinessRuleException immutablePublishedVersionException() {
        return new BusinessRuleException(
                "PUBLISHED_VERSION_IMMUTABLE",
                "Não é permitido alterar itens de uma versão já publicada (status = PUBLISHED). "
                        + "Crie uma nova versão via POST /api/v1/inspection-templates/{id}/versions para realizar alterações."
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
}

