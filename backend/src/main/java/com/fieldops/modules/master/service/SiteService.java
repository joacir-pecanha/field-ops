package com.fieldops.modules.master.service;

import com.fieldops.modules.master.domain.Client;
import com.fieldops.modules.master.domain.MasterStatus;
import com.fieldops.modules.master.domain.Site;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.dto.SiteRequest;
import com.fieldops.modules.master.dto.SiteResponse;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.exception.DuplicateResourceException;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.master.repository.MasterSpecifications;
import com.fieldops.modules.master.repository.SiteRepository;
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
 * Serviço de domínio para gestão de Locais de Inspeção (RF-01, RF-04, RF-05, RF-06).
 */
@Service
public class SiteService {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "name", "code", "city", "state", "status", "active", "createdAt", "updatedAt"
    );
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "name");

    private final SiteRepository siteRepository;
    private final ClientService clientService;

    public SiteService(SiteRepository siteRepository, ClientService clientService) {
        this.siteRepository = siteRepository;
        this.clientService = clientService;
    }

    @Transactional(readOnly = true)
    public PageResponse<SiteResponse> list(
            UUID clientId,
            String search,
            MasterStatus status,
            Boolean active,
            Pageable pageable
    ) {
        Pageable safePageable = sanitizePageable(pageable, ALLOWED_SORT_FIELDS, DEFAULT_SORT);
        Page<SiteResponse> page = siteRepository
                .findAll(MasterSpecifications.filterSites(clientId, search, status, active), safePageable)
                .map(SiteResponse::fromEntity);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public SiteResponse getById(UUID id) {
        return SiteResponse.fromEntity(findEntityById(id));
    }

    @Transactional
    public SiteResponse create(SiteRequest request) {
        Client client = clientService.requireActiveClient(request.clientId());
        String code = trimToNull(request.code());
        if (code != null && siteRepository.existsByClient_IdAndCodeIgnoreCase(client.getId(), code)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_SITE_CODE",
                    "Já existe um local cadastrado com este código para o cliente selecionado."
            );
        }

        Site site = new Site();
        site.setId(UUID.randomUUID());
        site.setClient(client);
        applyRequestFields(site, request, code);
        if (request.status() != null) {
            site.setStatus(request.status());
        } else {
            site.activate();
        }
        return SiteResponse.fromEntity(siteRepository.save(site));
    }

    @Transactional
    public SiteResponse update(UUID id, SiteRequest request) {
        Site site = findEntityById(id);
        Client targetClient = resolveTargetClient(site, request);

        String code = trimToNull(request.code());
        if (code != null && siteRepository.existsByClient_IdAndCodeIgnoreCaseAndIdNot(targetClient.getId(), code, id)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_SITE_CODE",
                    "Já existe outro local cadastrado com este código para o cliente selecionado."
            );
        }

        site.setClient(targetClient);
        applyRequestFields(site, request, code);
        if (request.status() != null) {
            if (request.status() == MasterStatus.ACTIVE && !targetClient.isActive()) {
                throw new BusinessRuleException(
                        "INACTIVE_CLIENT",
                        "Não é possível ativar um local vinculado a um cliente inativo."
                );
            }
            site.setStatus(request.status());
        }
        return SiteResponse.fromEntity(siteRepository.save(site));
    }

    /**
     * Inativação lógica do local (RF-05, EX-02, RN-013, RN-088).
     */
    @Transactional
    public SiteResponse deactivate(UUID id) {
        Site site = findEntityById(id);
        site.deactivate();
        return SiteResponse.fromEntity(siteRepository.save(site));
    }

    @Transactional
    public SiteResponse activate(UUID id) {
        Site site = findEntityById(id);
        clientService.requireActiveClient(site.getClient().getId());
        site.activate();
        return SiteResponse.fromEntity(siteRepository.save(site));
    }

    @Transactional(readOnly = true)
    public Site requireActiveSite(UUID siteId) {
        Site site = findEntityById(siteId);
        if (!site.isActive()) {
            throw new BusinessRuleException(
                    "INACTIVE_SITE",
                    "O local informado está inativo e não pode ser utilizado em novos vínculos ou inspeções."
            );
        }
        if (!site.getClient().isActive()) {
            throw new BusinessRuleException(
                    "INACTIVE_CLIENT",
                    "O cliente proprietário do local está inativo e não pode ser utilizado em novos vínculos ou inspeções."
            );
        }
        return site;
    }

    @Transactional(readOnly = true)
    public Site requireActiveSiteBelongingToClient(UUID siteId, UUID clientId) {
        Site site = requireActiveSite(siteId);
        if (!site.getClient().getId().equals(clientId)) {
            throw new BusinessRuleException(
                    "SITE_CLIENT_MISMATCH",
                    "O local selecionado não pertence ao cliente informado."
            );
        }
        return site;
    }

    Site findEntityById(UUID id) {
        return siteRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Local", id));
    }

    private Client resolveTargetClient(Site site, SiteRequest request) {
        if (!site.getClient().getId().equals(request.clientId())) {
            return clientService.requireActiveClient(request.clientId());
        }
        return site.getClient();
    }

    private void applyRequestFields(Site site, SiteRequest request, String normalizedCode) {
        site.setCode(normalizedCode);
        site.setName(request.name().trim());
        site.setDescription(trimToNull(request.description()));
        site.setAddressLine(trimToNull(request.addressLine()));
        site.setCity(trimToNull(request.city()));
        site.setState(trimToNull(request.state()));
        site.setPostalCode(trimToNull(request.postalCode()));
        site.setLatitude(request.latitude());
        site.setLongitude(request.longitude());
        site.setContactName(trimToNull(request.contactName()));
        site.setContactPhone(trimToNull(request.contactPhone()));
    }
}

