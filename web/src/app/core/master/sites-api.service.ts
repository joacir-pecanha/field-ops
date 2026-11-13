import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EquipmentListQuery,
  EquipmentResponse,
  PageResponse,
  SiteListQuery,
  SiteRequest,
  SiteResponse,
  buildHttpParams,
  mapMasterDataHttpError,
} from './master-data.models';

/**
 * Serviço HTTP tipado para gestão de Locais de Inspeção (TASK-008 Passo 1).
 */
@Injectable({ providedIn: 'root' })
export class SitesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/v1/sites`;

  list(query?: SiteListQuery): Observable<PageResponse<SiteResponse>> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<PageResponse<SiteResponse>>(this.baseUrl, { params })
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  listByClient(clientId: string, activeOnly = false, size = 100): Observable<SiteResponse[]> {
    if (!clientId) {
      return of([]);
    }

    return this.list({
      clientId,
      active: activeOnly ? true : undefined,
      page: 0,
      size,
      sort: 'name,asc',
    }).pipe(map((page) => page.content));
  }

  getById(id: string): Observable<SiteResponse> {
    return this.http
      .get<SiteResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  listEquipments(
    siteId: string,
    query?: EquipmentListQuery
  ): Observable<PageResponse<EquipmentResponse>> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<PageResponse<EquipmentResponse>>(
        `${this.baseUrl}/${encodeURIComponent(siteId)}/equipments`,
        { params }
      )
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  create(payload: SiteRequest): Observable<SiteResponse> {
    return this.http
      .post<SiteResponse>(this.baseUrl, payload)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  update(id: string, payload: SiteRequest): Observable<SiteResponse> {
    return this.http
      .put<SiteResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  deactivate(id: string): Observable<SiteResponse> {
    return this.http
      .patch<SiteResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/deactivate`, {})
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  activate(id: string): Observable<SiteResponse> {
    return this.http
      .patch<SiteResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/activate`, {})
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  checkCodeTakenForClient(
    clientId: string,
    code: string,
    excludeId?: string
  ): Observable<boolean> {
    const normalized = code.trim().toLowerCase();
    if (!clientId || !normalized) {
      return of(false);
    }

    return this.list({ clientId, search: normalized, page: 0, size: 20 }).pipe(
      map((page) =>
        page.content.some(
          (site) =>
            Boolean(site.code) &&
            site.code!.toLowerCase() === normalized &&
            site.clientId === clientId &&
            site.id !== excludeId
        )
      ),
      catchError(() => of(false))
    );
  }
}

