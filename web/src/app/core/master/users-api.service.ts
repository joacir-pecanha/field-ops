import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PageResponse,
  UserCreateRequest,
  UserListQuery,
  UserResponse,
  UserUpdateRequest,
  buildHttpParams,
  mapMasterDataHttpError,
} from './master-data.models';

/**
 * Serviço HTTP tipado para gestão administrativa de Usuários (TASK-008 Passo 1).
 */
@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/v1/users`;

  list(query?: UserListQuery): Observable<PageResponse<UserResponse>> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<PageResponse<UserResponse>>(this.baseUrl, { params })
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  getById(id: string): Observable<UserResponse> {
    return this.http
      .get<UserResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  create(payload: UserCreateRequest): Observable<UserResponse> {
    return this.http
      .post<UserResponse>(this.baseUrl, payload)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  update(id: string, payload: UserUpdateRequest): Observable<UserResponse> {
    return this.http
      .put<UserResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload)
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  deactivate(id: string): Observable<UserResponse> {
    return this.http
      .patch<UserResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/deactivate`, {})
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  activate(id: string): Observable<UserResponse> {
    return this.http
      .patch<UserResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/activate`, {})
      .pipe(catchError((err) => throwError(() => mapMasterDataHttpError(err))));
  }

  checkEmailTaken(email: string, excludeId?: string): Observable<boolean> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return of(false);
    }

    return this.list({ search: normalized, page: 0, size: 20 }).pipe(
      map((page) =>
        page.content.some(
          (user) => user.email.toLowerCase() === normalized && user.id !== excludeId
        )
      ),
      catchError(() => of(false))
    );
  }
}

