import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClientListQuery,
  ClientRequest,
  ClientResponse,
  PageResponse,
  SiteListQuery,
  SiteResponse,
  buildHttpParams,
  mapMasterDataHttpError,
} from './master-data.models';

/**
 * Serviço HTTP tipado para gestão de Clientes (TASK-008 Passo 1).
 */
@Injectable({ providedIn: 'root' })
export class ClientsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/v1/clients`;

  list(query?: ClientListQuery): Observable<PageResponse<ClientResponse>> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<PageResponse<ClientResponse>>(this.baseUrl, { params })
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  listActive(search?: string, size = 100): Observable<ClientResponse[]> {
    return this.list({
      search,
      active: true,
      page: 0,
      size,
      sort: 'name,asc',
    }).pipe(map((page) => page.content));
  }

  getById(id: string): Observable<ClientResponse> {
    return this.http
      .get<ClientResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  listSites(clientId: string, query?: SiteListQuery): Observable<PageResponse<SiteResponse>> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<PageResponse<SiteResponse>>(`${this.baseUrl}/${encodeURIComponent(clientId)}/sites`, {
        params,
      })
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  create(payload: ClientRequest): Observable<ClientResponse> {
    return this.http
      .post<ClientResponse>(this.baseUrl, payload)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  update(id: string, payload: ClientRequest): Observable<ClientResponse> {
    return this.http
      .put<ClientResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  deactivate(id: string): Observable<ClientResponse> {
    return this.http
      .patch<ClientResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/deactivate`, {})
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  activate(id: string): Observable<ClientResponse> {
    return this.http
      .patch<ClientResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/activate`, {})
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  checkCodeTaken(code: string, excludeId?: string): Observable<boolean> {
    const normalized = code.trim().toLowerCase();
    if (!normalized) {
      return of(false);
    }

    return this.list({ search: normalized, page: 0, size: 20 }).pipe(
      map((page) =>
        page.content.some(
          (client) =>
            Boolean(client.code) &&
            client.code!.toLowerCase() === normalized &&
            client.id !== excludeId
        )
      ),
      catchError(() => of(false))
    );
  }
}

