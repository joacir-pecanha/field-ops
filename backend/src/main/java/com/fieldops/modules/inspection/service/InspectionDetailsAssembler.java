package com.fieldops.modules.inspection.service;

import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.inspection.domain.InspectionReview;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionReviewRepository;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.modules.sync.domain.EvidenceFile;
import com.fieldops.modules.sync.domain.InspectionResponse;
import com.fieldops.modules.sync.domain.NonConformity;
import com.fieldops.modules.sync.repository.EvidenceFileRepository;
import com.fieldops.modules.sync.repository.InspectionResponseRepository;
import com.fieldops.modules.sync.repository.NonConformityRepository;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Montador compartilhado de {@link InspectionDetailsResponse} com carregamento completo de
 * snapshots, respostas, não conformidades, evidências e histórico de revisões.
 */
@Component
public class InspectionDetailsAssembler {

    private final InspectionItemSnapshotRepository snapshotRepository;
    private final InspectionResponseRepository inspectionResponseRepository;
    private final NonConformityRepository nonConformityRepository;
    private final EvidenceFileRepository evidenceFileRepository;
    private final InspectionReviewRepository inspectionReviewRepository;
    private final UserRepository userRepository;

    public InspectionDetailsAssembler(
            InspectionItemSnapshotRepository snapshotRepository,
            InspectionResponseRepository inspectionResponseRepository,
            NonConformityRepository nonConformityRepository,
            EvidenceFileRepository evidenceFileRepository,
            InspectionReviewRepository inspectionReviewRepository,
            UserRepository userRepository
    ) {
        this.snapshotRepository = snapshotRepository;
        this.inspectionResponseRepository = inspectionResponseRepository;
        this.nonConformityRepository = nonConformityRepository;
        this.evidenceFileRepository = evidenceFileRepository;
        this.inspectionReviewRepository = inspectionReviewRepository;
        this.userRepository = userRepository;
    }

    public InspectionDetailsResponse assembleDetailed(Inspection inspection) {
        UUID inspectionId = inspection.getId();
        List<InspectionItemSnapshot> snapshots = snapshotRepository
                .findByInspectionIdOrderBySectionOrderAscItemOrderAsc(inspectionId);
        List<InspectionResponse> responses = inspectionResponseRepository
                .findByInspectionIdOrderByCreatedAtAsc(inspectionId);
        List<NonConformity> nonConformities = nonConformityRepository
                .findByInspectionIdOrderByCreatedAtAsc(inspectionId);
        List<EvidenceFile> evidences = evidenceFileRepository
                .findByInspectionIdOrderByCreatedAtAsc(inspectionId);
        List<InspectionReview> reviews = inspectionReviewRepository
                .findByInspectionIdOrderByReviewCycleAscCreatedAtAsc(inspectionId);

        Map<UUID, String> userNamesById = resolveUserNames(inspection, responses, reviews);

        return InspectionDetailsResponse.fromEntity(
                inspection,
                snapshots,
                responses,
                nonConformities,
                evidences,
                reviews,
                userNamesById
        );
    }

    public Map<UUID, String> resolveUserNames(
            Inspection inspection,
            List<InspectionResponse> responses,
            List<InspectionReview> reviews
    ) {
        Set<UUID> userIds = new HashSet<>();
        if (inspection.getReviewStartedBy() != null) {
            userIds.add(inspection.getReviewStartedBy());
        }
        if (inspection.getApprovedBy() != null) {
            userIds.add(inspection.getApprovedBy());
        }
        if (inspection.getRejectedBy() != null) {
            userIds.add(inspection.getRejectedBy());
        }
        if (responses != null) {
            for (InspectionResponse response : responses) {
                if (response.getAdminAdjustedBy() != null) {
                    userIds.add(response.getAdminAdjustedBy());
                }
            }
        }
        if (reviews != null) {
            for (InspectionReview review : reviews) {
                if (review.getReviewerId() != null) {
                    userIds.add(review.getReviewerId());
                }
            }
        }

        if (userIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, String> names = new HashMap<>();
        for (User user : userRepository.findAllById(userIds)) {
            names.put(user.getId(), user.getName());
        }
        return names;
    }
}
