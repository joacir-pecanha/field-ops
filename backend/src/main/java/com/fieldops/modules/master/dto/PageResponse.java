package com.fieldops.modules.master.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * DTO genérico de resposta paginada desacoplado das estruturas internas do Spring Data / JPA.
 */
@Schema(description = "Resposta paginada padrão da API FieldOps")
public record PageResponse<T>(
        @Schema(description = "Itens da página atual") List<T> content,
        @Schema(description = "Índice da página atual (base 0)", example = "0") int page,
        @Schema(description = "Tamanho máximo da página", example = "20") int size,
        @Schema(description = "Total de registros encontrados", example = "42") long totalElements,
        @Schema(description = "Total de páginas disponíveis", example = "3") int totalPages,
        @Schema(description = "Indica se é a primeira página") boolean first,
        @Schema(description = "Indica se é a última página") boolean last
) {
    public static <T> PageResponse<T> from(Page<T> springPage) {
        return new PageResponse<>(
                springPage.getContent(),
                springPage.getNumber(),
                springPage.getSize(),
                springPage.getTotalElements(),
                springPage.getTotalPages(),
                springPage.isFirst(),
                springPage.isLast()
        );
    }
}

