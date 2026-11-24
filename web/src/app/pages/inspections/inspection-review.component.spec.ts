import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { ChecklistReviewTreeComponent } from './components/checklist-review-tree.component';
import { EvidenceLightboxComponent } from './components/evidence-lightbox.component';
import { LocationMapComponent } from './components/location-map.component';
import {
  ApprovalModalComponent,
  RejectionModalComponent,
} from './components/rejection-modal.component';
import { InspectionReviewComponent } from './inspection-review.component';
import {
  InspectionApiError,
  InspectionDetailsResponse,
  InspectionEvidenceDto,
  InspectionItemSnapshotResponse,
  InspectionNonConformityDto,
  InspectionResponseReviewDto,
  InspectionService,
  isInspectionActionLocked,
  sortNonConformitiesBySeverity,
} from './inspection.service';

describe('Inspection Review Module (TASK-020)', () => {
  const TINY_PNG_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  function makeSnapshotItem(
    overrides: Partial<InspectionItemSnapshotResponse> = {}
  ): InspectionItemSnapshotResponse {
    return {
      id: 'item-1',
      inspectionId: 'insp-1',
      sourceTemplateItemId: 'tpl-item-1',
      sectionTitle: 'Inspeção Visual e Segurança',
      sectionDescription: 'Verificações iniciais antes da partida',
      sectionOrder: 0,
      itemCode: 'GER-01',
      itemTitle: 'Lacre e integridade externa do equipamento',
      itemDescription: 'Confirmar ausência de avarias na carenagem.',
      responseType: 'CONFORMITY',
      required: true,
      observationRequiredOnFailure: true,
      evidenceRequiredOnFailure: true,
      rulesJson: null,
      options: [],
      optionsJson: null,
      itemOrder: 0,
      createdAt: '2026-11-22T10:00:00Z',
      ...overrides,
    };
  }

  function makeResponse(
    overrides: Partial<InspectionResponseReviewDto> = {}
  ): InspectionResponseReviewDto {
    return {
      id: 'resp-1',
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      valueRaw: 'NON_CONFORMING',
      valueText: null,
      valueNumber: null,
      valueBoolean: null,
      valueDate: null,
      valueJson: null,
      observation: 'Lacre lateral rompido e sinais de vibração.',
      conformity: 'NON_CONFORMING',
      nonConformity: true,
      nonConformityDescription: 'Necessária substituição imediata do lacre.',
      latitude: -23.5015,
      longitude: -47.4525,
      accuracy: 8.5,
      answeredBy: 'tech-1',
      answeredAtDevice: '2026-11-22T12:15:00Z',
      serverReceivedAt: '2026-11-22T12:20:00Z',
      adminAdjusted: false,
      adminAdjustedValue: null,
      adminAdjustmentReason: null,
      adminAdjustedBy: null,
      adminAdjustedByName: null,
      adminAdjustedAt: null,
      createdAt: '2026-11-22T12:20:00Z',
      updatedAt: '2026-11-22T12:20:00Z',
      version: 0,
      ...overrides,
    };
  }

  function makeNonConformity(
    overrides: Partial<InspectionNonConformityDto> = {}
  ): InspectionNonConformityDto {
    return {
      id: 'nc-1',
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      responseId: 'resp-1',
      itemTitle: 'Lacre e integridade externa do equipamento',
      title: 'Lacre violado na carenagem',
      description: 'Carenagem com trava solta no lado direito.',
      severity: 'ALTA',
      status: 'OPEN',
      canceledReason: null,
      createdBy: 'tech-1',
      createdAtDevice: '2026-11-22T12:16:00Z',
      serverReceivedAt: '2026-11-22T12:20:00Z',
      createdAt: '2026-11-22T12:20:00Z',
      updatedAt: '2026-11-22T12:20:00Z',
      version: 0,
      ...overrides,
    };
  }

  function makeEvidence(overrides: Partial<InspectionEvidenceDto> = {}): InspectionEvidenceDto {
    return {
      evidence_id: 'ev-1',
      inspection_id: 'insp-1',
      inspection_item_id: 'item-1',
      response_id: 'resp-1',
      non_conformity_id: null,
      file_name: 'ev-1.png',
      original_file_name: 'painel-lacre.png',
      mime_type: 'image/png',
      size_bytes: 2048,
      status: 'UPLOADED',
      client_timestamp: '2026-11-22T12:15:30Z',
      url: TINY_PNG_DATA_URL,
      ...overrides,
    };
  }

  function makeReviewInspection(
    overrides: Partial<InspectionDetailsResponse> = {}
  ): InspectionDetailsResponse {
    const items: InspectionItemSnapshotResponse[] = [
      makeSnapshotItem({ id: 'item-1', sectionOrder: 0, itemOrder: 0 }),
      makeSnapshotItem({
        id: 'item-2',
        sectionTitle: 'Medições e Evidências',
        sectionOrder: 1,
        itemCode: 'GER-04',
        itemTitle: 'Horímetro atual (horas)',
        itemDescription: null,
        responseType: 'NUMBER',
        itemOrder: 0,
      }),
      makeSnapshotItem({
        id: 'item-3',
        sectionTitle: 'Medições e Evidências',
        sectionOrder: 1,
        itemCode: 'GER-03',
        itemTitle: 'Modo de operação selecionado no painel',
        itemDescription: null,
        responseType: 'SINGLE_CHOICE',
        options: ['Automático', 'Manual', 'Desligado'],
        itemOrder: 1,
      }),
    ];

    const responses: InspectionResponseReviewDto[] = [
      makeResponse({ id: 'resp-1', inspectionItemId: 'item-1' }),
      makeResponse({
        id: 'resp-2',
        inspectionItemId: 'item-2',
        valueRaw: '1420',
        valueNumber: 1420,
        conformity: null,
        nonConformity: false,
        nonConformityDescription: null,
        observation: 'Leitura confirmada no visor.',
      }),
      makeResponse({
        id: 'resp-3',
        inspectionItemId: 'item-3',
        valueRaw: 'Automático',
        valueText: 'Automático',
        conformity: null,
        nonConformity: false,
        nonConformityDescription: null,
        observation: null,
      }),
    ];

    return {
      id: 'insp-1',
      title: 'Inspeção Preventiva — Gerador 01',
      instructions: 'Validar integridade elétrica e mecânica.',
      status: 'EM_REVISÃO',
      priority: 'ALTA',
      templateId: 'tpl-1',
      templateCode: 'TPL-GER-01',
      templateTitle: 'Checklist Preventivo de Gerador Diesel',
      templateCategory: 'MECANICA',
      templateVersionId: 'ver-1',
      templateVersion: 2,
      templateVersionNumber: 2,
      clientId: 'cli-1',
      clientCode: 'CLI-ALFA',
      clientName: 'Indústria Alfa S.A.',
      siteId: 'site-1',
      siteCode: 'SITE-SOR-01',
      siteName: 'Planta Sorocaba',
      siteAddress: 'Av. Industrial, 1200 - Sorocaba/SP',
      equipmentId: 'eqp-1',
      equipmentCode: 'EQP-GD-001',
      equipmentName: 'Gerador Diesel GD-001',
      equipmentQrCode: 'QR-FIELDOPS-GD001',
      technicianId: 'tech-1',
      technicianName: 'Carlos Técnico',
      technicianEmail: 'tecnico@fieldops.com',
      supervisorId: 'sup-1',
      supervisorName: 'Supervisor Operacional',
      createdBy: 'sup-1',
      scheduledFor: '2026-11-22T09:00:00Z',
      dueDate: '2026-11-22T09:00:00Z',
      overdue: false,
      startedAtDevice: '2026-11-22T12:00:00Z',
      startedAtServer: '2026-11-22T12:01:00Z',
      completedAtDevice: '2026-11-22T12:45:00Z',
      submittedAtServer: '2026-11-22T12:46:00Z',
      reviewStartedAt: '2026-11-22T13:00:00Z',
      reviewStartedBy: 'sup-1',
      approvedAt: null,
      approvedBy: null,
      approvedByName: null,
      reviewComments: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectedByName: null,
      rejectionReason: null,
      rejection_reason: null,
      reviewCycle: 1,
      startLatitude: -23.50153,
      startLongitude: -47.45256,
      startAccuracy: 9.2,
      completeLatitude: -23.5019,
      completeLongitude: -47.4521,
      completeAccuracy: 7.4,
      canceledAt: null,
      canceledBy: null,
      canceledReason: null,
      totalItems: items.length,
      items,
      responses,
      nonConformities: [
        makeNonConformity({ id: 'nc-low', title: 'Pintura arranhada', severity: 'BAIXA' }),
        makeNonConformity({ id: 'nc-crit', title: 'Vazamento crítico de óleo', severity: 'CRITICA' }),
        makeNonConformity({ id: 'nc-high', title: 'Lacre rompido', severity: 'ALTA' }),
      ],
      evidences: [
        makeEvidence({ evidence_id: 'ev-1', inspection_item_id: 'item-1', original_file_name: 'lacre.png' }),
        makeEvidence({
          evidence_id: 'ev-2',
          inspection_item_id: 'item-2',
          response_id: 'resp-2',
          original_file_name: 'horimetro.png',
        }),
      ],
      reviews: [
        {
          id: 'rev-1',
          inspectionId: 'insp-1',
          reviewerId: 'sup-1',
          reviewerName: 'Supervisor Operacional',
          decision: 'REVIEW_STARTED',
          reason: null,
          comments: null,
          reviewedAt: '2026-11-22T13:00:00Z',
          reviewCycle: 1,
          createdAt: '2026-11-22T13:00:00Z',
        },
      ],
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-22T13:00:00Z',
      version: 2,
      ...overrides,
    };
  }

  describe('InspectionService (métodos de revisão e utilitários — Passo 1)', () => {
    let service: InspectionService;
    let httpMock: HttpTestingController;
    const baseUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/v1/inspections`;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      service = TestBed.inject(InspectionService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('consulta revisão completa, inicia revisão, aprova, reprova e consulta histórico', () => {
      const sample = makeReviewInspection();

      service.getReviewDetails('insp-1').subscribe((res) => expect(res.id).toBe('insp-1'));
      const getReq = httpMock.expectOne(`${baseUrl}/insp-1`);
      expect(getReq.request.method).toBe('GET');
      getReq.flush(sample);

      service.startReview('insp-1').subscribe((res) => expect(res.status).toBe('EM_REVISÃO'));
      const startReq = httpMock.expectOne(`${baseUrl}/insp-1/start-review`);
      expect(startReq.request.method).toBe('POST');
      startReq.flush({ ...sample, status: 'EM_REVISÃO' });

      service.approve('insp-1', { comments: 'Tudo conforme' }).subscribe((res) => {
        expect(res.status).toBe('APROVADA');
      });
      const approveReq = httpMock.expectOne(`${baseUrl}/insp-1/approve`);
      expect(approveReq.request.method).toBe('POST');
      expect(approveReq.request.body).toEqual({ comments: 'Tudo conforme' });
      approveReq.flush({ ...sample, status: 'APROVADA' });

      service
        .reject('insp-1', { rejection_reason: 'Foto borrada' })
        .subscribe((res) => expect(res.status).toBe('REPROVADA'));
      const rejectReq = httpMock.expectOne(`${baseUrl}/insp-1/reject`);
      expect(rejectReq.request.method).toBe('POST');
      expect(rejectReq.request.body).toEqual({ rejection_reason: 'Foto borrada' });
      rejectReq.flush({ ...sample, status: 'REPROVADA' });

      service.getReviewHistory('insp-1').subscribe((res) => expect(res.length).toBe(1));
      const historyReq = httpMock.expectOne(`${baseUrl}/insp-1/reviews`);
      expect(historyReq.request.method).toBe('GET');
      historyReq.flush(sample.reviews ?? []);
    });

    it('ordena não conformidades por severidade (CRITICA -> ALTA -> MEDIA -> BAIXA) e verifica bloqueio RT-03', () => {
      const sorted = sortNonConformitiesBySeverity([
        makeNonConformity({ id: '1', severity: 'BAIXA' }),
        makeNonConformity({ id: '2', severity: 'MEDIA' }),
        makeNonConformity({ id: '3', severity: 'CRITICA' }),
        makeNonConformity({ id: '4', severity: 'ALTA' }),
      ]);
      expect(sorted.map((item) => item.severity)).toEqual(['CRITICA', 'ALTA', 'MEDIA', 'BAIXA']);

      expect(isInspectionActionLocked('APROVADA')).toBeTrue();
      expect(isInspectionActionLocked('CANCELADA')).toBeTrue();
      expect(isInspectionActionLocked('EM_REVISÃO')).toBeFalse();
      expect(isInspectionActionLocked('ENVIADA')).toBeFalse();
    });
  });

  describe('ChecklistReviewTreeComponent (Passo 2)', () => {
    let fixture: ComponentFixture<ChecklistReviewTreeComponent>;
    let component: ChecklistReviewTreeComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ChecklistReviewTreeComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(ChecklistReviewTreeComponent);
      component = fixture.componentInstance;
    });

    it('agrupa itens por seção preservando snapshot, formata respostas tipadas, ajustes e emite seleção de foto', () => {
      const detail = makeReviewInspection();
      detail.items.push(
        makeSnapshotItem({
          id: 'item-unanswered',
          sectionTitle: 'Medições e Evidências',
          sectionOrder: 1,
          itemCode: 'GER-05',
          itemTitle: 'Data da última troca de óleo',
          responseType: 'DATE',
          required: false,
          itemOrder: 2,
        })
      );
      detail.responses![1].adminAdjusted = true;
      detail.responses![1].adminAdjustedValue = '1425';
      detail.responses![1].adminAdjustmentReason = 'Corrigido após conferência de foto.';
      detail.responses![1].adminAdjustedByName = 'Supervisor Operacional';

      const selectedSpy = spyOn(component.evidenceSelected, 'emit');

      component.items = detail.items;
      component.responses = detail.responses ?? [];
      component.evidences = detail.evidences ?? [];
      component.nonConformities = detail.nonConformities ?? [];
      component.ngOnChanges({
        items: { currentValue: component.items, previousValue: [], firstChange: true, isFirstChange: () => true },
      });
      fixture.detectChanges();

      const sections = fixture.nativeElement.querySelectorAll(
        '[data-testid="checklist-section"]'
      ) as NodeListOf<HTMLElement>;
      expect(sections.length).toBe(2);

      const answers = fixture.nativeElement.querySelectorAll(
        '[data-testid="item-answer-value"]'
      ) as NodeListOf<HTMLElement>;
      expect(answers[0].textContent?.trim()).toBe('Não Conforme');
      expect(answers[1].textContent?.trim()).toBe('1420');
      expect(answers[2].textContent?.trim()).toBe('Automático');

      expect(
        fixture.nativeElement.querySelector('[data-testid="item-unanswered-badge"]')
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="item-observation"]')?.textContent
      ).toContain('Lacre lateral rompido');
      expect(
        fixture.nativeElement.querySelector('[data-testid="item-admin-adjustment"]')?.textContent
      ).toContain('1425');

      const firstThumb = fixture.nativeElement.querySelector(
        '[data-testid="item-evidence-thumb"]'
      ) as HTMLButtonElement;
      firstThumb.click();
      expect(selectedSpy).toHaveBeenCalledTimes(1);
      expect(selectedSpy.calls.mostRecent().args[0]?.index).toBe(0);
    });

    it('exibe placeholder amigável quando a imagem da miniatura falha ao carregar (EX-02)', () => {
      component.items = [makeSnapshotItem()];
      component.responses = [makeResponse()];
      component.evidences = [
        makeEvidence({ evidence_id: 'ev-broken', url: 'invalid://broken-image.jpg' }),
      ];
      component.ngOnChanges({
        items: { currentValue: component.items, previousValue: [], firstChange: true, isFirstChange: () => true },
      });
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector(
        '[data-testid="item-evidence-img"]'
      ) as HTMLImageElement;
      expect(img).not.toBeNull();
      img.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      const fallback = fixture.nativeElement.querySelector(
        '[data-testid="evidence-image-fallback"]'
      ) as HTMLElement;
      expect(fallback).not.toBeNull();
      expect(fallback.textContent).toContain('Imagem indisponível');
    });
  });

  describe('EvidenceLightboxComponent (Passo 3)', () => {
    let fixture: ComponentFixture<EvidenceLightboxComponent>;
    let component: EvidenceLightboxComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [EvidenceLightboxComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(EvidenceLightboxComponent);
      component = fixture.componentInstance;
    });

    it('exibe foto em alta resolução, suporta zoom e navegação entre fotos (CA-02)', () => {
      const indexChangeSpy = spyOn(component.indexChange, 'emit');
      component.open = true;
      component.evidences = [
        makeEvidence({ evidence_id: 'ev-1', original_file_name: 'foto-1.png' }),
        makeEvidence({ evidence_id: 'ev-2', original_file_name: 'foto-2.png' }),
      ];
      component.activeIndex = 0;
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="evidence-lightbox-modal"]')
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="lightbox-counter"]')?.textContent
      ).toContain('Foto 1 de 2');

      const zoomInBtn = fixture.nativeElement.querySelector(
        '[data-testid="lightbox-zoom-in-btn"]'
      ) as HTMLButtonElement;
      zoomInBtn.click();
      fixture.detectChanges();
      expect(component.zoomLevel()).toBe(1.5);

      const nextBtn = fixture.nativeElement.querySelector(
        '[data-testid="lightbox-next-btn"]'
      ) as HTMLButtonElement;
      nextBtn.click();
      expect(indexChangeSpy).toHaveBeenCalledWith(1);
    });

    it('exibe placeholder amigável no lightbox quando imagem falha ao carregar (EX-02)', () => {
      component.open = true;
      component.evidences = [
        makeEvidence({ evidence_id: 'ev-err', original_file_name: 'corrompida.jpg', url: '' }),
      ];
      component.failedEvidenceIds = { 'ev-err': true };
      fixture.detectChanges();

      const fallback = fixture.nativeElement.querySelector(
        '[data-testid="lightbox-image-fallback"]'
      ) as HTMLElement;
      expect(fallback).not.toBeNull();
      expect(fallback.textContent).toContain('Imagem indisponível em alta resolução');
    });
  });

  describe('LocationMapComponent (Passo 4)', () => {
    let fixture: ComponentFixture<LocationMapComponent>;
    let component: LocationMapComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [LocationMapComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(LocationMapComponent);
      component = fixture.componentInstance;
    });

    it('renderiza coordenadas de início e conclusão, distância e links do OpenStreetMap (RF-04)', () => {
      component.startLatitude = -23.50153;
      component.startLongitude = -47.45256;
      component.startAccuracy = 10;
      component.completeLatitude = -23.50253;
      component.completeLongitude = -47.45156;
      component.completeAccuracy = 8;
      component.siteName = 'Planta Sorocaba';
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="location-start-coords"]')?.textContent
      ).toContain('-23.501530');
      expect(
        fixture.nativeElement.querySelector('[data-testid="location-complete-coords"]')?.textContent
      ).toContain('-23.502530');
      expect(
        fixture.nativeElement.querySelector('[data-testid="location-distance-pill"]')?.textContent
      ).toContain('m');

      const startLink = fixture.nativeElement.querySelector(
        '[data-testid="osm-start-link"]'
      ) as HTMLAnchorElement;
      expect(startLink.href).toContain('openstreetmap.org');
      expect(
        fixture.nativeElement.querySelector('[data-testid="location-vector-map"]')
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="osm-embed-iframe"]')).toBeNull();
    });

    it('exibe estado vazio quando não há coordenadas registradas', () => {
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="location-empty-all"]')
      ).not.toBeNull();
    });
  });

  describe('ApprovalModalComponent & RejectionModalComponent (Passo 5)', () => {
    it('bloqueia envio de reprovação quando motivo está vazio ou contém apenas espaços (EX-01, CA-04)', () => {
      TestBed.configureTestingModule({ imports: [RejectionModalComponent] });
      const modalFixture = TestBed.createComponent(RejectionModalComponent);
      const modalComp = modalFixture.componentInstance;
      const confirmedSpy = spyOn(modalComp.confirmed, 'emit');

      modalComp.open = true;
      modalComp.inspection = makeReviewInspection({ status: 'EM_REVISÃO' });
      modalFixture.detectChanges();

      const submitBtn = modalFixture.nativeElement.querySelector(
        '[data-testid="confirm-reject-inspection-btn"]'
      ) as HTMLButtonElement;
      expect(submitBtn.disabled).toBeTrue();

      modalComp.reasonControl.setValue('     ');
      modalComp.confirm();
      modalFixture.detectChanges();

      expect(submitBtn.disabled).toBeTrue();
      expect(confirmedSpy).not.toHaveBeenCalled();
      expect(
        modalFixture.nativeElement.querySelector('[data-testid="reject-reason-error"]')
      ).not.toBeNull();

      modalComp.reasonControl.setValue('  Foto do painel ilegível; repetir captura.  ');
      modalComp.commentsControl.setValue('  Conferir foco da lente. ');
      modalFixture.detectChanges();
      expect(submitBtn.disabled).toBeFalse();

      modalComp.confirm();
      expect(confirmedSpy).toHaveBeenCalledWith({
        rejection_reason: 'Foto do painel ilegível; repetir captura.',
        comments: 'Conferir foco da lente.',
      });
    });

    it('permite parecer técnico opcional na aprovação e bloqueia ações em APROVADA ou CANCELADA (RT-03)', () => {
      TestBed.configureTestingModule({ imports: [ApprovalModalComponent] });
      const modalFixture = TestBed.createComponent(ApprovalModalComponent);
      const modalComp = modalFixture.componentInstance;
      const confirmedSpy = spyOn(modalComp.confirmed, 'emit');

      modalComp.open = true;
      modalComp.inspection = makeReviewInspection({ status: 'EM_REVISÃO' });
      modalFixture.detectChanges();

      const confirmBtn = modalFixture.nativeElement.querySelector(
        '[data-testid="confirm-approve-inspection-btn"]'
      ) as HTMLButtonElement;
      expect(confirmBtn.disabled).toBeFalse();

      modalComp.commentsControl.setValue('  Validado em conformidade.  ');
      modalComp.confirm();
      expect(confirmedSpy).toHaveBeenCalledWith({ comments: 'Validado em conformidade.' });

      modalComp.inspection = makeReviewInspection({ status: 'APROVADA' });
      modalFixture.detectChanges();
      expect(confirmBtn.disabled).toBeTrue();
      expect(
        modalFixture.nativeElement.querySelector('[data-testid="approve-blocked-status-banner"]')
      ).not.toBeNull();
    });
  });

  describe('InspectionReviewComponent (fluxo integrado — Passo 6)', () => {
    let fixture: ComponentFixture<InspectionReviewComponent>;
    let component: InspectionReviewComponent;
    let inspectionServiceMock: jasmine.SpyObj<InspectionService>;
    let notificationsMock: jasmine.SpyObj<NotificationService>;
    let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

    beforeEach(async () => {
      paramMap$ = new BehaviorSubject(convertToParamMap({ inspectionId: 'insp-1' }));

      inspectionServiceMock = jasmine.createSpyObj<InspectionService>('InspectionService', [
        'getReviewDetails',
        'startReview',
        'approve',
        'reject',
        'getAuditLogs',
        'getEvidenceBlob',
      ]);
      notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
        'showSuccess',
        'showError',
        'showWarning',
        'showInfo',
      ]);

      inspectionServiceMock.getReviewDetails.and.returnValue(of(makeReviewInspection()));
      inspectionServiceMock.getAuditLogs.and.returnValue(of([]));

      await TestBed.configureTestingModule({
        imports: [InspectionReviewComponent],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: { paramMap: paramMap$.asObservable() },
          },
          { provide: InspectionService, useValue: inspectionServiceMock },
          { provide: NotificationService, useValue: notificationsMock },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(InspectionReviewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('exibe cabeçalho completo, não conformidades ordenadas por severidade e abre lightbox ao clicar na foto (CA-01, CA-02)', () => {
      expect(
        fixture.nativeElement.querySelector('[data-testid="review-inspection-title"]')?.textContent
      ).toContain('Inspeção Preventiva — Gerador 01');
      expect(
        fixture.nativeElement.querySelector('[data-testid="review-client-name"]')?.textContent
      ).toContain('Indústria Alfa S.A.');
      expect(
        fixture.nativeElement.querySelector('[data-testid="review-technician-name"]')?.textContent
      ).toContain('Carlos Técnico');
      expect(
        fixture.nativeElement.querySelector('[data-testid="review-started-at"]')?.textContent
      ).not.toContain('Não iniciada');
      expect(
        fixture.nativeElement.querySelector('[data-testid="review-completed-at"]')?.textContent
      ).not.toContain('Não concluída');

      const sevBadges = fixture.nativeElement.querySelectorAll(
        '[data-testid="nc-severity-badge"]'
      ) as NodeListOf<HTMLElement>;
      expect(Array.from(sevBadges).map((el) => el.textContent?.trim())).toEqual([
        'Crítica',
        'Alta',
        'Baixa',
      ]);

      const thumb = fixture.nativeElement.querySelector(
        '[data-testid="item-evidence-thumb"]'
      ) as HTMLButtonElement;
      thumb.click();
      fixture.detectChanges();

      expect(component.lightboxOpen()).toBeTrue();
      expect(
        fixture.nativeElement.querySelector('[data-testid="evidence-lightbox-modal"]')
      ).not.toBeNull();
    });

    it('permite iniciar revisão quando a inspeção está ENVIADA e atualiza para EM_REVISÃO', () => {
      inspectionServiceMock.getReviewDetails.and.returnValue(
        of(makeReviewInspection({ status: 'ENVIADA' }))
      );
      inspectionServiceMock.startReview.and.returnValue(
        of(makeReviewInspection({ status: 'EM_REVISÃO', reviewCycle: 1 }))
      );
      component.loadReviewData();
      fixture.detectChanges();

      const startBtn = fixture.nativeElement.querySelector(
        '[data-testid="start-review-btn"]'
      ) as HTMLButtonElement;
      expect(startBtn).not.toBeNull();
      startBtn.click();
      fixture.detectChanges();

      expect(inspectionServiceMock.startReview).toHaveBeenCalledWith('insp-1');
      expect(component.inspection()?.status).toBe('EM_REVISÃO');
      expect(notificationsMock.showSuccess).toHaveBeenCalled();
    });

    it('aprova inspeção atualizando o badge para APROVADA e desabilitando novas ações (CA-03, RT-03)', () => {
      const approvedResponse = makeReviewInspection({
        status: 'APROVADA',
        approvedAt: '2026-11-22T14:00:00Z',
        approvedBy: 'sup-1',
        approvedByName: 'Supervisor Operacional',
        reviewComments: 'Aprovado após conferência.',
      });
      inspectionServiceMock.approve.and.returnValue(of(approvedResponse));

      const openApproveBtn = fixture.nativeElement.querySelector(
        '[data-testid="open-approve-modal-btn"]'
      ) as HTMLButtonElement;
      const openRejectBtn = fixture.nativeElement.querySelector(
        '[data-testid="open-reject-modal-btn"]'
      ) as HTMLButtonElement;

      expect(openApproveBtn.disabled).toBeFalse();
      expect(openRejectBtn.disabled).toBeFalse();

      openApproveBtn.click();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="approval-modal"]')
      ).not.toBeNull();

      component.confirmApprove({ comments: 'Aprovado após conferência.' });
      fixture.detectChanges();

      expect(inspectionServiceMock.approve).toHaveBeenCalledWith('insp-1', {
        comments: 'Aprovado após conferência.',
      });
      expect(notificationsMock.showSuccess).toHaveBeenCalled();

      const badge = fixture.nativeElement.querySelector(
        '[data-testid="inspection-status-badge"]'
      ) as HTMLElement;
      expect(badge.getAttribute('data-status')).toBe('APROVADA');
      expect(openApproveBtn.disabled).toBeTrue();
      expect(openRejectBtn.disabled).toBeTrue();
      expect(
        fixture.nativeElement.querySelector('[data-testid="review-locked-banner"]')
      ).not.toBeNull();
    });

    it('reprova inspeção com motivo obrigatório e exibe notificação de sucesso (CA-04)', () => {
      const rejectedResponse = makeReviewInspection({
        status: 'REPROVADA',
        rejectedAt: '2026-11-22T14:10:00Z',
        rejectedByName: 'Supervisor Operacional',
        rejectionReason: 'Falta evidência do painel traseiro.',
      });
      inspectionServiceMock.reject.and.returnValue(of(rejectedResponse));

      const openRejectBtn = fixture.nativeElement.querySelector(
        '[data-testid="open-reject-modal-btn"]'
      ) as HTMLButtonElement;
      openRejectBtn.click();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="rejection-modal"]')
      ).not.toBeNull();

      component.confirmReject({
        rejection_reason: 'Falta evidência do painel traseiro.',
        comments: 'Reenviar foto nítida.',
      });
      fixture.detectChanges();

      expect(inspectionServiceMock.reject).toHaveBeenCalledWith('insp-1', {
        rejection_reason: 'Falta evidência do painel traseiro.',
        comments: 'Reenviar foto nítida.',
      });
      expect(notificationsMock.showSuccess).toHaveBeenCalled();
      expect(component.rejectModalOpen()).toBeFalse();
      expect(component.inspection()?.status).toBe('REPROVADA');
      expect(
        fixture.nativeElement.querySelector('[data-testid="review-rejected-banner"]')?.textContent
      ).toContain('Falta evidência do painel traseiro.');
    });

    it('mantém modal aberto com erro quando a API rejeita a submissão de reprovação e trata erro de carregamento de foto', () => {
      inspectionServiceMock.getReviewDetails.and.returnValue(
        of(
          makeReviewInspection({
            status: 'ENVIADA',
            evidences: [
              makeEvidence({
                evidence_id: 'ev-fail-blob',
                original_file_name: 'falha.jpg',
                url: null,
              }),
            ],
          })
        )
      );
      inspectionServiceMock.getEvidenceBlob.and.returnValue(
        throwError(() => new InspectionApiError('Arquivo ausente', 404, 'NOT_FOUND'))
      );

      component.loadReviewData();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="evidence-image-fallback"]')
      ).not.toBeNull();

      inspectionServiceMock.reject.and.returnValue(
        throwError(() => new InspectionApiError('O motivo da reprovação é obrigatório', 400))
      );
      component.openRejectModal();
      component.confirmReject({ rejection_reason: 'Motivo teste' });
      fixture.detectChanges();

      expect(component.rejectModalOpen()).toBeTrue();
      expect(component.modalError()).toBe('O motivo da reprovação é obrigatório');
    });

    it('desabilita botões de ação quando a inspeção já está CANCELADA (RT-03)', () => {
      inspectionServiceMock.getReviewDetails.and.returnValue(
        of(makeReviewInspection({ status: 'CANCELADA', canceledReason: 'Cancelada pelo cliente' }))
      );
      component.loadReviewData();
      fixture.detectChanges();

      const approveBtn = fixture.nativeElement.querySelector(
        '[data-testid="open-approve-modal-btn"]'
      ) as HTMLButtonElement;
      const rejectBtn = fixture.nativeElement.querySelector(
        '[data-testid="open-reject-modal-btn"]'
      ) as HTMLButtonElement;
      expect(approveBtn.disabled).toBeTrue();
      expect(rejectBtn.disabled).toBeTrue();
      expect(
        fixture.nativeElement.querySelector('[data-testid="review-locked-banner"]')?.textContent
      ).toContain('Cancelada pelo cliente');
    });
  });
});
