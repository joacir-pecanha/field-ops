package com.fieldops.modules.template.repository;

import com.fieldops.modules.template.domain.InspectionTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

/**
 * Repositório JPA para modelos lógicos de inspeção.
 */
public interface InspectionTemplateRepository
        extends JpaRepository<InspectionTemplate, UUID>, JpaSpecificationExecutor<InspectionTemplate> {

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);
}

