package com.fieldops.modules.inspection.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.inspection.domain.InspectionPriority;
import com.fieldops.modules.inspection.domain.InspectionReview;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.master.domain.Client;
import com.fieldops.modules.master.domain.Equipment;
import com.fieldops.modules.master.domain.Site;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.sync.domain.EvidenceFile;
import com.fieldops.modules.sync.domain.EvidenceFileStatus;
import com.fieldops.modules.sync.domain.InspectionResponse;
import com.fieldops.modules.sync.domain.NonConformity;
import com.fieldops.modules.sync.dto.EvidenceUploadResponse;
import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.TemplateVersion;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO completo de resposta para inspeções agendadas, detalhamento, sincronização do técnico
 * e tela de revisão técnica (TASK-011, TASK-019).
 */
@Schema(description = "Dados completos da inspeção agendada, execução sincronizada, revisão e snapshot de itens")
public record InspectionDetailsResponse(
        UUID id,
        String title,
        String instructions,
        InspectionStatus status,
        InspectionPriority priority,
        UUID templateId,
        String templateCode,
        String templateTitle,
        String templateCategory,
        UUID templateVersionId,
        Integer templateVersion,
        Integer templateVersionNumber,
        UUID clientId,
        String clientCode,
        String clientName,
        UUID siteId,
        String siteCode,
        String siteName,
        String siteAddress,
        UUID equipmentId,
        String equipmentCode,
        String equipmentName,
        String equipmentQrCode,
        UUID technicianId,
        String technicianName,
        String technicianEmail,
        UUID supervisorId,
        String supervisorName,
        UUID createdBy,
        Instant scheduledFor,
        Instant dueDate,
        boolean overdue,
        Instant startedAtDevice,
        Instant startedAtServer,
        Instant completedAtDevice,
        Instant submittedAtServer,
        Instant reviewStartedAt,
        UUID reviewStartedBy,
        Instant approvedAt,
        UUID approvedBy,
        String approvedByName,
        String reviewComments,
        Instant rejectedAt,
        UUID rejectedBy,
        String rejectedByName,
        String rejectionReason,
        @JsonProperty("rejection_reason")
        String rejectionReasonSnake,
        Integer reviewCycle,
        BigDecimal startLatitude,
        BigDecimal startLongitude,
        BigDecimal startAccuracy,
        BigDecimal completeLatitude,
        BigDecimal completeLongitude,
        BigDecimal completeAccuracy,
        Instant canceledAt,
        UUID canceledBy,
        String canceledReason,
        int totalItems,
        List<InspectionItemSnapshotResponse> items,
        List<InspectionResponseReviewDto> responses,
        List<InspectionNonConformityDto> nonConformities,
        List<EvidenceUploadResponse> evidences,
        List<InspectionReviewHistoryDto> reviews,
        Instant createdAt,
        Instant updatedAt,
        Integer version
) {
    public static InspectionDetailsResponse fromEntity(
            Inspection inspection,
            List<InspectionItemSnapshot> snapshots
    ) {
        return fromEntity(inspection, snapshots, List.of(), List.of(), List.of(), List.of(), Map.of());
    }

    public static InspectionDetailsResponse fromEntity(
            Inspection inspection,
            List<InspectionItemSnapshot> snapshots,
            List<InspectionResponse> responses,
            List<NonConformity> nonConformities,
            List<EvidenceFile> evidences,
            List<InspectionReview> reviews,
            Map<UUID, String> userNamesById
    ) {
        List<InspectionItemSnapshotResponse> itemResponses = snapshots != null
                ? snapshots.stream().map(InspectionItemSnapshotResponse::fromEntity).toList()
                : List.of();
        Map<UUID, String> safeUserNames = userNamesById != null ? userNamesById : Map.of();
        List<InspectionResponseReviewDto> responseDtos = responses != null
                ? responses.stream().map(r -> InspectionResponseReviewDto.fromEntity(r, safeUserNames)).toList()
                : List.of();
        List<InspectionNonConformityDto> ncDtos = nonConformities != null
                ? nonConformities.stream().map(InspectionNonConformityDto::fromEntity).toList()
                : List.of();
        List<EvidenceUploadResponse> evidenceDtos = evidences != null
                ? evidences.stream()
                        .filter(ev -> ev.getStatus() != EvidenceFileStatus.DELETED)
                        .map(ev -> EvidenceUploadResponse.fromEntity(ev, null, false))
                        .toList()
                : List.of();
        List<InspectionReviewHistoryDto> reviewDtos = reviews != null
                ? reviews.stream().map(r -> InspectionReviewHistoryDto.fromEntity(r, safeUserNames)).toList()
                : List.of();

        return build(
                inspection,
                itemResponses.size(),
                itemResponses,
                responseDtos,
                ncDtos,
                evidenceDtos,
                reviewDtos,
                safeUserNames
        );
    }

    public static InspectionDetailsResponse summaryFromEntity(Inspection inspection, int totalItems) {
        return build(inspection, totalItems, List.of(), List.of(), List.of(), List.of(), List.of(), Map.of());
    }

    private static InspectionDetailsResponse build(
            Inspection inspection,
            int totalItems,
            List<InspectionItemSnapshotResponse> items,
            List<InspectionResponseReviewDto> responses,
            List<InspectionNonConformityDto> nonConformities,
            List<EvidenceUploadResponse> evidences,
            List<InspectionReviewHistoryDto> reviews,
            Map<UUID, String> userNamesById
    ) {
        InspectionTemplate template = inspection.getTemplate();
        TemplateVersion templateVersion = inspection.getTemplateVersion();
        Client client = inspection.getClient();
        Site site = inspection.getSite();
        Equipment equipment = inspection.getEquipment();
        User technician = inspection.getTechnician();
        User supervisor = inspection.getSupervisor();

        boolean isOverdue = inspection.getScheduledFor() != null
                && inspection.getScheduledFor().isBefore(Instant.now())
                && (inspection.getStatus() == InspectionStatus.ATRIBUÍDA
                || inspection.getStatus() == InspectionStatus.EM_ANDAMENTO
                || inspection.getStatus() == InspectionStatus.REPROVADA);

        String approvedByName = inspection.getApprovedBy() != null
                ? userNamesById.get(inspection.getApprovedBy())
                : null;
        String rejectedByName = inspection.getRejectedBy() != null
                ? userNamesById.get(inspection.getRejectedBy())
                : null;

        return new InspectionDetailsResponse(
                inspection.getId(),
                inspection.getTitle(),
                inspection.getInstructions(),
                inspection.getStatus(),
                inspection.getPriority(),
                template != null ? template.getId() : null,
                template != null ? template.getCode() : null,
                templateVersion != null ? templateVersion.getTitleSnapshot() : (template != null ? template.getTitle() : null),
                templateVersion != null ? templateVersion.getCategorySnapshot() : (template != null ? template.getCategory() : null),
                templateVersion != null ? templateVersion.getId() : null,
                inspection.getTemplateVersionNumber(),
                inspection.getTemplateVersionNumber(),
                client != null ? client.getId() : null,
                client != null ? client.getCode() : null,
                client != null ? client.getName() : null,
                site != null ? site.getId() : null,
                site != null ? site.getCode() : null,
                site != null ? site.getName() : null,
                formatSiteAddress(site),
                equipment != null ? equipment.getId() : null,
                equipment != null ? equipment.getCode() : null,
                equipment != null ? equipment.getName() : null,
                equipment != null ? equipment.getQrCode() : null,
                technician != null ? technician.getId() : null,
                technician != null ? technician.getName() : null,
                technician != null ? technician.getEmail() : null,
                supervisor != null ? supervisor.getId() : null,
                supervisor != null ? supervisor.getName() : null,
                inspection.getCreatedBy(),
                inspection.getScheduledFor(),
                inspection.getScheduledFor(),
                isOverdue,
                inspection.getStartedAtDevice(),
                inspection.getStartedAtServer(),
                inspection.getCompletedAtDevice(),
                inspection.getSubmittedAtServer(),
                inspection.getReviewStartedAt(),
                inspection.getReviewStartedBy(),
                inspection.getApprovedAt(),
                inspection.getApprovedBy(),
                approvedByName,
                inspection.getReviewComments(),
                inspection.getRejectedAt(),
                inspection.getRejectedBy(),
                rejectedByName,
                inspection.getRejectionReason(),
                inspection.getRejectionReason(),
                inspection.getReviewCycle(),
                inspection.getStartLatitude(),
                inspection.getStartLongitude(),
                inspection.getStartAccuracy(),
                inspection.getCompleteLatitude(),
                inspection.getCompleteLongitude(),
                inspection.getCompleteAccuracy(),
                inspection.getCanceledAt(),
                inspection.getCanceledBy(),
                inspection.getCanceledReason(),
                totalItems,
                items,
                responses,
                nonConformities,
                evidences,
                reviews,
                inspection.getCreatedAt(),
                inspection.getUpdatedAt(),
                inspection.getVersion()
        );
    }

    private static String formatSiteAddress(Site site) {
        if (site == null) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        if (site.getAddressLine() != null && !site.getAddressLine().isBlank()) {
            parts.add(site.getAddressLine().trim());
        }
        String cityState = null;
        if (site.getCity() != null && !site.getCity().isBlank()) {
            cityState = site.getCity().trim();
            if (site.getState() != null && !site.getState().isBlank()) {
                cityState += "/" + site.getState().trim();
            }
        } else if (site.getState() != null && !site.getState().isBlank()) {
            cityState = site.getState().trim();
        }
        if (cityState != null) {
            parts.add(cityState);
        }
        if (site.getPostalCode() != null && !site.getPostalCode().isBlank()) {
            parts.add("CEP " + site.getPostalCode().trim());
        }
        return parts.isEmpty() ? null : String.join(" - ", parts);
    }
}
