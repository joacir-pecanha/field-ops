package com.fieldops.security.config;

import com.fieldops.modules.auth.exception.InvalidCredentialsException;
import com.fieldops.modules.auth.exception.InvalidRefreshTokenException;
import com.fieldops.modules.auth.exception.UserInactiveException;
import com.fieldops.modules.master.domain.UserStatus;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tratador global de exceções padronizado conforme RFC 7807 (Problem Details for HTTP APIs).
 * Garante que stack traces e detalhes internos nunca vazem nas respostas (RT-02, AC-SECURITY, DoD 18.4).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ProblemDetail> handleInvalidCredentials(
            InvalidCredentialsException ex,
            HttpServletRequest request
    ) {
        log.warn("Tentativa de login com credenciais inválidas em {}", request.getRequestURI());

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED,
                InvalidCredentialsException.DEFAULT_MESSAGE
        );
        problem.setType(URI.create("https://fieldops.com/problems/invalid-credentials"));
        problem.setTitle("Não autorizado");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", "INVALID_CREDENTIALS");
        problem.setProperty("message", InvalidCredentialsException.DEFAULT_MESSAGE);
        problem.setProperty("timestamp", Instant.now().toString());

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<ProblemDetail> handleInvalidRefreshToken(
            InvalidRefreshTokenException ex,
            HttpServletRequest request
    ) {
        log.warn("Tentativa de renovação de sessão com refresh token inválido ou expirado em {}", request.getRequestURI());

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED,
                ex.getMessage()
        );
        problem.setType(URI.create("https://fieldops.com/problems/invalid-refresh-token"));
        problem.setTitle("Sessão expirada ou inválida");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", "INVALID_REFRESH_TOKEN");
        problem.setProperty("message", ex.getMessage());
        problem.setProperty("timestamp", Instant.now().toString());

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
    }

    @ExceptionHandler(UserInactiveException.class)
    public ResponseEntity<ProblemDetail> handleUserInactive(
            UserInactiveException ex,
            HttpServletRequest request
    ) {
        String code = ex.getStatus() == UserStatus.BLOCKED ? "USER_BLOCKED" : "USER_INACTIVE";
        log.warn("Acesso negado para usuário com status {} em {}", ex.getStatus(), request.getRequestURI());

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                ex.getMessage()
        );
        problem.setType(URI.create("https://fieldops.com/problems/user-inactive"));
        problem.setTitle("Usuário inativo ou bloqueado");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        problem.setProperty("message", ex.getMessage());
        problem.setProperty("timestamp", Instant.now().toString());

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> handleAccessDenied(
            AccessDeniedException ex,
            HttpServletRequest request
    ) {
        log.warn("Acesso negado por permissão insuficiente em {}", request.getRequestURI());

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                "Você não possui permissão suficiente para executar esta operação."
        );
        problem.setType(URI.create("https://fieldops.com/problems/forbidden"));
        problem.setTitle("Acesso negado");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", "ACCESS_DENIED");
        problem.setProperty("message", "Você não possui permissão suficiente para executar esta operação.");
        problem.setProperty("timestamp", Instant.now().toString());

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
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

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "Um ou mais campos informados são inválidos."
        );
        problem.setType(URI.create("https://fieldops.com/problems/validation-error"));
        problem.setTitle("Erro de validação");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", "VALIDATION_ERROR");
        problem.setProperty("message", "Um ou mais campos informados são inválidos.");
        problem.setProperty("errors", fieldErrors);
        problem.setProperty("timestamp", Instant.now().toString());

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpectedException(
            Exception ex,
            HttpServletRequest request
    ) {
        log.error("Erro inesperado ao processar requisição em {}: {}", request.getRequestURI(), ex.getClass().getSimpleName());

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Ocorreu um erro interno ao processar a solicitação."
        );
        problem.setType(URI.create("https://fieldops.com/problems/internal-error"));
        problem.setTitle("Erro interno do servidor");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", "INTERNAL_ERROR");
        problem.setProperty("message", "Ocorreu um erro interno ao processar a solicitação.");
        problem.setProperty("timestamp", Instant.now().toString());

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }
}

