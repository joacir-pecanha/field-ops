package com.fieldops.modules.sync.repository;

import com.fieldops.modules.sync.domain.ProcessedOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProcessedOperationRepository extends JpaRepository<ProcessedOperation, UUID> {

    List<ProcessedOperation> findByBatchIdOrderByServerTimestampAsc(String batchId);

    List<ProcessedOperation> findByInspectionIdOrderByServerTimestampAsc(UUID inspectionId);
}
