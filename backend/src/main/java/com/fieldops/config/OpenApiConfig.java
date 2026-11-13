package com.fieldops.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuração central da documentação OpenAPI / Swagger UI (TASK-007 Passo 5, CA-04).
 */
@Configuration
public class OpenApiConfig {

    public static final String BEARER_AUTH_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI fieldOpsOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("FieldOps API")
                        .version("v1")
                        .description("""
                                API REST da plataforma FieldOps para autenticação, cadastros mestres e gestão de inspeções.

                                Como validar os endpoints no Swagger UI:
                                1. Execute `POST /api/v1/auth/login` (ex.: `admin@fieldops.com` / `FieldOps@123`) ou copie o Access Token pela tela `Swagger / API` da interface web.
                                2. Clique no botão **Authorize** acima e informe apenas o token JWT obtido.
                                3. Teste os endpoints paginados de **Usuários** (`/api/v1/users`), **Clientes** (`/api/v1/clients`), **Locais de Inspeção** (`/api/v1/sites`) e **Equipamentos** (`/api/v1/equipments` e `/api/v1/equipments/qr/{qrCode}`).
                                """)
                        .contact(new Contact().name("FieldOps Team")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH_SCHEME))
                .components(new Components()
                        .addSecuritySchemes(BEARER_AUTH_SCHEME, new SecurityScheme()
                                .name(BEARER_AUTH_SCHEME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Informe o Access Token JWT obtido em /api/v1/auth/login")));
    }
}

