package com.fieldops.modules.sync.repository;

import com.fieldops.modules.sync.domain.InspectionResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InspectionResponseRepository extends JpaRepository<InspectionResponse, UUID> {

    Optional<InspectionResponse> findByInspectionItemId(UUID inspectionItemId);

    Optional<InspectionResponse> findByInspectionIdAndInspectionItemId(UUID inspectionId, UUID inspectionItemId);

    List<InspectionResponse> findByInspectionIdOrderByCreatedAtAsc(UUID inspectionId);

    long countByInspectionId(UUID inspectionId);
}
