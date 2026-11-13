package com.fieldops.modules.template.repository;

import com.fieldops.modules.template.domain.TemplateVersion;
import com.fieldops.modules.template.domain.TemplateVersionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repositório JPA para versões (rascunho e publicadas) de modelos de inspeção.
 */
public interface TemplateVersionRepository extends JpaRepository<TemplateVersion, UUID> {

    List<TemplateVersion> findByTemplateIdOrderByVersionNumberAsc(UUID templateId);

    Optional<TemplateVersion> findByTemplateIdAndVersionNumber(UUID templateId, Integer versionNumber);

    Optional<TemplateVersion> findFirstByTemplateIdAndStatusOrderByVersionNumberDesc(
            UUID templateId,
            TemplateVersionStatus status
    );

    Optional<TemplateVersion> findFirstByTemplateIdOrderByVersionNumberDesc(UUID templateId);
}

