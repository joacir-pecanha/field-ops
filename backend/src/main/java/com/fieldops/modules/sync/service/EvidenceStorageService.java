package com.fieldops.modules.sync.service;

import com.fieldops.modules.inspection.domain.AuditLog;
import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.sync.domain.EvidenceFile;
import com.fieldops.modules.sync.domain.EvidenceFileStatus;
import com.fieldops.modules.sync.domain.InspectionResponse;
import com.fieldops.modules.sync.domain.NonConformity;
import com.fieldops.modules.sync.domain.ProcessedOperation;
import com.fieldops.modules.sync.dto.EvidenceUploadResponse;
import com.fieldops.modules.sync.exception.InvalidEvidenceFileException;
import com.fieldops.modules.sync.repository.EvidenceFileRepository;
import com.fieldops.modules.sync.repository.InspectionResponseRepository;
import com.fieldops.modules.sync.repository.NonConformityRepository;
import com.fieldops.modules.sync.repository.ProcessedOperationRepository;
import com.fieldops.security.jwt.AuthenticatedUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Serviço responsável por validar, calcular hash de integridade SHA-256, armazenar em disco com nome UUID
 * e rastrear o ciclo de upload de fotografias de evidência (RF-07, RT-03, EX-02, CA-04).
 */
@Service
public class EvidenceStorageService {

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/jpg", "image/png");
    private static final byte[] PNG_MAGIC = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};

    private final EvidenceFileRepository evidenceFileRepository;
    private final ProcessedOperationRepository processedOperationRepository;
    private final InspectionRepository inspectionRepository;
    private final InspectionItemSnapshotRepository snapshotRepository;
    private final InspectionResponseRepository inspectionResponseRepository;
    private final NonConformityRepository nonConformityRepository;
    private final AuditLogRepository auditLogRepository;
    private final Path storageRootDir;
    private final long maxFileSizeBytes;

    public EvidenceStorageService(
            EvidenceFileRepository evidenceFileRepository,
            ProcessedOperationRepository processedOperationRepository,
            InspectionRepository inspectionRepository,
            InspectionItemSnapshotRepository snapshotRepository,
            InspectionResponseRepository inspectionResponseRepository,
            NonConformityRepository nonConformityRepository,
            AuditLogRepository auditLogRepository,
            @Value("${fieldops.storage.evidence-dir:./data/evidences}") String evidenceDir,
            @Value("${fieldops.storage.max-file-size-bytes:10485760}") long maxFileSizeBytes
    ) {
        this.evidenceFileRepository = evidenceFileRepository;
        this.processedOperationRepository = processedOperationRepository;
        this.inspectionRepository = inspectionRepository;
        this.snapshotRepository = snapshotRepository;
        this.inspectionResponseRepository = inspectionResponseRepository;
        this.nonConformityRepository = nonConformityRepository;
        this.auditLogRepository = auditLogRepository;
        this.storageRootDir = Paths.get(evidenceDir).toAbsolutePath().normalize();
        this.maxFileSizeBytes = maxFileSizeBytes > 0 ? maxFileSizeBytes : 10L * 1024L * 1024L;
    }

    @Transactional
    public EvidenceUploadResponse storeEvidence(
            MultipartFile file,
            UUID inspectionId,
            UUID requestedEvidenceId,
            UUID operationId,
            UUID itemId,
            UUID responseId,
            UUID nonConformityId,
            String clientTimestampRaw,
            String expectedChecksumSha256,
            String description,
            BigDecimal latitude,
            BigDecimal longitude,
            AuthenticatedUser actor
    ) {
        Instant serverTimestamp = Instant.now();
        String originalFileName = file != null ? trimToNull(file.getOriginalFilename()) : null;
        String rawMimeType = file != null ? normalizeMimeType(file.getContentType()) : null;

        // Idempotência por operation_id se informado
        if (operationId != null) {
            Optional<ProcessedOperation> existingOp = processedOperationRepository.findById(operationId);
            if (existingOp.isPresent() && existingOp.get().getEntityId() != null) {
                Optional<EvidenceFile> existingEvidence = evidenceFileRepository.findById(existingOp.get().getEntityId());
                if (existingEvidence.isPresent() && existingEvidence.get().getStatus() == EvidenceFileStatus.UPLOADED) {
                    return EvidenceUploadResponse.fromEntity(existingEvidence.get(), operationId, true);
                }
            }
        }

        // 1. Validação de arquivo vazio / ausente / formato / corrupção (EX-02 -> HTTP 415)
        if (file == null || file.isEmpty()) {
            throw InvalidEvidenceFileException.unsupportedMediaType(
                    "EMPTY_OR_CORRUPTED_IMAGE",
                    "O arquivo de imagem enviado está vazio ou ausente.",
                    requestedEvidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw InvalidEvidenceFileException.unsupportedMediaType(
                    "CORRUPTED_IMAGE_STREAM",
                    "Não foi possível ler os bytes do arquivo de imagem enviado.",
                    requestedEvidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        if (bytes.length == 0) {
            throw InvalidEvidenceFileException.unsupportedMediaType(
                    "EMPTY_OR_CORRUPTED_IMAGE",
                    "O arquivo de imagem enviado está vazio ou corrompido.",
                    requestedEvidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        if (bytes.length > maxFileSizeBytes) {
            throw new InvalidEvidenceFileException(
                    HttpStatus.valueOf(413),
                    "EVIDENCE_FILE_TOO_LARGE",
                    "O arquivo de evidência excede o tamanho máximo permitido de " + maxFileSizeBytes + " bytes.",
                    requestedEvidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        if (rawMimeType == null || !ALLOWED_MIME_TYPES.contains(rawMimeType)) {
            throw InvalidEvidenceFileException.unsupportedMediaType(
                    "UNSUPPORTED_MEDIA_TYPE",
                    "Formato de arquivo não suportado ('" + rawMimeType + "'). Apenas JPEG e PNG são aceitos.",
                    requestedEvidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        ValidatedImageMetadata imageMeta = validateMagicAndIntegrity(
                bytes,
                rawMimeType,
                requestedEvidenceId,
                originalFileName
        );

        String computedSha256 = computeSha256Hex(bytes);
        String trimmedExpectedChecksum = trimToNull(expectedChecksumSha256);
        if (trimmedExpectedChecksum != null && !trimmedExpectedChecksum.equalsIgnoreCase(computedSha256)) {
            throw InvalidEvidenceFileException.unsupportedMediaType(
                    "IMAGE_CHECKSUM_MISMATCH",
                    "Arquivo corrompido durante a transmissão: checksum SHA-256 divergente.",
                    requestedEvidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        // 2. Validação da inspeção e proteção contra alterações em inspeção aprovada/cancelada
        if (inspectionId == null) {
            throw new InvalidEvidenceFileException(
                    HttpStatus.BAD_REQUEST,
                    "INSPECTION_ID_REQUIRED",
                    "O identificador da inspeção (inspectionId) é obrigatório para o upload da evidência.",
                    requestedEvidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));

        if (actor != null && actor.getRole() == UserRole.TECHNICIAN
                && !inspection.getTechnician().getId().equals(actor.getId())) {
            throw new AccessDeniedException("Você não possui permissão para enviar evidências nesta inspeção.");
        }

        if (inspection.getStatus() == InspectionStatus.APROVADA
                || inspection.getStatus() == InspectionStatus.CANCELADA) {
            throw new InvalidEvidenceFileException(
                    HttpStatus.CONFLICT,
                    "CONFLICT",
                    "Inspeção no estado " + inspection.getStatus() + " não aceita envio de novas evidências.",
                    requestedEvidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        // 3. Resolução e validação de vínculos com item, resposta e não conformidade (CA-04)
        UUID resolvedItemId = itemId;
        if (itemId != null) {
            InspectionItemSnapshot snapshot = snapshotRepository.findById(itemId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Item do snapshot", itemId));
            if (!snapshot.getInspection().getId().equals(inspection.getId())) {
                throw new InvalidEvidenceFileException(
                        HttpStatus.valueOf(422),
                        "SNAPSHOT_ITEM_MISMATCH",
                        "O item informado não pertence à inspeção " + inspection.getId() + ".",
                        requestedEvidenceId,
                        originalFileName,
                        rawMimeType
                );
            }
        }

        UUID resolvedResponseId = responseId;
        if (responseId != null) {
            InspectionResponse response = inspectionResponseRepository.findById(responseId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Resposta de inspeção", responseId));
            if (!response.getInspectionId().equals(inspection.getId())) {
                throw new InvalidEvidenceFileException(
                        HttpStatus.valueOf(422),
                        "RESPONSE_INSPECTION_MISMATCH",
                        "A resposta informada não pertence à inspeção " + inspection.getId() + ".",
                        requestedEvidenceId,
                        originalFileName,
                        rawMimeType
                );
            }
            if (resolvedItemId == null) {
                resolvedItemId = response.getInspectionItemId();
            }
        } else if (itemId != null) {
            resolvedResponseId = inspectionResponseRepository
                    .findByInspectionIdAndInspectionItemId(inspection.getId(), itemId)
                    .map(InspectionResponse::getId)
                    .orElse(null);
        }

        if (nonConformityId != null) {
            NonConformity nc = nonConformityRepository.findById(nonConformityId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Não conformidade", nonConformityId));
            if (!nc.getInspectionId().equals(inspection.getId())) {
                throw new InvalidEvidenceFileException(
                        HttpStatus.valueOf(422),
                        "NON_CONFORMITY_INSPECTION_MISMATCH",
                        "A não conformidade informada não pertence à inspeção " + inspection.getId() + ".",
                        requestedEvidenceId,
                        originalFileName,
                        rawMimeType
                );
            }
        }

        UUID evidenceId = requestedEvidenceId != null ? requestedEvidenceId : UUID.randomUUID();
        Optional<EvidenceFile> existingById = evidenceFileRepository.findById(evidenceId);
        if (existingById.isPresent()
                && existingById.get().getStatus() == EvidenceFileStatus.UPLOADED
                && existingById.get().getChecksumSha256().equalsIgnoreCase(computedSha256)) {
            return EvidenceUploadResponse.fromEntity(existingById.get(), operationId, true);
        }

        // 4. Persistência física com nome baseado no UUID (RT-03)
        String extension = "image/png".equals(imageMeta.canonicalMimeType()) ? "png" : "jpg";
        String uuidFileName = evidenceId + "." + extension;
        String storageKey = inspection.getId() + "/" + uuidFileName;
        Path targetPath = storageRootDir.resolve(storageKey).normalize();
        if (!targetPath.startsWith(storageRootDir)) {
            throw new InvalidEvidenceFileException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_STORAGE_PATH",
                    "Caminho de armazenamento inválido para a evidência.",
                    evidenceId,
                    originalFileName,
                    rawMimeType
            );
        }

        try {
            Files.createDirectories(targetPath.getParent());
            Files.write(targetPath, bytes);
        } catch (IOException ex) {
            throw new IllegalStateException("Falha ao gravar arquivo de evidência em disco.", ex);
        }

        Instant capturedAtDevice = parseInstantOrNull(clientTimestampRaw);

        EvidenceFile entity = existingById.orElseGet(EvidenceFile::new);
        entity.setId(evidenceId);
        entity.setInspectionId(inspection.getId());
        entity.setInspectionItemId(resolvedItemId);
        entity.setResponseId(resolvedResponseId);
        entity.setNonConformityId(nonConformityId);
        entity.setType("PHOTO");
        entity.setFileName(uuidFileName);
        entity.setOriginalFileName(originalFileName);
        entity.setStorageKey(storageKey);
        entity.setMimeType(imageMeta.canonicalMimeType());
        entity.setSizeBytes((long) bytes.length);
        entity.setChecksumSha256(computedSha256);
        entity.setWidth(imageMeta.width());
        entity.setHeight(imageMeta.height());
        entity.setDescription(trimToNull(description));
        entity.setLatitude(latitude);
        entity.setLongitude(longitude);
        entity.setStatus(EvidenceFileStatus.UPLOADED);
        entity.setErrorMessage(null);
        entity.setCapturedAtDevice(capturedAtDevice);
        entity.setServerReceivedAt(serverTimestamp);
        entity.setUploadedAt(serverTimestamp);
        entity.setCreatedBy(actor != null ? actor.getId() : inspection.getTechnician().getId());

        EvidenceFile saved = evidenceFileRepository.saveAndFlush(entity);

        if (operationId != null) {
            ProcessedOperation processed = new ProcessedOperation();
            processed.setOperationId(operationId);
            processed.setOperationType("UPLOAD_EVIDENCE");
            processed.setEntityType("EVIDENCE");
            processed.setEntityId(saved.getId());
            processed.setInspectionId(inspection.getId());
            processed.setActorId(actor != null ? actor.getId() : null);
            processed.setStatus("SUCCESS");
            processed.setResultCode("PROCESSED");
            processed.setResultMessage("Upload da evidência concluído com sucesso.");
            processed.setClientTimestamp(capturedAtDevice);
            processed.setServerTimestamp(serverTimestamp);
            processedOperationRepository.saveAndFlush(processed);
        }

        AuditLog auditLog = new AuditLog();
        auditLog.setId(UUID.randomUUID());
        auditLog.setInspectionId(inspection.getId());
        auditLog.setActorId(actor != null ? actor.getId() : null);
        auditLog.setActorEmail(actor != null ? actor.getEmail() : null);
        auditLog.setAction("EVIDENCE_ADDED");
        auditLog.setEntityType("EVIDENCE");
        auditLog.setEntityId(saved.getId());
        auditLog.setNewValueJson("{\"fileName\":\"" + saved.getFileName() + "\",\"checksumSha256\":\"" + saved.getChecksumSha256() + "\"}");
        auditLog.setRequestId(operationId != null ? operationId.toString() : null);
        auditLog.setDeviceOccurredAt(capturedAtDevice);
        auditLog.setOccurredAt(serverTimestamp);
        auditLog.setDetails("Evidência fotográfica armazenada (" + saved.getFileName() + ", " + saved.getSizeBytes() + " bytes).");
        auditLogRepository.save(auditLog);

        return EvidenceUploadResponse.fromEntity(saved, operationId, false);
    }

    @Transactional(readOnly = true)
    public EvidenceFile getEvidenceMetadata(UUID evidenceId, AuthenticatedUser actor) {
        EvidenceFile file = evidenceFileRepository.findById(evidenceId)
                .orElseThrow(() -> ResourceNotFoundException.of("Evidência", evidenceId));
        authorizeReadAccess(file.getInspectionId(), actor);
        return file;
    }

    @Transactional(readOnly = true)
    public byte[] loadEvidenceContent(EvidenceFile evidence) {
        Path filePath = storageRootDir.resolve(evidence.getStorageKey()).normalize();
        if (!filePath.startsWith(storageRootDir) || !Files.exists(filePath)) {
            throw ResourceNotFoundException.of("Arquivo físico da evidência", evidence.getId());
        }
        try {
            return Files.readAllBytes(filePath);
        } catch (IOException ex) {
            throw new IllegalStateException("Falha ao ler arquivo físico da evidência.", ex);
        }
    }

    private void authorizeReadAccess(UUID inspectionId, AuthenticatedUser actor) {
        if (actor != null && actor.getRole() == UserRole.TECHNICIAN) {
            Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));
            if (!inspection.getTechnician().getId().equals(actor.getId())) {
                throw new AccessDeniedException("Você não possui permissão para acessar evidências de outro técnico.");
            }
        }
    }

    private ValidatedImageMetadata validateMagicAndIntegrity(
            byte[] bytes,
            String mimeType,
            UUID evidenceId,
            String originalFileName
    ) {
        boolean isPngMime = "image/png".equals(mimeType);
        String canonicalMime = isPngMime ? "image/png" : "image/jpeg";

        if (isPngMime) {
            if (!matchesPngMagic(bytes)) {
                throw InvalidEvidenceFileException.unsupportedMediaType(
                        "CORRUPTED_OR_INVALID_PNG",
                        "Os bytes do arquivo não correspondem a uma imagem PNG íntegra.",
                        evidenceId,
                        originalFileName,
                        mimeType
                );
            }
        } else {
            if (!matchesJpegMagic(bytes)) {
                throw InvalidEvidenceFileException.unsupportedMediaType(
                        "CORRUPTED_OR_INVALID_JPEG",
                        "Os bytes do arquivo não correspondem a uma imagem JPEG íntegra.",
                        evidenceId,
                        originalFileName,
                        mimeType
                );
            }
        }

        try {
            BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(bytes));
            if (decoded == null || decoded.getWidth() <= 0 || decoded.getHeight() <= 0) {
                throw InvalidEvidenceFileException.unsupportedMediaType(
                        "CORRUPTED_IMAGE_DATA",
                        "A imagem enviada está corrompida e não pôde ser decodificada.",
                        evidenceId,
                        originalFileName,
                        mimeType
                );
            }
            return new ValidatedImageMetadata(canonicalMime, decoded.getWidth(), decoded.getHeight());
        } catch (InvalidEvidenceFileException ex) {
            throw ex;
        } catch (Exception ex) {
            throw InvalidEvidenceFileException.unsupportedMediaType(
                    "CORRUPTED_IMAGE_DATA",
                    "A imagem enviada está corrompida ou malformada.",
                    evidenceId,
                    originalFileName,
                    mimeType
            );
        }
    }

    private boolean matchesJpegMagic(byte[] bytes) {
        return bytes.length >= 4
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF;
    }

    private boolean matchesPngMagic(byte[] bytes) {
        if (bytes.length < PNG_MAGIC.length) {
            return false;
        }
        for (int i = 0; i < PNG_MAGIC.length; i++) {
            if (bytes[i] != PNG_MAGIC[i]) {
                return false;
            }
        }
        return true;
    }

    private String computeSha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Algoritmo SHA-256 indisponível na JVM.", ex);
        }
    }

    private String normalizeMimeType(String rawContentType) {
        if (rawContentType == null) {
            return null;
        }
        String base = rawContentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        return base.isEmpty() ? null : base;
    }

    private Instant parseInstantOrNull(String raw) {
        String trimmed = trimToNull(raw);
        if (trimmed == null) {
            return null;
        }
        try {
            return Instant.parse(trimmed);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return OffsetDateTime.parse(trimmed).toInstant();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDateTime.parse(trimmed).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
        }
        return null;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record ValidatedImageMetadata(String canonicalMimeType, int width, int height) {
    }
}
