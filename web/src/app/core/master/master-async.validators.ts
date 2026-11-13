import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, map, of, switchMap, timer } from 'rxjs';
import { ClientsApiService } from './clients-api.service';
import { EquipmentApiService } from './equipment-api.service';
import { SitesApiService } from './sites-api.service';
import { UsersApiService } from './users-api.service';

const ASYNC_DEBOUNCE_MS = 350;

/**
 * Validador assíncrono que verifica se o e-mail já está em uso por outro usuário.
 */
export function uniqueUserEmailValidator(
  usersApi: UsersApiService,
  getExcludeId: () => string | null
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const rawValue = typeof control.value === 'string' ? control.value.trim() : '';
    if (!rawValue || control.invalid) {
      return of(null);
    }

    return timer(ASYNC_DEBOUNCE_MS).pipe(
      switchMap(() => usersApi.checkEmailTaken(rawValue, getExcludeId() ?? undefined)),
      map((taken) => (taken ? { emailTaken: true } : null))
    );
  };
}

/**
 * Validador assíncrono que verifica unicidade do código interno do cliente.
 */
export function uniqueClientCodeValidator(
  clientsApi: ClientsApiService,
  getExcludeId: () => string | null
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const rawValue = typeof control.value === 'string' ? control.value.trim() : '';
    if (rawValue.length < 2) {
      return of(null);
    }

    return timer(ASYNC_DEBOUNCE_MS).pipe(
      switchMap(() => clientsApi.checkCodeTaken(rawValue, getExcludeId() ?? undefined)),
      map((taken) => (taken ? { codeTaken: true } : null))
    );
  };
}

/**
 * Validador assíncrono que verifica unicidade do código do local dentro do cliente selecionado.
 */
export function uniqueSiteCodeValidator(
  sitesApi: SitesApiService,
  getClientId: () => string | null,
  getExcludeId: () => string | null
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const rawValue = typeof control.value === 'string' ? control.value.trim() : '';
    const clientId = getClientId();
    if (!clientId || rawValue.length < 2) {
      return of(null);
    }

    return timer(ASYNC_DEBOUNCE_MS).pipe(
      switchMap(() =>
        sitesApi.checkCodeTakenForClient(clientId, rawValue, getExcludeId() ?? undefined)
      ),
      map((taken) => (taken ? { codeTaken: true } : null))
    );
  };
}

/**
 * Validador assíncrono que detecta colisão de QR Code diretamente contra /api/v1/equipments/qr/{qrCode}.
 */
export function uniqueEquipmentQrCodeValidator(
  equipmentApi: EquipmentApiService,
  getExcludeId: () => string | null
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const rawValue = typeof control.value === 'string' ? control.value.trim() : '';
    if (rawValue.length < 3) {
      return of(null);
    }

    return timer(ASYNC_DEBOUNCE_MS).pipe(
      switchMap(() => equipmentApi.checkQrCodeTaken(rawValue, getExcludeId() ?? undefined)),
      map((taken) => (taken ? { qrCodeTaken: true } : null))
    );
  };
}

