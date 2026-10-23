import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '../../../design-system/tokens';
import type { ChecklistItem } from '../../../infrastructure/database/types';
import {
  ConformityInput,
  SingleChoiceInput,
  DateInput,
  NumericInput,
  ShortTextInput,
  LongTextInput,
  BooleanInput,
} from './inputs';
import { ConformityState, type ConformityStateType } from '../schemas/checklistSchema';

export interface DynamicItemRendererProps {
  item: ChecklistItem;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  nonConformityDescription?: string | null;
  onNonConformityDescriptionChange?: (description: string) => void;
  descriptionError?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * Fallback visual para tipos desconhecidos (CA-02 / SPEC-003)
 */
function UnknownTypeFallback({
  responseType,
  testID,
}: {
  responseType: string;
  testID?: string;
}) {
  return (
    <View style={styles.fallbackCard} testID={`${testID}-unknown-fallback`}>
      <View style={styles.fallbackHeader}>
        <Text style={styles.fallbackIcon}>⚠</Text>
        <Text style={styles.fallbackTitle}>Tipo de Resposta Não Suportado</Text>
      </View>
      <Text style={styles.fallbackText}>
        O tipo de item <Text style={styles.fallbackCode}>{responseType}</Text> não é compatível
        com esta versão do aplicativo. Atualize o FieldOps para responder a este item.
      </Text>
    </View>
  );
}

/**
 * DynamicItemRenderer (SPEC-003 / TASK-003)
 *
 * Despachante central que renderiza o controle de entrada especializado de acordo com
 * o `response_type` do item do checklist.
 *
 * - RF-01: Mapeia os 7 tipos oficiais (TEXT_SHORT, TEXT_LONG, NUMBER, BOOLEAN, CONFORMITY, SINGLE_CHOICE, DATE).
 * - RF-02: Propaga controle de não conformidade para ConformityInput.
 * - CA-02: Apresenta fallback seguro e amigável sem quebrar a tela para tipos desconhecidos.
 * - RT-01: Estilizado integralmente com tokens do design system do FieldOps.
 * - RT-02: Otimizado com React.memo e comparador estrito de propriedades para eliminar re-renders em cascata.
 */
export const DynamicItemRenderer = memo(
  function DynamicItemRenderer({
    item,
    value,
    onChange,
    error,
    nonConformityDescription = '',
    onNonConformityDescriptionChange,
    descriptionError,
    disabled = false,
    testID = `item-renderer-${item.id}`,
  }: DynamicItemRendererProps) {
    const isRequired = Boolean(item.required);

    // Parse seguro de options_json para SINGLE_CHOICE
    let parsedOptions: string[] = [];
    if (item.options_json) {
      try {
        const parsed = JSON.parse(item.options_json);
        if (Array.isArray(parsed)) {
          parsedOptions = parsed.map(String);
        }
      } catch {
        parsedOptions = [];
      }
    }

    // Callbacks estáveis
    const handleConformityChange = useCallback(
      (selectedState: ConformityStateType) => {
        onChange(selectedState);
      },
      [onChange]
    );

    const handleSingleChoiceChange = useCallback(
      (selectedOption: string) => {
        onChange(selectedOption);
      },
      [onChange]
    );

    const handleBooleanChange = useCallback(
      (selectedBool: boolean) => {
        onChange(selectedBool);
      },
      [onChange]
    );

    const handleNumericChange = useCallback(
      (numVal: number | null) => {
        onChange(numVal);
      },
      [onChange]
    );

    const handleTextChange = useCallback(
      (textVal: string) => {
        onChange(textVal);
      },
      [onChange]
    );

    const handleDateChange = useCallback(
      (dateVal: string) => {
        onChange(dateVal);
      },
      [onChange]
    );

    // Despacho do componente especializado conforme response_type
    const renderInputControl = () => {
      switch (item.response_type) {
        case 'CONFORMITY':
          return (
            <ConformityInput
              testID={`${testID}-conformity`}
              value={value}
              nonConformityDescription={nonConformityDescription}
              onChange={handleConformityChange}
              onDescriptionChange={onNonConformityDescriptionChange}
              error={error}
              descriptionError={descriptionError}
              disabled={disabled}
            />
          );

        case 'SINGLE_CHOICE':
          return (
            <SingleChoiceInput
              testID={`${testID}-single-choice`}
              value={value ? String(value) : null}
              options={parsedOptions}
              onChange={handleSingleChoiceChange}
              error={error}
              disabled={disabled}
            />
          );

        case 'BOOLEAN':
          return (
            <BooleanInput
              testID={`${testID}-boolean`}
              value={value}
              onChange={handleBooleanChange}
              error={error}
              disabled={disabled}
            />
          );

        case 'NUMBER':
          return (
            <NumericInput
              testID={`${testID}-number`}
              value={value}
              onChange={handleNumericChange}
              error={error}
              disabled={disabled}
            />
          );

        case 'TEXT_SHORT':
          return (
            <ShortTextInput
              testID={`${testID}-text-short`}
              value={value ? String(value) : null}
              onChange={handleTextChange}
              error={error}
              disabled={disabled}
            />
          );

        case 'TEXT_LONG':
          return (
            <LongTextInput
              testID={`${testID}-text-long`}
              value={value ? String(value) : null}
              onChange={handleTextChange}
              error={error}
              disabled={disabled}
            />
          );

        case 'DATE':
          return (
            <DateInput
              testID={`${testID}-date`}
              value={value ? String(value) : null}
              onChange={handleDateChange}
              error={error}
              disabled={disabled}
            />
          );

        default:
          // CA-02: Fallback seguro sem quebrar a interface
          return <UnknownTypeFallback responseType={String(item.response_type)} testID={testID} />;
      }
    };

    return (
      <View style={styles.card} testID={testID}>
        {/* Cabeçalho do Item */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.itemTitle}>
              {item.title}
              {isRequired && <Text style={styles.requiredAsterisk}> *</Text>}
            </Text>
          </View>
          {isRequired && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredBadgeText}>Obrigatório</Text>
            </View>
          )}
        </View>

        {/* Descrição / Ajuda Opcional */}
        {!!item.description && <Text style={styles.itemDescription}>{item.description}</Text>}

        {/* Controle Especializado de Entrada */}
        <View style={styles.inputContainer}>{renderInputControl()}</View>
      </View>
    );
  },
  // RT-02: Comparador de memoização para prevenir re-renderizações desnecessárias
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.item.response_type === next.item.response_type &&
      prev.item.required === next.item.required &&
      prev.item.title === next.item.title &&
      prev.item.description === next.item.description &&
      prev.item.options_json === next.item.options_json &&
      prev.value === next.value &&
      prev.error === next.error &&
      prev.nonConformityDescription === next.nonConformityDescription &&
      prev.descriptionError === next.descriptionError &&
      prev.disabled === next.disabled
    );
  }
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    padding: tokens.spacing.m,
    marginBottom: tokens.spacing.m,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.xs,
  },
  titleContainer: {
    flex: 1,
    paddingRight: tokens.spacing.s,
  },
  itemTitle: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    lineHeight: 22,
  },
  requiredAsterisk: {
    color: tokens.colors.danger,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  requiredBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.small,
    borderWidth: 1,
    borderColor: tokens.colors.warning,
  },
  requiredBadgeText: {
    fontSize: tokens.typography.fontSizes.small - 2,
    color: '#856404',
    fontWeight: tokens.typography.fontWeights.bold,
  },
  itemDescription: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
    marginBottom: tokens.spacing.s,
    lineHeight: 18,
  },
  inputContainer: {
    marginTop: tokens.spacing.xs,
  },
  // Fallback seguro (CA-02)
  fallbackCard: {
    backgroundColor: '#fff3cd',
    borderWidth: 1.5,
    borderColor: tokens.colors.warning,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.m,
  },
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  fallbackIcon: {
    fontSize: tokens.typography.fontSizes.regular,
    color: '#856404',
  },
  fallbackTitle: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: '#856404',
  },
  fallbackText: {
    fontSize: tokens.typography.fontSizes.small,
    color: '#856404',
    lineHeight: 18,
  },
  fallbackCode: {
    fontWeight: tokens.typography.fontWeights.bold,
    fontFamily: 'monospace',
  },
});
