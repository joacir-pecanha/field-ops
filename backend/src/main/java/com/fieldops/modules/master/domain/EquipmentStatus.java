package com.fieldops.modules.master.domain;

/**
 * Estados cadastrais possíveis para um equipamento físico (docs/modelo-de-dados.md 10.5.3).
 * RN-012: Apenas equipamentos ACTIVE podem ser vinculados a novas inspeções.
 */
public enum EquipmentStatus {
    ACTIVE,
    INACTIVE,
    DECOMMISSIONED
}

