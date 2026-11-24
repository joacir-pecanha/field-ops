package com.fieldops.modules.inspection.service;

import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.dto.DashboardMetricsResponse;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.sync.domain.NonConformitySeverity;
import com.fieldops.modules.sync.repository.NonConformityRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Serviço agregador leve de indicadores operacionais do Dashboard Web (TASK-021 RT-01).
 */
@Service
public class DashboardMetricsService {

    private static final int DEFAULT_RECENT_LIMIT = 8;
    private static final int MAX_RECENT_LIMIT = 25;

    private static final List<InspectionStatus> OPERATIONAL_STATUSES = List.of(
            InspectionStatus.ATRIBUÍDA,
            InspectionStatus.EM_ANDAMENTO,
            InspectionStatus.ENVIADA,
            InspectionStatus.EM_REVISÃO,
            InspectionStatus.APROVADA,
            InspectionStatus.REPROVADA,
            InspectionStatus.CANCELADA
    );

    private static final List<InspectionStatus> OVERDUE_ELIGIBLE_STATUSES = List.of(
            InspectionStatus.ATRIBUÍDA,
            InspectionStatus.EM_ANDAMENTO,
            InspectionStatus.REPROVADA
    );

    private static final List<NonConformitySeverity> ORDERED_SEVERITIES = List.of(
            NonConformitySeverity.BAIXA,
            NonConformitySeverity.MEDIA,
            NonConformitySeverity.ALTA,
            NonConformitySeverity.CRITICA
    );

    private final InspectionRepository inspectionRepository;
    private final InspectionItemSnapshotRepository snapshotRepository;
    private final NonConformityRepository nonConformityRepository;

    public DashboardMetricsService(
            InspectionRepository inspectionRepository,
            InspectionItemSnapshotRepository snapshotRepository,
            NonConformityRepository nonConformityRepository
    ) {
        this.inspectionRepository = inspectionRepository;
        this.snapshotRepository = snapshotRepository;
        this.nonConformityRepository = nonConformityRepository;
    }

    @Transactional(readOnly = true)
    public DashboardMetricsResponse getMetrics(int requestedRecentLimit) {
        int recentLimit = sanitizeRecentLimit(requestedRecentLimit);
        Instant now = Instant.now();

        Map<InspectionStatus, Long> statusCounts = new EnumMap<>(InspectionStatus.class);
        for (InspectionStatus status : OPERATIONAL_STATUSES) {
            statusCounts.put(status, 0L);
        }

        for (Object[] row : inspectionRepository.countGroupedByStatus()) {
            InspectionStatus status = (InspectionStatus) row[0];
            Long count = (Long) row[1];
            if (status != null && status != InspectionStatus.RASCUNHO) {
                statusCounts.put(status, count != null ? count : 0L);
            }
        }

        long assignedCount = statusCounts.getOrDefault(InspectionStatus.ATRIBUÍDA, 0L);
        long inProgressCount = statusCounts.getOrDefault(InspectionStatus.EM_ANDAMENTO, 0L);
        long submittedCount = statusCounts.getOrDefault(InspectionStatus.ENVIADA, 0L);
        long underReviewCount = statusCounts.getOrDefault(InspectionStatus.EM_REVISÃO, 0L);
        long approvedCount = statusCounts.getOrDefault(InspectionStatus.APROVADA, 0L);
        long rejectedCount = statusCounts.getOrDefault(InspectionStatus.REPROVADA, 0L);
        long canceledCount = statusCounts.getOrDefault(InspectionStatus.CANCELADA, 0L);

        long totalInspections = assignedCount
                + inProgressCount
                + submittedCount
                + underReviewCount
                + approvedCount
                + rejectedCount
                + canceledCount;
        long awaitingReviewCount = submittedCount + underReviewCount;
        long overdueCount = inspectionRepository.countOverdue(now, OVERDUE_ELIGIBLE_STATUSES);

        Map<String, Long> inspectionsByStatus = new LinkedHashMap<>();
        for (InspectionStatus status : OPERATIONAL_STATUSES) {
            inspectionsByStatus.put(status.name(), statusCounts.getOrDefault(status, 0L));
        }

        Map<NonConformitySeverity, Long> severityCounts = new EnumMap<>(NonConformitySeverity.class);
        for (NonConformitySeverity severity : ORDERED_SEVERITIES) {
            severityCounts.put(severity, 0L);
        }
        for (Object[] row : nonConformityRepository.countActiveGroupedBySeverity()) {
            NonConformitySeverity severity = (NonConformitySeverity) row[0];
            Long count = (Long) row[1];
            if (severity != null) {
                severityCounts.put(severity, count != null ? count : 0L);
            }
        }

        Map<String, Long> nonConformitiesBySeverity = new LinkedHashMap<>();
        long totalNonConformities = 0L;
        for (NonConformitySeverity severity : ORDERED_SEVERITIES) {
            long count = severityCounts.getOrDefault(severity, 0L);
            nonConformitiesBySeverity.put(severity.name(), count);
            totalNonConformities += count;
        }

        List<Inspection> recentEntities = inspectionRepository
                .findByStatusNotOrderByUpdatedAtDescScheduledForDesc(
                        InspectionStatus.RASCUNHO,
                        PageRequest.of(0, recentLimit)
                )
                .getContent();

        Map<UUID, Integer> snapshotCounts = new HashMap<>();
        if (!recentEntities.isEmpty()) {
            List<UUID> recentIds = recentEntities.stream().map(Inspection::getId).toList();
            for (Object[] row : snapshotRepository.countByInspectionIds(recentIds)) {
                UUID inspId = (UUID) row[0];
                Long count = (Long) row[1];
                snapshotCounts.put(inspId, count != null ? count.intValue() : 0);
            }
        }

        List<InspectionDetailsResponse> recentInspections = recentEntities.stream()
                .map(entity -> InspectionDetailsResponse.summaryFromEntity(
                        entity,
                        snapshotCounts.getOrDefault(entity.getId(), 0)
                ))
                .toList();

        return new DashboardMetricsResponse(
                totalInspections,
                inProgressCount,
                awaitingReviewCount,
                overdueCount,
                assignedCount,
                submittedCount,
                underReviewCount,
                approvedCount,
                rejectedCount,
                canceledCount,
                inspectionsByStatus,
                totalNonConformities,
                nonConformitiesBySeverity,
                recentInspections,
                now
        );
    }

    private int sanitizeRecentLimit(int requestedRecentLimit) {
        if (requestedRecentLimit <= 0) {
            return DEFAULT_RECENT_LIMIT;
        }
        return Math.min(requestedRecentLimit, MAX_RECENT_LIMIT);
    }
}
