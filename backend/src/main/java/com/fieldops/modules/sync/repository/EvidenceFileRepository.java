package com.fieldops.modules.sync.repository;

import com.fieldops.modules.sync.domain.EvidenceFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EvidenceFileRepository extends JpaRepository<EvidenceFile, UUID> {

    List<EvidenceFile> findByInspectionIdOrderByCreatedAtAsc(UUID inspectionId);

    List<EvidenceFile> findByInspectionIdAndInspectionItemId(UUID inspectionId, UUID inspectionItemId);

    List<EvidenceFile> findByResponseId(UUID responseId);

    List<EvidenceFile> findByNonConformityId(UUID nonConformityId);

    long countByInspectionId(UUID inspectionId);
}
