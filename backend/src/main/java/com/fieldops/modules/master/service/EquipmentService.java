package com.fieldops.modules.master.service;

import com.fieldops.modules.master.domain.Equipment;
import com.fieldops.modules.master.domain.EquipmentStatus;
import com.fieldops.modules.master.domain.Site;
import com.fieldops.modules.master.dto.EquipmentRequest;
import com.fieldops.modules.master.dto.EquipmentResponse;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.exception.DuplicateResourceException;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.master.repository.EquipmentRepository;
import com.fieldops.modules.master.repository.MasterSpecifications;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

import static com.fieldops.modules.master.service.MasterServiceSupport.sanitizePageable;
import static com.fieldops.modules.master.service.MasterServiceSupport.trimToNull;

/**
 * Serviço de domínio para gestão de Equipamentos, unicidade de QR Code e inativação lógica
 * (RF-02, RF-03, RF-04, RF-05, RF-06, EX-01, EX-02).
 */
@Service
public class EquipmentService {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "name", "code", "qrCode", "assetNumber", "serialNumber", "status", "active", "installedAt", "createdAt", "updatedAt"
    );
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "name");

    private final EquipmentRepository equipmentRepository;
    private final SiteService siteService;

    public EquipmentService(EquipmentRepository equipmentRepository, SiteService siteService) {
        this.equipmentRepository = equipmentRepository;
        this.siteService = siteService;
    }

    @Transactional(readOnly = true)
    public PageResponse<EquipmentResponse> list(
            UUID clientId,
            UUID siteId,
            String search,
            EquipmentStatus status,
            Boolean active,
            Pageable pageable
    ) {
        Pageable safePageable = sanitizePageable(pageable, ALLOWED_SORT_FIELDS, DEFAULT_SORT);
        Page<EquipmentResponse> page = equipmentRepository
                .findAll(MasterSpecifications.filterEquipments(clientId, siteId, search, status, active), safePageable)
                .map(EquipmentResponse::fromEntity);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public EquipmentResponse getById(UUID id) {
        return EquipmentResponse.fromEntity(findEntityById(id));
    }

    @Transactional(readOnly = true)
    public EquipmentResponse getByQrCode(String qrCode) {
        String normalizedQr = trimToNull(qrCode);
        if (normalizedQr == null) {
            throw new BusinessRuleException("INVALID_QR_CODE", "O QR Code informado não pode ser vazio.");
        }
        Equipment equipment = equipmentRepository.findByQrCodeIgnoreCase(normalizedQr)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "EQUIPMENT_NOT_FOUND",
                        "Nenhum equipamento encontrado para o QR Code '" + normalizedQr + "'."
                ));
        return EquipmentResponse.fromEntity(equipment);
    }

    @Transactional
    public EquipmentResponse create(EquipmentRequest request) {
        Site site = siteService.requireActiveSite(request.siteId());
        String qrCode = request.qrCode().trim();
        if (equipmentRepository.existsByQrCodeIgnoreCase(qrCode)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_QR_CODE",
                    "Já existe um equipamento cadastrado com o QR Code '" + qrCode + "'."
            );
        }

        Equipment equipment = new Equipment();
        equipment.setId(UUID.randomUUID());
        equipment.setSite(site);
        applyRequestFields(equipment, request, qrCode);
        if (request.status() != null) {
            equipment.setStatus(request.status());
        } else {
            equipment.activate();
        }
        return EquipmentResponse.fromEntity(equipmentRepository.save(equipment));
    }

    @Transactional
    public EquipmentResponse update(UUID id, EquipmentRequest request) {
        Equipment equipment = findEntityById(id);
        Site targetSite = resolveTargetSite(equipment, request);

        String qrCode = request.qrCode().trim();
        if (equipmentRepository.existsByQrCodeIgnoreCaseAndIdNot(qrCode, id)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_QR_CODE",
                    "Já existe outro equipamento cadastrado com o QR Code '" + qrCode + "'."
            );
        }

        equipment.setSite(targetSite);
        applyRequestFields(equipment, request, qrCode);
        if (request.status() != null) {
            if (request.status() == EquipmentStatus.ACTIVE && (!targetSite.isActive() || !targetSite.getClient().isActive())) {
                throw new BusinessRuleException(
                        "INACTIVE_SITE",
                        "Não é possível ativar um equipamento vinculado a um local ou cliente inativo."
                );
            }
            equipment.setStatus(request.status());
        }
        return EquipmentResponse.fromEntity(equipmentRepository.save(equipment));
    }

    /**
     * Inativação lógica do equipamento (RF-05, EX-02, RN-013, RN-088).
     */
    @Transactional
    public EquipmentResponse deactivate(UUID id) {
        Equipment equipment = findEntityById(id);
        equipment.deactivate();
        return EquipmentResponse.fromEntity(equipmentRepository.save(equipment));
    }

    @Transactional
    public EquipmentResponse activate(UUID id) {
        Equipment equipment = findEntityById(id);
        siteService.requireActiveSite(equipment.getSite().getId());
        equipment.activate();
        return EquipmentResponse.fromEntity(equipmentRepository.save(equipment));
    }

    @Transactional(readOnly = true)
    public Equipment requireActiveEquipmentBelongingToSite(UUID equipmentId, UUID siteId) {
        Equipment equipment = findEntityById(equipmentId);
        if (!equipment.isActive()) {
            throw new BusinessRuleException(
                    "INACTIVE_EQUIPMENT",
                    "O equipamento informado está inativo ou descomissionado e não pode ser vinculado a novas inspeções."
            );
        }
        if (!equipment.getSite().getId().equals(siteId)) {
            throw new BusinessRuleException(
                    "EQUIPMENT_SITE_MISMATCH",
                    "O equipamento selecionado não pertence ao local informado."
            );
        }
        return equipment;
    }

    Equipment findEntityById(UUID id) {
        return equipmentRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Equipamento", id));
    }

    private Site resolveTargetSite(Equipment equipment, EquipmentRequest request) {
        if (!equipment.getSite().getId().equals(request.siteId())) {
            return siteService.requireActiveSite(request.siteId());
        }
        return equipment.getSite();
    }

    private void applyRequestFields(Equipment equipment, EquipmentRequest request, String normalizedQr) {
        equipment.setCode(trimToNull(request.code()));
        equipment.setName(request.name().trim());
        equipment.setAssetNumber(trimToNull(request.assetNumber()));
        equipment.setSerialNumber(trimToNull(request.serialNumber()));
        equipment.setManufacturer(trimToNull(request.manufacturer()));
        equipment.setModel(trimToNull(request.model()));
        equipment.setDescription(trimToNull(request.description()));
        equipment.setQrCode(normalizedQr);
        equipment.setInstalledAt(request.installedAt());
    }
}

