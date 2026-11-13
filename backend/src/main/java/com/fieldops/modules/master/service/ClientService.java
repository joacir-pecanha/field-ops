package com.fieldops.modules.master.service;

import com.fieldops.modules.master.domain.Client;
import com.fieldops.modules.master.domain.MasterStatus;
import com.fieldops.modules.master.dto.ClientRequest;
import com.fieldops.modules.master.dto.ClientResponse;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.exception.DuplicateResourceException;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.master.repository.ClientRepository;
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
 * Serviço de domínio para gestão de Clientes e preservação de histórico (RF-04, RF-05, RF-06).
 */
@Service
public class ClientService {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "name", "code", "legalName", "document", "status", "active", "createdAt", "updatedAt"
    );
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "name");

    private final ClientRepository clientRepository;

    public ClientService(ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<ClientResponse> list(
            String search,
            MasterStatus status,
            Boolean active,
            Pageable pageable
    ) {
        Pageable safePageable = sanitizePageable(pageable, ALLOWED_SORT_FIELDS, DEFAULT_SORT);
        Page<ClientResponse> page = clientRepository
                .findAll(MasterSpecifications.filterClients(search, status, active), safePageable)
                .map(ClientResponse::fromEntity);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public ClientResponse getById(UUID id) {
        return ClientResponse.fromEntity(findEntityById(id));
    }

    @Transactional
    public ClientResponse create(ClientRequest request) {
        String code = trimToNull(request.code());
        if (code != null && clientRepository.existsByCodeIgnoreCase(code)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_CLIENT_CODE",
                    "Já existe um cliente cadastrado com o código informado."
            );
        }

        Client client = new Client();
        client.setId(UUID.randomUUID());
        applyRequestFields(client, request, code);
        if (request.status() != null) {
            client.setStatus(request.status());
        } else {
            client.activate();
        }
        return ClientResponse.fromEntity(clientRepository.save(client));
    }

    @Transactional
    public ClientResponse update(UUID id, ClientRequest request) {
        Client client = findEntityById(id);
        String code = trimToNull(request.code());
        if (code != null && clientRepository.existsByCodeIgnoreCaseAndIdNot(code, id)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_CLIENT_CODE",
                    "Já existe outro cliente cadastrado com o código informado."
            );
        }

        applyRequestFields(client, request, code);
        if (request.status() != null) {
            client.setStatus(request.status());
        }
        return ClientResponse.fromEntity(clientRepository.save(client));
    }

    /**
     * Inativação lógica do cliente (RF-05, EX-02, RN-013, RN-088).
     * Nunca remove fisicamente para preservar integridade com locais e inspeções históricas.
     */
    @Transactional
    public ClientResponse deactivate(UUID id) {
        Client client = findEntityById(id);
        client.deactivate();
        return ClientResponse.fromEntity(clientRepository.save(client));
    }

    @Transactional
    public ClientResponse activate(UUID id) {
        Client client = findEntityById(id);
        client.activate();
        return ClientResponse.fromEntity(clientRepository.save(client));
    }

    @Transactional(readOnly = true)
    public Client requireActiveClient(UUID clientId) {
        Client client = findEntityById(clientId);
        if (!client.isActive()) {
            throw new BusinessRuleException(
                    "INACTIVE_CLIENT",
                    "O cliente informado está inativo e não pode ser utilizado em novos vínculos ou inspeções."
            );
        }
        return client;
    }

    Client findEntityById(UUID id) {
        return clientRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Cliente", id));
    }

    private void applyRequestFields(Client client, ClientRequest request, String normalizedCode) {
        client.setCode(normalizedCode);
        client.setName(request.name().trim());
        client.setLegalName(trimToNull(request.legalName()));
        client.setDocument(trimToNull(request.document()));
        client.setEmail(trimToNull(request.email()));
        client.setPhone(trimToNull(request.phone()));
    }
}

