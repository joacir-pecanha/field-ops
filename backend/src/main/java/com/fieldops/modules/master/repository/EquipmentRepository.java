package com.fieldops.modules.master.repository;

import com.fieldops.modules.master.domain.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repositório de persistência para a entidade {@link Equipment}.
 */
@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, UUID>, JpaSpecificationExecutor<Equipment> {

    Optional<Equipment> findByQrCodeIgnoreCase(String qrCode);

    boolean existsByQrCodeIgnoreCase(String qrCode);

    boolean existsByQrCodeIgnoreCaseAndIdNot(String qrCode, UUID id);
}

