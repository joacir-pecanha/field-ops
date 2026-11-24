import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  INSPECTION_STATUS_OPTIONS,
  InspectionDetailsResponse,
  InspectionStatus,
  NonConformitySeverity,
} from '../inspections/inspection.service';
import { MetricCardComponent } from './components/metric-card.component';
import { RecentInspectionsComponent } from './components/recent-inspections.component';
import { SeverityChartComponent } from './components/severity-chart.component';
import {
  DashboardApiError,
  DashboardMetricsResponse,
  DashboardService,
  createEmptyDashboardMetrics,
} from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MetricCardComponent,
    SeverityChartComponent,
    RecentInspectionsComponent,
  ],
  templateUrl: './dashboard.component.html',
  styles: [
    `
      .dashboard-page {
        display: grid;
        gap: 1.25rem;
      }

      .refresh-meta {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .updated-pill {
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        font-size: 0.77rem;
        font-weight: 600;
        color: #475569;
      }

      .shortcuts-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.85rem;
        flex-wrap: wrap;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.9rem;
        padding: 0.85rem 1.1rem;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
      }

      .shortcuts-actions {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .shortcut-count {
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.08);
        font-size: 0.74rem;
        font-weight: 700;
      }

      .btn-primary .shortcut-count {
        background: rgba(255, 255, 255, 0.22);
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(225px, 1fr));
        gap: 1rem;
      }

      .dashboard-grid {
        display: grid;
        gap: 1.15rem;
        align-items: start;
      }

      @media (min-width: 1120px) {
        .dashboard-grid {
          grid-template-columns: minmax(0, 1.65fr) minmax(330px, 0.95fr);
        }
      }

      .dashboard-side {
        display: grid;
        gap: 1.15rem;
        min-width: 0;
      }

      .status-summary-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.95rem;
        padding: 1.1rem 1.2rem;
        display: grid;
        gap: 0.8rem;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);

        h2 {
          margin: 0;
          font-size: 1rem;
          color: #0f172a;
        }
      }

      .status-chips-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
        gap: 0.55rem;
      }

      .status-chip-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.55rem 0.72rem;
        border-radius: 0.65rem;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        color: #1e293b;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;

        &:hover {
          background: #ffffff;
          border-color: #0f766e;
          color: #0f766e;
        }

        strong {
          font-variant-numeric: tabular-nums;
          font-size: 0.92rem;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.authService.currentUser;
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly metrics = signal<DashboardMetricsResponse>(createEmptyDashboardMetrics());
  readonly lastUpdatedAt = signal<string | null>(null);

  readonly operationalStatuses = INSPECTION_STATUS_OPTIONS.filter(
    (item) => item.value !== 'RASCUNHO'
  );

  readonly roleLabel = computed(() => {
    switch (this.currentUser()?.role) {
      case 'ADMIN':
        return 'Administrador';
      case 'SUPERVISOR':
        return 'Supervisor';
      default:
        return this.currentUser()?.role ?? 'Operação';
    }
  });

  readonly overdueSubtitle = computed(() => {
    const overdue = this.metrics().overdueCount;
    return overdue === 0
      ? 'Nenhuma inspeção em atraso no momento!'
      : `${overdue} ${overdue === 1 ? 'inspeção exige' : 'inspeções exigem'} atenção prioritária`;
  });

  ngOnInit(): void {
    this.loadMetrics(false);
  }

  refreshData(): void {
    this.loadMetrics(true);
  }

  openAllInspections(): void {
    void this.router.navigate(['/app/inspections']);
  }

  openByStatus(status: InspectionStatus): void {
    void this.router.navigate(['/app/inspections'], {
      queryParams: { status },
    });
  }

  openAwaitingReview(): void {
    void this.router.navigate(['/app/inspections'], {
      queryParams: { status: 'ENVIADA' },
    });
  }

  openOverdue(): void {
    void this.router.navigate(['/app/inspections'], {
      queryParams: { overdue: 'true' },
    });
  }

  openInspectionReview(inspection: InspectionDetailsResponse): void {
    void this.router.navigate(['/app/inspections', inspection.id, 'review']);
  }

  openSeverityInspections(_severity: NonConformitySeverity): void {
    void this.router.navigate(['/app/inspections']);
  }

  statusCount(status: InspectionStatus): number {
    return this.metrics().inspectionsByStatus?.[status] ?? 0;
  }

  private loadMetrics(forceRefresh: boolean): void {
    const hasLoadedBefore = this.lastUpdatedAt() !== null;
    if (forceRefresh && hasLoadedBefore) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }
    this.loadError.set(null);

    const request$ = forceRefresh
      ? this.dashboardService.refreshMetrics()
      : this.dashboardService.getMetrics();

    request$
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.refreshing.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          this.metrics.set(data);
          this.lastUpdatedAt.set(data.generatedAt || new Date().toISOString());
        },
        error: (err: unknown) => {
          const message =
            err instanceof DashboardApiError
              ? err.message
              : 'Não foi possível carregar os indicadores do painel operacional.';
          this.loadError.set(message);
        },
      });
  }
}
