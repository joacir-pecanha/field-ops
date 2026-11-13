package com.fieldops.modules.master.service;

import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.dto.UserCreateRequest;
import com.fieldops.modules.master.dto.UserResponse;
import com.fieldops.modules.master.dto.UserUpdateRequest;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.exception.DuplicateResourceException;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.master.repository.MasterSpecifications;
import com.fieldops.modules.master.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import static com.fieldops.modules.master.service.MasterServiceSupport.sanitizePageable;
import static com.fieldops.modules.master.service.MasterServiceSupport.trimToNull;

/**
 * Serviço de domínio para gestão administrativa de Usuários (AC-USERS, RN-002, RN-008, RN-013).
 */
@Service
public class UserMasterService {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "name", "email", "role", "status", "createdAt", "updatedAt"
    );
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "name");

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    public UserMasterService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> list(
            String search,
            UserRole role,
            UserStatus status,
            Boolean active,
            Pageable pageable
    ) {
        Pageable safePageable = sanitizePageable(pageable, ALLOWED_SORT_FIELDS, DEFAULT_SORT);
        Page<UserResponse> page = userRepository
                .findAll(MasterSpecifications.filterUsers(search, role, status, active), safePageable)
                .map(UserResponse::fromEntity);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public UserResponse getById(UUID id) {
        return UserResponse.fromEntity(findEntityById(id));
    }

    @Transactional
    public UserResponse create(UserCreateRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_EMAIL",
                    "Já existe um usuário cadastrado com o e-mail informado."
            );
        }

        User user = new User(
                UUID.randomUUID(),
                request.name().trim(),
                normalizedEmail,
                passwordEncoder.encode(request.password()),
                request.role(),
                request.status() != null ? request.status() : UserStatus.ACTIVE,
                trimToNull(request.phone())
        );
        return UserResponse.fromEntity(userRepository.save(user));
    }

    @Transactional
    public UserResponse update(UUID id, UserUpdateRequest request) {
        User user = findEntityById(id);
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCaseAndIdNot(normalizedEmail, id)) {
            throw new DuplicateResourceException(
                    "DUPLICATE_EMAIL",
                    "Já existe outro usuário cadastrado com o e-mail informado."
            );
        }

        user.setName(request.name().trim());
        user.setEmail(normalizedEmail);
        user.setRole(request.role());
        user.setStatus(request.status());
        user.setPhone(trimToNull(request.phone()));

        boolean shouldRevokeSessions = request.status() != UserStatus.ACTIVE;
        if (request.password() != null && !request.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
            shouldRevokeSessions = true;
        }

        User saved = userRepository.save(user);
        if (shouldRevokeSessions) {
            refreshTokenRepository.revokeAllActiveByUserId(id, Instant.now());
        }
        return UserResponse.fromEntity(saved);
    }

    @Transactional
    public UserResponse deactivate(UUID id) {
        User user = findEntityById(id);
        user.setStatus(UserStatus.INACTIVE);
        User saved = userRepository.save(user);
        refreshTokenRepository.revokeAllActiveByUserId(id, Instant.now());
        return UserResponse.fromEntity(saved);
    }

    @Transactional
    public UserResponse activate(UUID id) {
        User user = findEntityById(id);
        user.setStatus(UserStatus.ACTIVE);
        return UserResponse.fromEntity(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public User requireActiveTechnician(UUID technicianId) {
        User user = findEntityById(technicianId);
        if (!user.isActive()) {
            throw new BusinessRuleException(
                    "INACTIVE_USER",
                    "Usuário inativo ou bloqueado não pode ser vinculado a novas inspeções."
            );
        }
        if (user.getRole() != UserRole.TECHNICIAN) {
            throw new BusinessRuleException(
                    "INVALID_TECHNICIAN_ROLE",
                    "O usuário informado não possui perfil TECHNICIAN."
            );
        }
        return user;
    }

    User findEntityById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Usuário", id));
    }
}

