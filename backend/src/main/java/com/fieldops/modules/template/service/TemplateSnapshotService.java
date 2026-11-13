package com.fieldops.modules.template.service;

import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.TemplateItem;
import com.fieldops.modules.template.domain.TemplateJsonSupport;
import com.fieldops.modules.template.domain.TemplateSection;
import com.fieldops.modules.template.domain.TemplateVersion;
import com.fieldops.modules.template.domain.TemplateVersionStatus;
import com.fieldops.modules.template.dto.TemplateItemSnapshotDto;
import com.fieldops.modules.template.dto.TemplateSnapshotResponse;
import com.fieldops.modules.template.repository.InspectionTemplateRepository;
import com.fieldops.modules.template.repository.TemplateVersionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Serviço gerador de Snapshot desnormalizado de itens a partir de versões publicadas (Passo 5, RN-021).
 * Consumido pelo endpoint de consulta de snapshot e pelo futuro módulo de agendamento (TASK-011).
 */
@Service
public class TemplateSnapshotService {

    private final InspectionTemplateRepository templateRepository;
    private final TemplateVersionRepository templateVersionRepository;

    public TemplateSnapshotService(
            InspectionTemplateRepository templateRepository,
            TemplateVersionRepository templateVersionRepository
    ) {
        this.templateRepository = templateRepository;
        this.templateVersionRepository = templateVersionRepository;
    }

    @Transactional(readOnly = true)
    public TemplateSnapshotResponse generateSnapshotForTemplate(UUID templateId) {
        InspectionTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> ResourceNotFoundException.of("Modelo de inspeção", templateId));

        TemplateVersion activePublished = template.getVersions().stream()
                .filter(v -> v.isPublished() && v.isActiveForNewInspections())
                .findFirst()
                .orElseGet(() -> templateVersionRepository
                        .findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(
                                templateId, TemplateVersionStatus.PUBLISHED)
                        .orElseThrow(this::unpublishedVersionException));

        return buildSnapshotResponse(template, activePublished);
    }

    @Transactional(readOnly = true)
    public TemplateSnapshotResponse generateSnapshotForVersion(UUID templateId, Integer versionNumber) {
        InspectionTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> ResourceNotFoundException.of("Modelo de inspeção", templateId));

        TemplateVersion version = templateVersionRepository
                .findByTemplateIdAndVersionNumber(templateId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TEMPLATE_VERSION_NOT_FOUND",
                        "Versão " + versionNumber + " não encontrada para o modelo " + templateId + "."
                ));

        if (!version.isPublished()) {
            throw unpublishedVersionException();
        }
        return buildSnapshotResponse(template, version);
    }

    @Transactional(readOnly = true)
    public TemplateSnapshotResponse generateSnapshotByVersionId(UUID templateVersionId) {
        TemplateVersion version = templateVersionRepository.findById(templateVersionId)
                .orElseThrow(() -> ResourceNotFoundException.of("Versão de modelo de inspeção", templateVersionId));

        if (!version.isPublished()) {
            throw unpublishedVersionException();
        }
        return buildSnapshotResponse(version.getTemplate(), version);
    }

    private TemplateSnapshotResponse buildSnapshotResponse(
            InspectionTemplate template,
            TemplateVersion version
    ) {
        List<TemplateSection> orderedSections = version.getSections().stream()
                .sorted(Comparator.comparing(TemplateSection::getOrderIndex))
                .toList();

        Instant snapshotCreatedAt = Instant.now();
        List<TemplateItemSnapshotDto> items = new ArrayList<>();

        for (TemplateSection section : orderedSections) {
            List<TemplateItem> orderedItems = section.getItems().stream()
                    .sorted(Comparator.comparing(TemplateItem::getOrderIndex))
                    .toList();

            for (TemplateItem item : orderedItems) {
                List<String> safeOptions = item.getOptions() != null
                        ? List.copyOf(item.getOptions())
                        : List.of();
                items.add(new TemplateItemSnapshotDto(
                        template.getId(),
                        version.getId(),
                        version.getVersionNumber(),
                        item.getId(),
                        section.getTitle(),
                        section.getDescription(),
                        section.getOrderIndex(),
                        item.getCode(),
                        item.getTitle(),
                        item.getDescription(),
                        item.getResponseType(),
                        item.isRequired(),
                        item.isObservationRequiredOnFailure(),
                        item.isEvidenceRequiredOnFailure(),
                        TemplateJsonSupport.buildRulesJson(
                                item.isObservationRequiredOnFailure(),
                                item.isEvidenceRequiredOnFailure()
                        ),
                        safeOptions,
                        item.getOptionsJson(),
                        item.getOrderIndex(),
                        snapshotCreatedAt
                ));
            }
        }

        return new TemplateSnapshotResponse(
                template.getId(),
                template.getCode(),
                version.getId(),
                version.getVersionNumber(),
                version.getVersionNumber(),
                version.getTitleSnapshot(),
                version.getDescriptionSnapshot(),
                version.getCategorySnapshot(),
                version.getPublishedAt(),
                orderedSections.size(),
                items.size(),
                items
        );
    }

    private BusinessRuleException unpublishedVersionException() {
        return new BusinessRuleException(
                "TEMPLATE_VERSION_NOT_PUBLISHED",
                "Somente versões publicadas podem gerar snapshot de checklist."
        );
    }
}

