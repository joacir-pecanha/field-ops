package com.fieldops.modules.master.repository;

import com.fieldops.modules.master.domain.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repositório de persistência para a entidade {@link Site}.
 */
@Repository
public interface SiteRepository extends JpaRepository<Site, UUID>, JpaSpecificationExecutor<Site> {

    boolean existsByClient_IdAndCodeIgnoreCase(UUID clientId, String code);

    boolean existsByClient_IdAndCodeIgnoreCaseAndIdNot(UUID clientId, String code, UUID id);
}

