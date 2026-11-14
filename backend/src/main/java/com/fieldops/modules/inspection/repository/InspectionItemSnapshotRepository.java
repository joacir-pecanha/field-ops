package com.fieldops.modules.inspection.repository;

import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Repositório JPA para os snapshots imutáveis de itens de inspeção.
 */
@Repository
public interface InspectionItemSnapshotRepository extends JpaRepository<InspectionItemSnapshot, UUID> {

    List<InspectionItemSnapshot> findByInspectionIdOrderBySectionOrderAscItemOrderAsc(UUID inspectionId);

    List<InspectionItemSnapshot> findByInspectionIdInOrderByInspectionIdAscSectionOrderAscItemOrderAsc(
            Collection<UUID> inspectionIds
    );

    long countByInspectionId(UUID inspectionId);

    @Query("select s.inspection.id, count(s) from InspectionItemSnapshot s where s.inspection.id in :ids group by s.inspection.id")
    List<Object[]> countByInspectionIds(@Param("ids") Collection<UUID> ids);
}
