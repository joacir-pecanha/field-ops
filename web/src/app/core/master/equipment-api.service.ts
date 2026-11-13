import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EquipmentListQuery,
  EquipmentRequest,
  EquipmentResponse,
  PageResponse,
  buildHttpParams,
  mapMasterDataHttpError,
} from './master-data.models';

/**
 * Serviço HTTP tipado para gestão de Equipamentos e consulta por QR Code (TASK-008 Passo 1).
 */
@Injectable({ providedIn: 'root' })
export class EquipmentApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/v1/equipments`;

  list(query?: EquipmentListQuery): Observable<PageResponse<EquipmentResponse>> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<PageResponse<EquipmentResponse>>(this.baseUrl, { params })
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  getById(id: string): Observable<EquipmentResponse> {
    return this.http
      .get<EquipmentResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  getByQrCode(qrCode: string): Observable<EquipmentResponse> {
    return this.http
      .get<EquipmentResponse>(`${this.baseUrl}/qr/${encodeURIComponent(qrCode.trim())}`)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  create(payload: EquipmentRequest): Observable<EquipmentResponse> {
    return this.http
      .post<EquipmentResponse>(this.baseUrl, payload)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  update(id: string, payload: EquipmentRequest): Observable<EquipmentResponse> {
    return this.http
      .put<EquipmentResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  deactivate(id: string): Observable<EquipmentResponse> {
    return this.http
      .patch<EquipmentResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/deactivate`, {})
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  activate(id: string): Observable<EquipmentResponse> {
    return this.http
      .patch<EquipmentResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/activate`, {})
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  checkQrCodeTaken(qrCode: string, excludeId?: string): Observable<boolean> {
    const normalized = qrCode.trim();
    if (normalized.length < 3) {
      return of(false);
    }

    return this.getByQrCode(normalized).pipe(
      map((existing) => existing.id !== excludeId),
      catchError(() => of(false))
    );
  }
}

