import { FormGroup } from '@angular/forms';
import { MasterDataApiError } from '../../core/master/master-data.models';

/**
 * Aplica erros de campo retornados pela API (HTTP 400 / 409) diretamente nos FormControls.
 */
export function applyServerFieldErrors(
  form: FormGroup,
  apiError: MasterDataApiError,
  conflictFieldMap: Record<string, string> = {}
): void {
  for (const [field, message] of Object.entries(apiError.fieldErrors)) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), serverError: message });
      control.markAsTouched();
    }
  }

  const mappedField = conflictFieldMap[apiError.code];
  if (mappedField) {
    const control = form.get(mappedField);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), serverError: apiError.message });
      control.markAsTouched();
    }
  }
}

export function clearServerError(form: FormGroup, controlName: string): void {
  const control = form.get(controlName);
  if (!control || !control.errors || !control.errors['serverError']) {
    return;
  }
  const { serverError: _, ...remaining } = control.errors;
  control.setErrors(Object.keys(remaining).length > 0 ? remaining : null);
}

export function isControlInvalid(
  form: FormGroup,
  controlName: string,
  submitted: boolean
): boolean {
  const control = form.get(controlName);
  return Boolean(control && control.invalid && (control.dirty || control.touched || submitted));
}

export function toggleSortExpression(currentSort: string, field: string): string {
  const [currentField, currentDir] = currentSort.split(',');
  if (currentField === field) {
    return `${field},${currentDir === 'desc' ? 'asc' : 'desc'}`;
  }
  return `${field},asc`;
}

export function sortIndicatorFor(currentSort: string, field: string): string {
  const [currentField, currentDir] = currentSort.split(',');
  if (currentField !== field) {
    return '↕';
  }
  return currentDir === 'desc' ? '↓' : '↑';
}

