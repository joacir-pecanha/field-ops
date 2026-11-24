import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MasterDataApiError, mapMasterDataHttpError } from '../../core/master/master-data.models';
import {
  InspectionDetailsResponse,
  InspectionStatus,
  NonConformitySeverity,
} from '../inspections/inspection.service';

export type NonConformitySeverityCounts = Record<NonConformitySeverity, number>;

export type InspectionsByStatusCounts = Partial<Record<InspectionStatus, number>> &
  Record<string, number>;

export interface DashboardMetricsResponse {
  totalInspections: number;
  inProgressCount: number;
  awaitingReviewCount: number;
  overdueCount: number;
  assignedCount: number;
  submittedCount: number;
  underReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  canceledCount: number;
  inspectionsByStatus: InspectionsByStatusCounts;
  totalNonConformities: number;
  nonConformitiesBySeverity: NonConformitySeverityCounts;
  recentInspections: InspectionDetailsResponse[];
  generatedAt: string;
}

export interface DashboardMetricsQueryOptions {
  forceRefresh?: boolean;
  recentLimit?: number;
}

export class DashboardApiError extends MasterDataApiError {
  constructor(
    message: string,
    status = 0,
    code = 'UNKNOWN',
    fieldErrors: Record<string, string> = {}
  ) {
    super(message, status, code, fieldErrors);
    this.name = 'DashboardApiError';
  }
}

export function mapDashboardHttpError(error: unknown): DashboardApiError {
  if (error instanceof DashboardApiError) {
    return error;
  }
  const baseError = mapMasterDataHttpError(error);
  return new DashboardApiError(
    baseError.message,
    baseError.status,
    baseError.code,
    baseError.fieldErrors
  );
}

export function createEmptyDashboardMetrics(): DashboardMetricsResponse {
  return {
    totalInspections: 0,
    inProgressCount: 0,
    awaitingReviewCount: 0,
    overdueCount: 0,
    assignedCount: 0,
    submittedCount: 0,
    underReviewCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    canceledCount: 0,
    inspectionsByStatus: {
      ATRIBUÍDA: 0,
      EM_ANDAMENTO: 0,
      ENVIADA: 0,
      EM_REVISÃO: 0,
      APROVADA: 0,
      REPROVADA: 0,
      CANCELADA: 0,
    },
    totalNonConformities: 0,
    nonConformitiesBySeverity: {
      BAIXA: 0,
      MEDIA: 0,
      ALTA: 0,
      CRITICA: 0,
    },
    recentInspections: [],
    generatedAt: new Date().toISOString(),
  };
}

interface MetricsCacheEntry {
  key: string;
  expiresAt: number;
  observable: Observable<DashboardMetricsResponse>;
}

/**
 * Serviço HTTP agregador do Dashboard operacional com cache em memória de curta duração (TASK-021).
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  static readonly CACHE_TTL_MS = 15_000;

  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly metricsUrl = `${this.apiBaseUrl}/api/v1/dashboard/metrics`;

  private cacheEntry: MetricsCacheEntry | null = null;

  getMetrics(options: DashboardMetricsQueryOptions = {}): Observable<DashboardMetricsResponse> {
    const recentLimit = this.normalizeRecentLimit(options.recentLimit);
    const cacheKey = `recentLimit=${recentLimit}`;
    const now = Date.now();

    if (
      !options.forceRefresh &&
      this.cacheEntry &&
      this.cacheEntry.key === cacheKey &&
      this.cacheEntry.expiresAt > now
    ) {
      return this.cacheEntry.observable;
    }

    const params = new HttpParams().set('recentLimit', String(recentLimit));
    const request$ = this.http
      .get<Partial<DashboardMetricsResponse>>(this.metricsUrl, { params })
      .pipe(
        map((payload) => this.normalizeMetrics(payload)),
        tap(() => {
          if (this.cacheEntry?.key === cacheKey) {
            this.cacheEntry.expiresAt = Date.now() + DashboardService.CACHE_TTL_MS;
          }
        }),
        catchError((err) => {
          if (this.cacheEntry?.key === cacheKey) {
            this.cacheEntry = null;
          }
          return throwError(() => mapDashboardHttpError(err));
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    this.cacheEntry = {
      key: cacheKey,
      expiresAt: now + DashboardService.CACHE_TTL_MS,
      observable: request$,
    };

    return request$;
  }

  refreshMetrics(recentLimit?: number): Observable<DashboardMetricsResponse> {
    return this.getMetrics({ forceRefresh: true, recentLimit });
  }

  invalidateCache(): void {
    this.cacheEntry = null;
  }

  private normalizeRecentLimit(recentLimit?: number): number {
    if (!recentLimit || !Number.isFinite(recentLimit) || recentLimit <= 0) {
      return 8;
    }
    return Math.min(Math.floor(recentLimit), 25);
  }

  private normalizeMetrics(payload: Partial<DashboardMetricsResponse> | null | undefined): DashboardMetricsResponse {
    const fallback = createEmptyDashboardMetrics();
    const rawSeverity = payload?.nonConformitiesBySeverity;
    const nonConformitiesBySeverity: NonConformitySeverityCounts = {
      BAIXA: this.safeCount(rawSeverity?.BAIXA),
      MEDIA: this.safeCount(rawSeverity?.MEDIA),
      ALTA: this.safeCount(rawSeverity?.ALTA),
      CRITICA: this.safeCount(rawSeverity?.CRITICA),
    };

    const rawStatusMap = payload?.inspectionsByStatus ?? {};
    const inspectionsByStatus: InspectionsByStatusCounts = {
      ...fallback.inspectionsByStatus,
      ...Object.fromEntries(
        Object.entries(rawStatusMap).map(([key, count]) => [key, this.safeCount(count)])
      ),
    };

    const totalNonConformities =
      payload?.totalNonConformities !== undefined
        ? this.safeCount(payload.totalNonConformities)
        : nonConformitiesBySeverity.BAIXA +
          nonConformitiesBySeverity.MEDIA +
          nonConformitiesBySeverity.ALTA +
          nonConformitiesBySeverity.CRITICA;

    return {
      totalInspections: this.safeCount(payload?.totalInspections),
      inProgressCount: this.safeCount(payload?.inProgressCount),
      awaitingReviewCount: this.safeCount(payload?.awaitingReviewCount),
      overdueCount: this.safeCount(payload?.overdueCount),
      assignedCount: this.safeCount(payload?.assignedCount),
      submittedCount: this.safeCount(payload?.submittedCount),
      underReviewCount: this.safeCount(payload?.underReviewCount),
      approvedCount: this.safeCount(payload?.approvedCount),
      rejectedCount: this.safeCount(payload?.rejectedCount),
      canceledCount: this.safeCount(payload?.canceledCount),
      inspectionsByStatus,
      totalNonConformities,
      nonConformitiesBySeverity,
      recentInspections: Array.isArray(payload?.recentInspections) ? payload.recentInspections : [],
      generatedAt: payload?.generatedAt || fallback.generatedAt,
    };
  }

  private safeCount(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
}
