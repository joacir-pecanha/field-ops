package com.fieldops.config;

import jakarta.servlet.http.HttpServlet;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Registra o servlet do H2 Console (/h2-console) exclusivamente quando o perfil dev-h2 está ativo.
 */
@Configuration
@Profile("dev-h2")
public class DevH2ConsoleConfig {

    @Bean
    public ServletRegistrationBean<HttpServlet> h2ConsoleServlet() {
        try {
            Class<?> servletClass = Class.forName("org.h2.server.web.JakartaWebServlet");
            HttpServlet servlet = (HttpServlet) servletClass.getDeclaredConstructor().newInstance();
            ServletRegistrationBean<HttpServlet> registration =
                    new ServletRegistrationBean<>(servlet, "/h2-console/*");
            registration.setName("H2Console");
            return registration;
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(
                    "Não foi possível inicializar o H2 Console. Verifique se o driver H2 está no classpath.",
                    ex
            );
        }
    }
}

