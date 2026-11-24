import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { InspectionDetailsResponse } from '../inspections/inspection.service';
import { MetricCardComponent } from './components/metric-card.component';
import { RecentInspectionsComponent } from './components/recent-inspections.component';
import { SeverityChartComponent } from './components/severity-chart.component';
import { DashboardComponent } from './dashboard.component';
import {
  DashboardApiError,
  DashboardMetricsResponse,
  DashboardService,
  createEmptyDashboardMetrics,
} from './dashboard.service';

describe('Dashboard Module (TASK-021)', () => {
  const supervisorUser: AuthUser = {
    id: 'sup-1',
    name: 'Supervisor Operacional',
    email: 'supervisor@fieldops.com',
    role: 'SUPERVISOR',
    status: 'ACTIVE',
  };

  function makeInspectionSummary(
    overrides: Partial<InspectionDetailsResponse> = {}
  ): InspectionDetailsResponse {
    return {
      id: 'insp-1',
      title: 'Inspeção Preventiva — Gerador GD-001',
      instructions: null,
      status: 'ENVIADA',
      priority: 'ALTA',
      templateId: 'tpl-1',
      templateCode: 'TPL-GER-01',
      templateTitle: 'Checklist Preventivo',
      templateCategory: 'MECANICA',
      templateVersionId: 'ver-1',
      templateVersion: 1,
      templateVersionNumber: 1,
      clientId: 'cli-1',
      clientCode: 'CLI-ALFA',
      clientName: 'Indústria Alfa',
      siteId: 'site-1',
      siteCode: 'SITE-01',
      siteName: 'Planta Sorocaba',
      siteAddress: null,
      equipmentId: 'eqp-1',
      equipmentCode: 'EQP-01',
      equipmentName: 'Gerador Diesel GD-001',
      equipmentQrCode: 'QR-01',
      technicianId: 'tech-1',
      technicianName: 'Carlos Técnico',
      technicianEmail: 'tecnico@fieldops.com',
      supervisorId: 'sup-1',
      supervisorName: 'Supervisor Operacional',
      createdBy: 'sup-1',
      scheduledFor: '2026-11-24T10:00:00Z',
      dueDate: '2026-11-24T10:00:00Z',
      overdue: false,
      startedAtDevice: null,
      startedAtServer: null,
      completedAtDevice: null,
      submittedAtServer: '2026-11-24T11:30:00Z',
      approvedAt: null,
      canceledAt: null,
      canceledBy: null,
      canceledReason: null,
      totalItems: 8,
      items: [],
      createdAt: '2026-11-24T08:00:00Z',
      updatedAt: '2026-11-24T11:30:00Z',
      version: 1,
      ...overrides,
    };
  }

  function makeDashboardMetrics(
    overrides: Partial<DashboardMetricsResponse> = {}
  ): DashboardMetricsResponse {
    return {
      totalInspections: 14,
      inProgressCount: 3,
      awaitingReviewCount: 4,
      overdueCount: 2,
      assignedCount: 3,
      submittedCount: 3,
      underReviewCount: 1,
      approvedCount: 3,
      rejectedCount: 1,
      canceledCount: 0,
      inspectionsByStatus: {
        ATRIBUÍDA: 3,
        EM_ANDAMENTO: 3,
        ENVIADA: 3,
        EM_REVISÃO: 1,
        APROVADA: 3,
        REPROVADA: 1,
        CANCELADA: 0,
      },
      totalNonConformities: 10,
      nonConformitiesBySeverity: {
        BAIXA: 4,
        MEDIA: 3,
        ALTA: 2,
        CRITICA: 1,
      },
      recentInspections: [
        makeInspectionSummary({ id: 'insp-1', status: 'ENVIADA', overdue: false }),
        makeInspectionSummary({
          id: 'insp-2',
          title: 'Inspeção Atrasada — Compressor CP-002',
          status: 'ATRIBUÍDA',
          overdue: true,
        }),
      ],
      generatedAt: '2026-11-24T15:30:00Z',
      ...overrides,
    };
  }

  describe('DashboardService', () => {
    let service: DashboardService;
    let httpMock: HttpTestingController;
    const baseMetricsUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/v1/dashboard/metrics`;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      service = TestBed.inject(DashboardService);
      httpMock = TestBed.inject(HttpTestingController);
      service.invalidateCache();
    });

    afterEach(() => {
      httpMock.verify();
      service.invalidateCache();
    });

    it('should fetch /api/v1/dashboard/metrics and reuse short-lived cache until forceRefresh (Passo 2)', () => {
      const payload = makeDashboardMetrics();
      let firstResult: DashboardMetricsResponse | undefined;
      let secondResult: DashboardMetricsResponse | undefined;

      service.getMetrics().subscribe((res) => (firstResult = res));

      const req1 = httpMock.expectOne(`${baseMetricsUrl}?recentLimit=8`);
      expect(req1.request.method).toBe('GET');
      req1.flush(payload);

      // Segunda chamada dentro do TTL reutiliza cache sem nova requisição HTTP
      service.getMetrics().subscribe((res) => (secondResult = res));
      httpMock.expectNone(`${baseMetricsUrl}?recentLimit=8`);

      expect(firstResult?.totalInspections).toBe(14);
      expect(secondResult?.awaitingReviewCount).toBe(4);

      // refreshMetrics força nova chamada ignorando cache
      let refreshedResult: DashboardMetricsResponse | undefined;
      service.refreshMetrics().subscribe((res) => (refreshedResult = res));

      const req2 = httpMock.expectOne(`${baseMetricsUrl}?recentLimit=8`);
      req2.flush(makeDashboardMetrics({ totalInspections: 15 }));
      expect(refreshedResult?.totalInspections).toBe(15);
    });

    it('should invalidate cache on HTTP error so retries hit the API (EX-02)', () => {
      let capturedError: unknown;
      service.getMetrics().subscribe({
        error: (err) => (capturedError = err),
      });

      const req1 = httpMock.expectOne(`${baseMetricsUrl}?recentLimit=8`);
      req1.flush(
        { detail: 'Serviço temporariamente indisponível', code: 'SERVICE_UNAVAILABLE' },
        { status: 503, statusText: 'Service Unavailable' }
      );

      expect(capturedError instanceof DashboardApiError).toBeTrue();

      let recovered: DashboardMetricsResponse | undefined;
      service.getMetrics().subscribe((res) => (recovered = res));
      const req2 = httpMock.expectOne(`${baseMetricsUrl}?recentLimit=8`);
      req2.flush(makeDashboardMetrics());
      expect(recovered?.totalInspections).toBe(14);
    });
  });

  describe('MetricCardComponent', () => {
    let fixture: ComponentFixture<MetricCardComponent>;
    let component: MetricCardComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [MetricCardComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(MetricCardComponent);
      component = fixture.componentInstance;
      component.label = 'Aguardando Revisão';
      component.value = 7;
      component.subtitle = '5 enviadas para análise';
      component.testId = 'metric-card-awaiting-review';
    });

    it('should show skeleton loader while loading and render metric when loaded (RT-02)', () => {
      component.loading = true;
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="metric-card-awaiting-review-skeleton"]')
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="metric-card-awaiting-review"]')
      ).toBeNull();

      component.loading = false;
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector(
        '[data-testid="metric-card-awaiting-review"]'
      ) as HTMLElement;
      expect(card).not.toBeNull();
      expect(card.textContent).toContain('Aguardando Revisão');
      expect(card.querySelector('[data-testid="metric-card-value"]')?.textContent?.trim()).toBe('7');

      const clickSpy = spyOn(component.cardClick, 'emit');
      card.click();
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('SeverityChartComponent', () => {
    let fixture: ComponentFixture<SeverityChartComponent>;
    let component: SeverityChartComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SeverityChartComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(SeverityChartComponent);
      component = fixture.componentInstance;
    });

    it('should render accurate counts and percentages for all 4 severities (RF-02 / CA-03)', () => {
      component.counts = { CRITICA: 1, ALTA: 2, MEDIA: 3, BAIXA: 4 };
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="severity-total-count"]')?.textContent).toContain(
        '10 ocorrências'
      );
      expect(el.querySelector('[data-testid="severity-count-CRITICA"]')?.textContent?.trim()).toBe(
        '1'
      );
      expect(el.querySelector('[data-testid="severity-count-ALTA"]')?.textContent?.trim()).toBe(
        '2'
      );
      expect(el.querySelector('[data-testid="severity-count-MEDIA"]')?.textContent?.trim()).toBe(
        '3'
      );
      expect(el.querySelector('[data-testid="severity-count-BAIXA"]')?.textContent?.trim()).toBe(
        '4'
      );
      expect(el.querySelector('[data-testid="severity-empty-message"]')).toBeNull();
    });

    it('should display zero counts and encouraging message when no non-conformities exist (EX-01)', () => {
      component.counts = { CRITICA: 0, ALTA: 0, MEDIA: 0, BAIXA: 0 };
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="severity-empty-message"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="severity-count-CRITICA"]')?.textContent?.trim()).toBe(
        '0'
      );
    });
  });

  describe('RecentInspectionsComponent', () => {
    let fixture: ComponentFixture<RecentInspectionsComponent>;
    let component: RecentInspectionsComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [RecentInspectionsComponent],
        providers: [provideRouter([])],
      }).compileComponents();

      fixture = TestBed.createComponent(RecentInspectionsComponent);
      component = fixture.componentInstance;
      component.inspections = [
        makeInspectionSummary({ id: 'insp-10', status: 'ENVIADA', overdue: true }),
      ];
      fixture.detectChanges();
    });

    it('should emit statusClick when clicking status badge and inspectionClick when clicking row (RF-04)', () => {
      const statusSpy = spyOn(component.statusClick, 'emit');
      const inspectionSpy = spyOn(component.inspectionClick, 'emit');

      const badgeBtn = fixture.nativeElement.querySelector(
        '[data-testid="recent-status-badge-trigger"]'
      ) as HTMLButtonElement;
      badgeBtn.click();

      expect(statusSpy).toHaveBeenCalledWith('ENVIADA');
      expect(inspectionSpy).not.toHaveBeenCalled();

      const row = fixture.nativeElement.querySelector(
        '[data-testid="recent-inspection-row"]'
      ) as HTMLElement;
      row.click();

      expect(inspectionSpy).toHaveBeenCalledTimes(1);
      expect(inspectionSpy.calls.mostRecent().args[0]?.id).toBe('insp-10');
    });
  });

  describe('DashboardComponent', () => {
    let fixture: ComponentFixture<DashboardComponent>;
    let component: DashboardComponent;
    let router: Router;
    let dashboardServiceMock: jasmine.SpyObj<DashboardService>;

    beforeEach(async () => {
      const userSignal = signal<AuthUser | null>(supervisorUser);
      const authServiceMock = jasmine.createSpyObj<AuthService>('AuthService', [], {
        currentUser: userSignal.asReadonly(),
      });

      dashboardServiceMock = jasmine.createSpyObj<DashboardService>('DashboardService', [
        'getMetrics',
        'refreshMetrics',
        'invalidateCache',
      ]);

      await TestBed.configureTestingModule({
        imports: [DashboardComponent],
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: authServiceMock },
          { provide: DashboardService, useValue: dashboardServiceMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      spyOn(router, 'navigate').and.resolveTo(true);
    });

    it('should show metric skeletons while loading and render all 4 main cards once loaded (CA-01, RT-02)', () => {
      const pending$ = new Subject<DashboardMetricsResponse>();
      dashboardServiceMock.getMetrics.and.returnValue(pending$.asObservable());

      fixture = TestBed.createComponent(DashboardComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="metric-card-total-skeleton"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="metric-card-in-progress-skeleton"]')).not.toBeNull();
      expect(
        el.querySelector('[data-testid="metric-card-awaiting-review-skeleton"]')
      ).not.toBeNull();
      expect(el.querySelector('[data-testid="metric-card-overdue-skeleton"]')).not.toBeNull();

      pending$.next(makeDashboardMetrics());
      pending$.complete();
      fixture.detectChanges();

      expect(
        el.querySelector('[data-testid="metric-card-total"] [data-testid="metric-card-value"]')
          ?.textContent?.trim()
      ).toBe('14');
      expect(
        el.querySelector(
          '[data-testid="metric-card-in-progress"] [data-testid="metric-card-value"]'
        )?.textContent?.trim()
      ).toBe('3');
      expect(
        el.querySelector(
          '[data-testid="metric-card-awaiting-review"] [data-testid="metric-card-value"]'
        )?.textContent?.trim()
      ).toBe('4');
      expect(
        el.querySelector('[data-testid="metric-card-overdue"] [data-testid="metric-card-value"]')
          ?.textContent?.trim()
      ).toBe('2');
    });

    it('should navigate to filtered inspections list when clicking "Aguardando Revisão" card and quick shortcuts (CA-02, RF-03)', () => {
      dashboardServiceMock.getMetrics.and.returnValue(of(makeDashboardMetrics()));

      fixture = TestBed.createComponent(DashboardComponent);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const awaitingCard = el.querySelector(
        '[data-testid="metric-card-awaiting-review"]'
      ) as HTMLElement;
      awaitingCard.click();

      expect(router.navigate).toHaveBeenCalledWith(['/app/inspections'], {
        queryParams: { status: 'ENVIADA' },
      });

      const overdueShortcut = el.querySelector(
        '[data-testid="shortcut-view-overdue"]'
      ) as HTMLButtonElement;
      overdueShortcut.click();

      expect(router.navigate).toHaveBeenCalledWith(['/app/inspections'], {
        queryParams: { overdue: 'true' },
      });

      const newShortcut = el.querySelector(
        '[data-testid="shortcut-new-inspection"]'
      ) as HTMLAnchorElement;
      expect(newShortcut.getAttribute('href')).toContain('/app/inspections/new');
    });

    it('should display zero counters and encouraging message when no overdue or operational data exists (EX-01)', () => {
      dashboardServiceMock.getMetrics.and.returnValue(of(createEmptyDashboardMetrics()));

      fixture = TestBed.createComponent(DashboardComponent);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(
        el.querySelector('[data-testid="no-overdue-encouragement"]')?.textContent
      ).toContain('Nenhuma inspeção em atraso no momento!');
      expect(
        el.querySelector('[data-testid="metric-card-overdue"]')?.textContent
      ).toContain('Nenhuma inspeção em atraso no momento!');
      expect(el.querySelector('[data-testid="recent-inspections-empty"]')).not.toBeNull();
    });

    it('should show error banner with "Tentar Novamente" button without breaking layout and recover on retry (EX-02, RF-05)', () => {
      dashboardServiceMock.getMetrics.and.returnValue(
        throwError(() => new DashboardApiError('Falha ao consultar API', 500, 'INTERNAL_ERROR'))
      );
      dashboardServiceMock.refreshMetrics.and.returnValue(of(makeDashboardMetrics()));

      fixture = TestBed.createComponent(DashboardComponent);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const banner = el.querySelector('[data-testid="dashboard-error-banner"]') as HTMLElement;
      expect(banner).not.toBeNull();
      expect(banner.textContent).toContain('Falha ao consultar API');
      // Layout dos 4 cards permanece renderizado mesmo após erro
      expect(el.querySelector('[data-testid="metric-card-total"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="metric-card-overdue"]')).not.toBeNull();

      const retryBtn = el.querySelector(
        '[data-testid="dashboard-retry-btn"]'
      ) as HTMLButtonElement;
      expect(retryBtn.textContent).toContain('Tentar Novamente');
      retryBtn.click();
      fixture.detectChanges();

      expect(dashboardServiceMock.refreshMetrics).toHaveBeenCalledTimes(1);
      expect(el.querySelector('[data-testid="dashboard-error-banner"]')).toBeNull();
      expect(
        el.querySelector('[data-testid="metric-card-total"] [data-testid="metric-card-value"]')
          ?.textContent?.trim()
      ).toBe('14');
    });

    it('should navigate directly to inspection review when clicking a recent activity row (RF-04)', () => {
      dashboardServiceMock.getMetrics.and.returnValue(of(makeDashboardMetrics()));

      fixture = TestBed.createComponent(DashboardComponent);
      fixture.detectChanges();

      const row = fixture.nativeElement.querySelector(
        '[data-testid="recent-inspection-row"]'
      ) as HTMLElement;
      row.click();

      expect(router.navigate).toHaveBeenCalledWith(['/app/inspections', 'insp-1', 'review']);
    });
  });
});
