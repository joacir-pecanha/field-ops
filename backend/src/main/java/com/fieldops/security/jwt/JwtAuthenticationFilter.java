package com.fieldops.security.jwt;

import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Filtro stateless para extração e validação de Bearer Token JWT por requisição.
 * Impede o acesso caso o token seja inválido/expirado ou caso o usuário tenha sido
 * inativado ou bloqueado no banco (RN-001, RN-003, RN-008, AC-SECURITY).
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(
            JwtTokenProvider jwtTokenProvider,
            UserRepository userRepository
    ) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String bearerToken = extractBearerToken(request);

        if (bearerToken != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            if (jwtTokenProvider.validateAccessToken(bearerToken)) {
                UUID userId = jwtTokenProvider.getUserIdFromToken(bearerToken);
                String email = jwtTokenProvider.getEmailFromToken(bearerToken);
                UserRole role = jwtTokenProvider.getRoleFromToken(bearerToken);

                // Verifica se o usuário permanece ativo na base (RN-001 / RN-008)
                Optional<User> storedUserOpt = userRepository.findById(userId);
                boolean allowed = storedUserOpt.map(User::isActive).orElse(true);
                if (storedUserOpt.isPresent()) {
                    role = storedUserOpt.get().getRole();
                    email = storedUserOpt.get().getEmail();
                }

                if (allowed) {
                    AuthenticatedUser principal = new AuthenticatedUser(userId, email, role);
                    SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + role.name());

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    principal,
                                    null,
                                    List.of(authority)
                            );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length()).trim();
            return token.isEmpty() ? null : token;
        }
        return null;
    }
}

