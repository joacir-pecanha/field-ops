package com.fieldops.modules.inspection.repository;

import com.fieldops.modules.inspection.domain.InspectionReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repositório JPA para histórico de ciclos de revisão da inspeção ({@link InspectionReview}).
 */
@Repository
public interface InspectionReviewRepository extends JpaRepository<InspectionReview, UUID> {

    List<InspectionReview> findByInspectionIdOrderByReviewCycleAscCreatedAtAsc(UUID inspectionId);
}
