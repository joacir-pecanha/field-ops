import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClientsApiService } from '../../core/master/clients-api.service';
import { EquipmentApiService } from '../../core/master/equipment-api.service';
import {
  ClientResponse,
  EquipmentResponse,
  PageResponse,
  SiteResponse,
  UserResponse,
} from '../../core/master/master-data.models';
import { SitesApiService } from '../../core/master/sites-api.service';
import { UsersApiService } from '../../core/master/users-api.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  TemplateResponse,
  TemplateService,
  TemplateVersionResponse,
} from '../templates/template.service';
import { CancelModalComponent } from './components/cancel-modal.component';
import { StatusBadgeComponent } from './components/status-badge.component';
import { InspectionListComponent } from './inspection-list.component';
import { InspectionScheduleComponent } from './inspection-schedule.component';
import {
  InspectionDetailsResponse,
  InspectionService,
  InspectionStatus,
  InspectionStatusTone,
} from './inspection.service';

describe('Inspections Module (TASK-012 Passo 5)', () => {
  const activeClient: ClientResponse = {
    id: 'cli-1',
    code: 'CLI-ALFA',
    name: 'Indústria Alfa S.A.',
    legalName: 'Indústria Alfa S.A.',
    document: '12345678000190',
    email: 'contato@alfa.com',
    phone: '+5511999990001',
    status: 'ACTIVE',
    active: true,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  const secondClient: ClientResponse = {
    ...activeClient,
    id: 'cli-2',
    code: 'CLI-BETA',
    name: 'Metalúrgica Beta',
  };

  const inactiveClient: ClientResponse = {
    ...activeClient,
    id: 'cli-inact',
    code: 'CLI-INAT',
    name: 'Cliente Inativo',
    status: 'INACTIVE',
    active: false,
  };

  const siteAlfaA: SiteResponse = {
    id: 'site-1',
    clientId: 'cli-1',
    clientName: 'Indústria Alfa S.A.',
    code: 'SITE-SOR-01',
    name: 'Planta Sorocaba',
    description: null,
    addressLine: 'Av. Industrial, 100',
    city: 'Sorocaba',
    state: 'SP',
    postalCode: '18000-000',
    latitude: -23.5,
    longitude: -47.45,
    contactName: 'Marcos',
    contactPhone: '15999990000',
    status: 'ACTIVE',
    active: true,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  const siteAlfaInactive: SiteResponse = {
    ...siteAlfaA,
    id: 'site-inact',
    code: 'SITE-INACT',
    name: 'Galpão Desativado',
    status: 'INACTIVE',
    active: false,
  };

  const siteBeta: SiteResponse = {
    ...siteAlfaA,
    id: 'site-2',
    clientId: 'cli-2',
    clientName: 'Metalúrgica Beta',
    code: 'SITE-CAMP-01',
    name: 'Unidade Campinas',
  };

  const equipAlfa1: EquipmentResponse = {
    id: 'eqp-1',
    siteId: 'site-1',
    siteName: 'Planta Sorocaba',
    clientId: 'cli-1',
    clientName: 'Indústria Alfa S.A.',
    code: 'EQP-GD-001',
    name: 'Gerador Diesel 500 kVA',
    assetNumber: 'PAT-001',
    serialNumber: 'SN-001',
    manufacturer: 'Cummins',
    model: 'C500',
    description: null,
    qrCode: 'QR-FIELDOPS-GD001',
    status: 'ACTIVE',
    active: true,
    installedAt: '2025-01-10',
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  const equipInactive: EquipmentResponse = {
    ...equipAlfa1,
    id: 'eqp-inact',
    code: 'EQP-OLD-99',
    name: 'Compressor Descomissionado',
    qrCode: 'QR-INACTIVE-99',
    status: 'DECOMMISSIONED',
    active: false,
  };

  const publishedTemplate: TemplateResponse = {
    id: 'tpl-pub-1',
    code: 'TPL-GER-01',
    title: 'Inspeção Preventiva de Gerador Diesel',
    description: 'Checklist padrão',
    category: 'ELETRICA',
    status: 'PUBLISHED',
    active: true,
    version: 1,
    currentVersion: 1,
    activeVersionId: 'ver-pub-1',
    totalSections: 1,
    totalItems: 3,
    sections: [],
    createdBy: 'sup-1',
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
  };

  // Simula rascunho recém-criado no backend onde activeVersionId vem preenchido com o rascunho,
  // mas status === 'DRAFT' e currentVersion === 0.
  const draftOnlyTemplate: TemplateResponse = {
    ...publishedTemplate,
    id: 'tpl-draft-2',
    code: 'TPL-SUB-02',
    title: 'Checklist de Subestação (Rascunho)',
    status: 'DRAFT',
    active: true,
    version: 0,
    currentVersion: 0,
    activeVersionId: 'ver-draft-working-id',
  };

  const versionV1: TemplateVersionResponse = {
    id: 'ver-pub-1',
    templateId: 'tpl-pub-1',
    version: 1,
    versionNumber: 1,
    status: 'PUBLISHED',
    titleSnapshot: 'Inspeção Preventiva de Gerador Diesel',
    descriptionSnapshot: 'v1',
    categorySnapshot: 'ELETRICA',
    publishedBy: 'sup-1',
    publishedAt: '2026-11-13T10:00:00Z',
    activeForNewInspections: true,
    totalSections: 1,
    totalItems: 3,
    sections: [],
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
  };

  const draftVersionV2: TemplateVersionResponse = {
    ...versionV1,
    id: 'ver-draft-2',
    version: 2,
    versionNumber: 2,
    status: 'DRAFT',
    activeForNewInspections: false,
  };

  const techCarlos: UserResponse = {
    id: 'tech-1',
    name: 'Carlos Técnico',
    email: 'tecnico@fieldops.com',
    role: 'TECHNICIAN',
    status: 'ACTIVE',
    active: true,
    phone: null,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  const supervisorUser: UserResponse = {
    ...techCarlos,
    id: 'sup-1',
    name: 'Supervisor Geral',
    email: 'supervisor@fieldops.com',
    role: 'SUPERVISOR',
  };

  const inactiveTech: UserResponse = {
    ...techCarlos,
    id: 'tech-inact',
    name: 'Ex-Técnico',
    email: 'inativo@fieldops.com',
    status: 'INACTIVE',
    active: false,
  };

  function makePage<T>(content: T[]): PageResponse<T> {
    return {
      content,
      page: 0,
      size: 20,
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
      first: true,
      last: true,
    };
  }

  function makeInspection(
    overrides: Partial<InspectionDetailsResponse> = {}
  ): InspectionDetailsResponse {
    return {
      id: 'insp-1',
      title: 'Inspeção Preventiva — Gerador 01',
      instructions: 'Verificar nível de óleo e baterias.',
      status: 'ATRIBUÍDA',
      priority: 'ALTA',
      templateId: 'tpl-pub-1',
      templateCode: 'TPL-GER-01',
      templateTitle: 'Inspeção Preventiva de Gerador Diesel',
      templateCategory: 'ELETRICA',
      templateVersionId: 'ver-pub-1',
      templateVersion: 1,
      templateVersionNumber: 1,
      clientId: 'cli-1',
      clientCode: 'CLI-ALFA',
      clientName: 'Indústria Alfa S.A.',
      siteId: 'site-1',
      siteCode: 'SITE-SOR-01',
      siteName: 'Planta Sorocaba',
      siteAddress: 'Av. Industrial, 100',
      equipmentId: 'eqp-1',
      equipmentCode: 'EQP-GD-001',
      equipmentName: 'Gerador Diesel 500 kVA',
      equipmentQrCode: 'QR-FIELDOPS-GD001',
      technicianId: 'tech-1',
      technicianName: 'Carlos Técnico',
      technicianEmail: 'tecnico@fieldops.com',
      supervisorId: 'sup-1',
      supervisorName: 'Supervisor Geral',
      createdBy: 'sup-1',
      scheduledFor: '2026-11-20T09:00:00Z',
      dueDate: '2026-11-20T09:00:00Z',
      overdue: false,
      startedAtDevice: null,
      startedAtServer: null,
      completedAtDevice: null,
      submittedAtServer: null,
      approvedAt: null,
      canceledAt: null,
      canceledBy: null,
      canceledReason: null,
      totalItems: 3,
      items: [],
      createdAt: '2026-11-13T10:00:00Z',
      updatedAt: '2026-11-13T10:00:00Z',
      version: 0,
      ...overrides,
    };
  }

  describe('InspectionScheduleComponent', () => {
    let fixture: ComponentFixture<InspectionScheduleComponent>;
    let component: InspectionScheduleComponent;
    let router: Router;

    let inspectionServiceMock: jasmine.SpyObj<InspectionService>;
    let clientsApiMock: jasmine.SpyObj<ClientsApiService>;
    let sitesApiMock: jasmine.SpyObj<SitesApiService>;
    let equipmentApiMock: jasmine.SpyObj<EquipmentApiService>;
    let usersApiMock: jasmine.SpyObj<UsersApiService>;
    let templateServiceMock: jasmine.SpyObj<TemplateService>;
    let notificationsMock: jasmine.SpyObj<NotificationService>;

    beforeEach(async () => {
      inspectionServiceMock = jasmine.createSpyObj<InspectionService>('InspectionService', [
        'schedule',
      ]);
      clientsApiMock = jasmine.createSpyObj<ClientsApiService>('ClientsApiService', ['listActive']);
      sitesApiMock = jasmine.createSpyObj<SitesApiService>('SitesApiService', ['listByClient']);
      equipmentApiMock = jasmine.createSpyObj<EquipmentApiService>('EquipmentApiService', [
        'list',
        'getByQrCode',
      ]);
      usersApiMock = jasmine.createSpyObj<UsersApiService>('UsersApiService', ['list']);
      templateServiceMock = jasmine.createSpyObj<TemplateService>('TemplateService', [
        'list',
        'listVersions',
      ]);
      notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
        'showSuccess',
        'showError',
        'showWarning',
        'showInfo',
      ]);

      clientsApiMock.listActive.and.returnValue(
        of([activeClient, secondClient, inactiveClient])
      );
      templateServiceMock.list.and.returnValue(
        of(makePage([publishedTemplate, draftOnlyTemplate]))
      );
      usersApiMock.list.and.returnValue(
        of(makePage([techCarlos, supervisorUser, inactiveTech]))
      );

      sitesApiMock.listByClient.and.callFake((clientId: string) => {
        if (clientId === 'cli-1') {
          return of([siteAlfaA, siteAlfaInactive]);
        }
        if (clientId === 'cli-2') {
          return of([siteBeta]);
        }
        return of([]);
      });

      equipmentApiMock.list.and.callFake((query) => {
        if (query?.siteId === 'site-1') {
          return of(makePage([equipAlfa1, equipInactive]));
        }
        return of(makePage([]));
      });

      templateServiceMock.listVersions.and.returnValue(of([draftVersionV2, versionV1]));
      inspectionServiceMock.schedule.and.returnValue(of(makeInspection()));

      await TestBed.configureTestingModule({
        imports: [InspectionScheduleComponent],
        providers: [
          provideRouter([]),
          { provide: InspectionService, useValue: inspectionServiceMock },
          { provide: ClientsApiService, useValue: clientsApiMock },
          { provide: SitesApiService, useValue: sitesApiMock },
          { provide: EquipmentApiService, useValue: equipmentApiMock },
          { provide: UsersApiService, useValue: usersApiMock },
          { provide: TemplateService, useValue: templateServiceMock },
          { provide: NotificationService, useValue: notificationsMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      spyOn(router, 'navigate').and.resolveTo(true);

      fixture = TestBed.createComponent(InspectionScheduleComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('filtra apenas clientes ativos, modelos publicados ativos (excluindo rascunhos como TPL-SUB-02) e técnicos ativos', () => {
      expect(component.loadingInitial()).toBeFalse();
      expect(component.clients().map((c) => c.id)).toEqual(['cli-1', 'cli-2']);
      expect(component.templates().map((t) => t.id)).toEqual(['tpl-pub-1']);
      expect(component.templates().some((t) => t.code === 'TPL-SUB-02')).toBeFalse();
      expect(component.technicians().map((u) => u.id)).toEqual(['tech-1']);
    });

    it('recarrega Locais ao selecionar Cliente e recarrega Equipamentos ao selecionar Local via valueChanges (RF-01 / RT-01)', () => {
      component.form.controls.clientId.setValue('cli-1');
      fixture.detectChanges();

      expect(sitesApiMock.listByClient).toHaveBeenCalledWith('cli-1', true, 200);
      expect(component.sites().map((s) => s.id)).toEqual(['site-1']);
      expect(component.form.controls.siteId.value).toBe('');
      expect(component.form.controls.equipmentId.value).toBe('');

      component.form.controls.siteId.setValue('site-1');
      fixture.detectChanges();

      expect(equipmentApiMock.list).toHaveBeenCalledWith({
        siteId: 'site-1',
        active: true,
        page: 0,
        size: 200,
        sort: 'name,asc',
      });
      expect(component.equipments().map((e) => e.id)).toEqual(['eqp-1']);

      component.form.controls.equipmentId.setValue('eqp-1');
      // Trocar de cliente deve limpar siteId, equipmentId e equipamentos anteriores
      component.form.controls.clientId.setValue('cli-2');
      fixture.detectChanges();

      expect(component.form.controls.siteId.value).toBe('');
      expect(component.form.controls.equipmentId.value).toBe('');
      expect(component.sites().map((s) => s.id)).toEqual(['site-2']);
      expect(component.equipments()).toEqual([]);
    });

    it('carrega versões publicadas ao selecionar Modelo e seleciona automaticamente a versão publicada ativa (RF-02)', () => {
      component.form.controls.templateId.setValue('tpl-pub-1');
      fixture.detectChanges();

      expect(templateServiceMock.listVersions).toHaveBeenCalledWith('tpl-pub-1');
      expect(component.publishedVersions().map((v) => v.id)).toEqual(['ver-pub-1']);
      expect(component.form.controls.templateVersionId.value).toBe('ver-pub-1');
    });

    it('localiza equipamento ativo por QR Code e preenche toda a hierarquia Cliente -> Local -> Equipamento', () => {
      equipmentApiMock.getByQrCode.and.returnValue(of(equipAlfa1));

      component.qrLookupTerm = 'QR-FIELDOPS-GD001';
      component.lookupEquipmentByCodeOrQr();
      fixture.detectChanges();

      expect(equipmentApiMock.getByQrCode).toHaveBeenCalledWith('QR-FIELDOPS-GD001');
      expect(component.form.controls.clientId.value).toBe('cli-1');
      expect(component.form.controls.siteId.value).toBe('site-1');
      expect(component.form.controls.equipmentId.value).toBe('eqp-1');
      expect(component.qrLookupMessage()).toContain('Gerador Diesel 500 kVA');
      expect(component.qrLookupError()).toBeNull();
    });

    it('rejeita equipamento inativo na busca por QR Code sem alterar a seleção', () => {
      equipmentApiMock.getByQrCode.and.returnValue(of(equipInactive));

      component.qrLookupTerm = 'QR-INACTIVE-99';
      component.lookupEquipmentByCodeOrQr();
      fixture.detectChanges();

      expect(component.form.controls.equipmentId.value).toBe('');
      expect(component.qrLookupError()).toContain('inativo/descomissionado');
    });

    it('bloqueia o botão de envio enquanto campos obrigatórios não são preenchidos (EX-01)', () => {
      const submitBtn = fixture.nativeElement.querySelector(
        '[data-testid="schedule-submit-btn"]'
      ) as HTMLButtonElement;

      expect(component.form.invalid).toBeTrue();
      expect(submitBtn.disabled).toBeTrue();

      component.submit();

      expect(inspectionServiceMock.schedule).not.toHaveBeenCalled();
    });

    it('submete agendamento válido com cliente, local, modelo publicado, técnico, data prevista e prioridade e navega para /app/inspections', () => {
      component.form.controls.clientId.setValue('cli-1');
      component.form.controls.siteId.setValue('site-1');
      component.form.controls.equipmentId.setValue('eqp-1');
      component.form.controls.templateId.setValue('tpl-pub-1');
      component.form.controls.technicianId.setValue('tech-1');
      component.form.controls.scheduledDate.setValue('2026-11-25');
      component.form.controls.scheduledTime.setValue('14:30');
      component.form.controls.priority.setValue('ALTA');
      component.form.controls.title.setValue('Preventiva Trimestral Q4');
      component.form.controls.instructions.setValue('Conferir horímetro e baterias.');
      fixture.detectChanges();

      const submitBtn = fixture.nativeElement.querySelector(
        '[data-testid="schedule-submit-btn"]'
      ) as HTMLButtonElement;
      expect(component.form.valid).toBeTrue();
      expect(submitBtn.disabled).toBeFalse();

      component.submit();

      expect(inspectionServiceMock.schedule).toHaveBeenCalledTimes(1);
      const sentPayload = inspectionServiceMock.schedule.calls.mostRecent().args[0];
      expect(sentPayload.clientId).toBe('cli-1');
      expect(sentPayload.siteId).toBe('site-1');
      expect(sentPayload.equipmentId).toBe('eqp-1');
      expect(sentPayload.templateId).toBe('tpl-pub-1');
      expect(sentPayload.templateVersionId).toBe('ver-pub-1');
      expect(sentPayload.technicianId).toBe('tech-1');
      expect(sentPayload.priority).toBe('ALTA');
      expect(sentPayload.title).toBe('Preventiva Trimestral Q4');
      expect(sentPayload.instructions).toBe('Conferir horímetro e baterias.');
      expect(sentPayload.scheduledFor).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      expect(notificationsMock.showSuccess).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/app/inspections']);
    });
  });

  describe('StatusBadgeComponent (RT-03)', () => {
    let fixture: ComponentFixture<StatusBadgeComponent>;
    let component: StatusBadgeComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [StatusBadgeComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(StatusBadgeComponent);
      component = fixture.componentInstance;
    });

    const semanticMatrix: Array<{
      status: InspectionStatus;
      expectedLabel: string;
      expectedTone: InspectionStatusTone;
    }> = [
      { status: 'ATRIBUÍDA', expectedLabel: 'Atribuída', expectedTone: 'blue' },
      { status: 'EM_ANDAMENTO', expectedLabel: 'Em Andamento', expectedTone: 'orange' },
      { status: 'ENVIADA', expectedLabel: 'Enviada', expectedTone: 'yellow' },
      { status: 'APROVADA', expectedLabel: 'Aprovada', expectedTone: 'green' },
      { status: 'REPROVADA', expectedLabel: 'Reprovada', expectedTone: 'red' },
      { status: 'CANCELADA', expectedLabel: 'Cancelada', expectedTone: 'gray' },
    ];

    semanticMatrix.forEach(({ status, expectedLabel, expectedTone }) => {
      it(`renderiza rótulo "${expectedLabel}" e classe semântica "tone-${expectedTone}" para estado ${status}`, () => {
        component.status = status;
        fixture.detectChanges();

        const badgeEl = fixture.nativeElement.querySelector(
          '[data-testid="inspection-status-badge"]'
        ) as HTMLElement;
        expect(badgeEl.textContent?.trim()).toBe(expectedLabel);
        expect(badgeEl.classList.contains(`tone-${expectedTone}`)).toBeTrue();
        expect(badgeEl.getAttribute('data-status')).toBe(status);
      });
    });

    it('exibe selo de atraso quando showOverdueBadge e overdue são verdadeiros', () => {
      component.status = 'ATRIBUÍDA';
      component.overdue = true;
      component.showOverdueBadge = true;
      fixture.detectChanges();

      const overdueEl = fixture.nativeElement.querySelector(
        '[data-testid="status-overdue-badge"]'
      ) as HTMLElement;
      expect(overdueEl).not.toBeNull();
      expect(overdueEl.textContent).toContain('Em atraso');
    });
  });

  describe('CancelModalComponent & InspectionListComponent (RF-06 / RF-07 / RT-02 / EX-02)', () => {
    it('CancelModalComponent exige justificativa não vazia e bloqueia inspeção APROVADA', () => {
      TestBed.configureTestingModule({
        imports: [CancelModalComponent],
      });
      const modalFixture = TestBed.createComponent(CancelModalComponent);
      const modalComp = modalFixture.componentInstance;
      const confirmedSpy = spyOn(modalComp.confirmed, 'emit');

      modalComp.open = true;
      modalComp.inspection = makeInspection({ status: 'ATRIBUÍDA' });
      modalFixture.detectChanges();

      const confirmBtn = modalFixture.nativeElement.querySelector(
        '[data-testid="confirm-cancel-inspection-btn"]'
      ) as HTMLButtonElement;
      expect(confirmBtn.disabled).toBeTrue();

      modalComp.reasonControl.setValue('   ');
      modalComp.confirm();
      modalFixture.detectChanges();

      expect(confirmedSpy).not.toHaveBeenCalled();
      expect(
        modalFixture.nativeElement.querySelector('[data-testid="cancel-reason-error"]')
      ).not.toBeNull();

      modalComp.reasonControl.setValue('  Cliente solicitou reagendamento de parada.  ');
      modalFixture.detectChanges();
      expect(confirmBtn.disabled).toBeFalse();

      modalComp.confirm();
      expect(confirmedSpy).toHaveBeenCalledWith('Cliente solicitou reagendamento de parada.');

      modalComp.inspection = makeInspection({ id: 'insp-aprov', status: 'APROVADA' });
      modalComp.reasonControl.setValue('Tentativa indevida');
      modalFixture.detectChanges();

      const blockedBtn = modalFixture.nativeElement.querySelector(
        '[data-testid="confirm-cancel-inspection-btn"]'
      ) as HTMLButtonElement;
      expect(blockedBtn.disabled).toBeTrue();
      expect(
        modalFixture.nativeElement.querySelector('[data-testid="cancel-blocked-status-banner"]')
      ).not.toBeNull();
    });

    it('InspectionListComponent destaca atraso, bloqueia cancelamento em APROVADA, aplica debounce na busca e cancela com justificativa', fakeAsync(() => {
      const inspectionServiceMock = jasmine.createSpyObj<InspectionService>('InspectionService', [
        'list',
        'cancel',
        'getById',
        'getAuditLogs',
      ]);
      const clientsApiMock = jasmine.createSpyObj<ClientsApiService>('ClientsApiService', ['list']);
      const usersApiMock = jasmine.createSpyObj<UsersApiService>('UsersApiService', ['list']);
      const notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
        'showSuccess',
        'showError',
        'showWarning',
        'showInfo',
      ]);

      const overdueAssigned = makeInspection({
        id: 'insp-overdue',
        title: 'Inspeção Em Atraso',
        status: 'ATRIBUÍDA',
        overdue: true,
      });
      const approvedInspection = makeInspection({
        id: 'insp-approved',
        title: 'Inspeção Já Aprovada',
        status: 'APROVADA',
        overdue: false,
      });

      inspectionServiceMock.list.and.returnValue(
        of(makePage([overdueAssigned, approvedInspection]))
      );
      inspectionServiceMock.cancel.and.returnValue(
        of(makeInspection({ ...overdueAssigned, status: 'CANCELADA', canceledReason: 'Parada adiada' }))
      );
      clientsApiMock.list.and.returnValue(of(makePage([activeClient])));
      usersApiMock.list.and.returnValue(of(makePage([techCarlos])));

      TestBed.configureTestingModule({
        imports: [InspectionListComponent],
        providers: [
          provideRouter([]),
          { provide: InspectionService, useValue: inspectionServiceMock },
          { provide: ClientsApiService, useValue: clientsApiMock },
          { provide: UsersApiService, useValue: usersApiMock },
          { provide: NotificationService, useValue: notificationsMock },
        ],
      });

      const listFixture = TestBed.createComponent(InspectionListComponent);
      const listComp = listFixture.componentInstance;
      listFixture.detectChanges();

      const rows = listFixture.nativeElement.querySelectorAll(
        '[data-testid="inspection-row"]'
      ) as NodeListOf<HTMLTableRowElement>;
      expect(rows.length).toBe(2);
      expect(rows[0].classList.contains('row-overdue')).toBeTrue();
      expect(rows[0].querySelector('[data-testid="overdue-badge"]')).not.toBeNull();

      const cancelBtns = listFixture.nativeElement.querySelectorAll(
        '[data-testid="inspection-cancel-btn"]'
      ) as NodeListOf<HTMLButtonElement>;
      expect(cancelBtns[0].disabled).toBeFalse();
      expect(cancelBtns[1].disabled).toBeTrue();

      // Debounce de 350ms na busca textual (RT-02)
      inspectionServiceMock.list.calls.reset();
      listComp.onSearchInput('Gerador');
      tick(200);
      expect(inspectionServiceMock.list).not.toHaveBeenCalled();
      tick(160);
      expect(inspectionServiceMock.list).toHaveBeenCalledTimes(1);
      expect(inspectionServiceMock.list.calls.mostRecent().args[0]?.search).toBe('Gerador');

      // Fluxo de cancelamento com modal dedicado
      listComp.openCancelModal(overdueAssigned);
      listFixture.detectChanges();
      expect(
        listFixture.nativeElement.querySelector('[data-testid="cancel-inspection-modal"]')
      ).not.toBeNull();

      listComp.confirmCancel('  Parada adiada  ');
      listFixture.detectChanges();

      expect(inspectionServiceMock.cancel).toHaveBeenCalledWith('insp-overdue', {
        reason: 'Parada adiada',
      });
      expect(notificationsMock.showSuccess).toHaveBeenCalled();
      expect(listComp.cancelTarget()).toBeNull();
    }));

    it('propaga erro da API ao cancelar sem fechar o modal', () => {
      const inspectionServiceMock = jasmine.createSpyObj<InspectionService>('InspectionService', [
        'list',
        'cancel',
      ]);
      const clientsApiMock = jasmine.createSpyObj<ClientsApiService>('ClientsApiService', ['list']);
      const usersApiMock = jasmine.createSpyObj<UsersApiService>('UsersApiService', ['list']);
      const notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
        'showSuccess',
        'showError',
      ]);

      const target = makeInspection({ id: 'insp-err', status: 'ATRIBUÍDA' });
      inspectionServiceMock.list.and.returnValue(of(makePage([target])));
      inspectionServiceMock.cancel.and.returnValue(throwError(() => new Error('Erro de rede')));
      clientsApiMock.list.and.returnValue(of(makePage([])));
      usersApiMock.list.and.returnValue(of(makePage([])));

      TestBed.configureTestingModule({
        imports: [InspectionListComponent],
        providers: [
          provideRouter([]),
          { provide: InspectionService, useValue: inspectionServiceMock },
          { provide: ClientsApiService, useValue: clientsApiMock },
          { provide: UsersApiService, useValue: usersApiMock },
          { provide: NotificationService, useValue: notificationsMock },
        ],
      });

      const listFixture = TestBed.createComponent(InspectionListComponent);
      const listComp = listFixture.componentInstance;
      listFixture.detectChanges();

      listComp.openCancelModal(target);
      listComp.confirmCancel('Motivo válido');

      expect(listComp.cancelTarget()?.id).toBe('insp-err');
      expect(listComp.cancelError()).toBe('Não foi possível cancelar a inspeção.');
    });
  });
});
