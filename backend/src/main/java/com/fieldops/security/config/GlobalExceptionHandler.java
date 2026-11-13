package com.fieldops.security.config;

import com.fieldops.modules.auth.exception.InvalidCredentialsException;
import com.fieldops.modules.auth.exception.InvalidRefreshTokenException;
import com.fieldops.modules.auth.exception.UserInactiveException;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.exception.BusinessRuleException;
import com.fieldops.modules.master.exception.DuplicateResourceException;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Tratador global de exceções padronizado conforme RFC 7807 (Problem Details for HTTP APIs).
 * Garante que stack traces e detalhes internos nunca vazem nas respostas (RT-02, AC-SECURITY, DoD 18.4).
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ProblemDetail> handleInvalidCredentials(
            InvalidCredentialsException ex,
            HttpServletRequest request
    ) {
        log.warn("Tentativa de login com credenciais inválidas em {}", request.getRequestURI());
        return buildErrorResponse(
                HttpStatus.UNAUTHORIZED,
                "invalid-credentials",
                "Não autorizado",
                InvalidCredentialsException.DEFAULT_MESSAGE,
                "INVALID_CREDENTIALS",
                request
        );
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<ProblemDetail> handleInvalidRefreshToken(
            InvalidRefreshTokenException ex,
            HttpServletRequest request
    ) {
        log.warn("Tentativa de renovação de sessão com refresh token inválido ou expirado em {}", request.getRequestURI());
        return buildErrorResponse(
                HttpStatus.UNAUTHORIZED,
                "invalid-refresh-token",
                "Sessão expirada ou inválida",
                ex.getMessage(),
                "INVALID_REFRESH_TOKEN",
                request
        );
    }

    @ExceptionHandler(UserInactiveException.class)
    public ResponseEntity<ProblemDetail> handleUserInactive(
            UserInactiveException ex,
            HttpServletRequest request
    ) {
        String code = ex.getStatus() == UserStatus.BLOCKED ? "USER_BLOCKED" : "USER_INACTIVE";
        log.warn("Acesso negado para usuário com status {} em {}", ex.getStatus(), request.getRequestURI());
        return buildErrorResponse(
                HttpStatus.FORBIDDEN,
                "user-inactive",
                "Usuário inativo ou bloqueado",
                ex.getMessage(),
                code,
                request
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> handleAccessDenied(
            AccessDeniedException ex,
            HttpServletRequest request
    ) {
        log.warn("Acesso negado por permissão insuficiente em {}", request.getRequestURI());
        return buildErrorResponse(
                HttpStatus.FORBIDDEN,
                "forbidden",
                "Acesso negado",
                "Você não possui permissão suficiente para executar esta operação.",
                "ACCESS_DENIED",
                request
        );
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleResourceNotFound(
            ResourceNotFoundException ex,
            HttpServletRequest request
    ) {
        return buildErrorResponse(
                HttpStatus.NOT_FOUND,
                "resource-not-found",
                "Recurso não encontrado",
                ex.getMessage(),
                ex.getCode(),
                request
        );
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ProblemDetail> handleDuplicateResource(
            DuplicateResourceException ex,
            HttpServletRequest request
    ) {
        log.warn("Conflito de unicidade ({}) em {}", ex.getCode(), request.getRequestURI());
        return buildErrorResponse(
                HttpStatus.CONFLICT,
                "resource-conflict",
                "Conflito de dados",
                ex.getMessage(),
                ex.getCode(),
                request
        );
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ProblemDetail> handleBusinessRule(
            BusinessRuleException ex,
            HttpServletRequest request
    ) {
        log.warn("Regra de negócio violada ({}) em {}", ex.getCode(), request.getRequestURI());
        return buildErrorResponse(
                HttpStatus.valueOf(422),
                "business-rule-violation",
                "Regra de negócio violada",
                ex.getMessage(),
                ex.getCode(),
                request
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrityViolation(
            DataIntegrityViolationException ex,
            HttpServletRequest request
    ) {
        String rawMessage = ex.getMostSpecificCause() != null
                ? ex.getMostSpecificCause().getMessage()
                : ex.getMessage();
        String normalized = rawMessage != null ? rawMessage.toLowerCase(Locale.ROOT) : "";

        String code = "DATA_INTEGRITY_CONFLICT";
        String detail = "Operação rejeitada por conflito de integridade ou unicidade no banco de dados.";

        if (normalized.contains("uq_equipments_qr_code") || normalized.contains("qr_code")) {
            code = "DUPLICATE_QR_CODE";
            detail = "Já existe um equipamento cadastrado com o QR Code informado.";
        } else if (normalized.contains("uq_users_email") || normalized.contains("idx_users_email")) {
            code = "DUPLICATE_EMAIL";
            detail = "Já existe um usuário cadastrado com o e-mail informado.";
        } else if (normalized.contains("uq_clients_code")) {
            code = "DUPLICATE_CLIENT_CODE";
            detail = "Já existe um cliente cadastrado com o código informado.";
        } else if (normalized.contains("uq_sites_client_code")) {
            code = "DUPLICATE_SITE_CODE";
            detail = "Já existe um local cadastrado com este código para o cliente selecionado.";
        }

        log.warn("Violação de integridade ({}) em {}", code, request.getRequestURI());
        return buildErrorResponse(
                HttpStatus.CONFLICT,
                "data-integrity-conflict",
                "Conflito de dados",
                detail,
                code,
                request
        );
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handleOptimisticLock(
            ObjectOptimisticLockingFailureException ex,
            HttpServletRequest request
    ) {
        return buildErrorResponse(
                HttpStatus.CONFLICT,
                "optimistic-lock-conflict",
                "Conflito de concorrência",
                "O registro foi atualizado por outro usuário. Recarregue os dados e tente novamente.",
                "OPTIMISTIC_LOCK_CONFLICT",
                request
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidationErrors(
            MethodArgumentNotValidException ex,
            HttpServletRequest request
    ) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
        }

        ProblemDetail problem = createProblemDetail(
                HttpStatus.BAD_REQUEST,
                "validation-error",
                "Erro de validação",
                "Um ou mais campos informados são inválidos.",
                "VALIDATION_ERROR",
                request
        );
        problem.setProperty("errors", fieldErrors);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(
            ConstraintViolationException ex,
            HttpServletRequest request
    ) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(violation ->
                fieldErrors.putIfAbsent(violation.getPropertyPath().toString(), violation.getMessage())
        );

        ProblemDetail problem = createProblemDetail(
                HttpStatus.BAD_REQUEST,
                "validation-error",
                "Erro de validação",
                "Um ou mais parâmetros informados são inválidos.",
                "VALIDATION_ERROR",
                request
        );
        problem.setProperty("errors", fieldErrors);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ProblemDetail> handleUnreadableMessage(
            HttpMessageNotReadableException ex,
            HttpServletRequest request
    ) {
        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "invalid-request-body",
                "Requisição inválida",
                "O corpo da requisição está malformado ou contém valores incompatíveis.",
                "INVALID_REQUEST_BODY",
                request
        );
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ProblemDetail> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex,
            HttpServletRequest request
    ) {
        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "invalid-parameter",
                "Parâmetro inválido",
                "O parâmetro '" + ex.getName() + "' possui formato inválido.",
                "INVALID_PARAMETER",
                request
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpectedException(
            Exception ex,
            HttpServletRequest request
    ) {
        log.error("Erro inesperado ao processar requisição em {}: {}", request.getRequestURI(), ex.getClass().getSimpleName());
        return buildErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "internal-error",
                "Erro interno do servidor",
                "Ocorreu um erro interno ao processar a solicitação.",
                "INTERNAL_ERROR",
                request
        );
    }

    private ResponseEntity<ProblemDetail> buildErrorResponse(
            HttpStatus status,
            String typeSlug,
            String title,
            String detail,
            String code,
            HttpServletRequest request
    ) {
        ProblemDetail problem = createProblemDetail(status, typeSlug, title, detail, code, request);
        return ResponseEntity.status(status).body(problem);
    }

    private ProblemDetail createProblemDetail(
            HttpStatus status,
            String typeSlug,
            String title,
            String detail,
            String code,
            HttpServletRequest request
    ) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("https://fieldops.com/problems/" + typeSlug));
        problem.setTitle(title);
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        problem.setProperty("message", detail);
        problem.setProperty("timestamp", Instant.now().toString());
        return problem;
    }
}
