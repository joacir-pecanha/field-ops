import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClientsApiService } from '../../core/master/clients-api.service';
import { EquipmentApiService } from '../../core/master/equipment-api.service';
import {
  ClientResponse,
  EquipmentResponse,
  MasterDataApiError,
  PageResponse,
  SiteResponse,
} from '../../core/master/master-data.models';
import { SitesApiService } from '../../core/master/sites-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { SitesListComponent } from './sites-list.component';

describe('SitesListComponent (TASK-008 Passo 6)', () => {
  let fixture: ComponentFixture<SitesListComponent>;
  let component: SitesListComponent;
  let sitesApiMock: jasmine.SpyObj<SitesApiService>;
  let clientsApiMock: jasmine.SpyObj<ClientsApiService>;
  let equipmentApiMock: jasmine.SpyObj<EquipmentApiService>;
  let notificationsMock: jasmine.SpyObj<NotificationService>;

  const activeClient: ClientResponse = {
    id: 'cli-1',
    code: 'CLI-ALFA',
    name: 'Indústria Alfa',
    legalName: null,
    document: null,
    email: null,
    phone: null,
    status: 'ACTIVE',
    active: true,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  const inactiveClient: ClientResponse = {
    ...activeClient,
    id: 'cli-2',
    code: 'CLI-INAT',
    name: 'Cliente Inativo',
    status: 'INACTIVE',
    active: false,
  };

  const sampleSite: SiteResponse = {
    id: 'site-1',
    clientId: 'cli-1',
    clientName: 'Indústria Alfa',
    code: 'SITE-SOR-01',
    name: 'Planta Sorocaba',
    description: null,
    addressLine: 'Av. Industrial, 1200',
    city: 'Sorocaba',
    state: 'SP',
    postalCode: '18010-000',
    latitude: -23.50153,
    longitude: -47.45256,
    contactName: 'Marcos Silva',
    contactPhone: '+5515999991111',
    status: 'ACTIVE',
    active: true,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  function createSitePage(items: SiteResponse[]): PageResponse<SiteResponse> {
    return {
      content: items,
      page: 0,
      size: 20,
      totalElements: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      first: true,
      last: true,
    };
  }

  function createEquipmentPage(totalElements: number): PageResponse<EquipmentResponse> {
    return {
      content: [],
      page: 0,
      size: 1,
      totalElements,
      totalPages: totalElements > 0 ? 1 : 0,
      first: true,
      last: true,
    };
  }

  beforeEach(async () => {
    sitesApiMock = jasmine.createSpyObj<SitesApiService>('SitesApiService', [
      'list',
      'create',
      'update',
      'deactivate',
      'activate',
      'checkCodeTakenForClient',
    ]);
    clientsApiMock = jasmine.createSpyObj<ClientsApiService>('ClientsApiService', ['list']);
    equipmentApiMock = jasmine.createSpyObj<EquipmentApiService>('EquipmentApiService', ['list']);
    notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'showSuccess',
      'showError',
      'showWarning',
      'showInfo',
    ]);

    clientsApiMock.list.and.returnValue(
      of({
        content: [activeClient, inactiveClient],
        page: 0,
        size: 200,
        totalElements: 2,
        totalPages: 1,
        first: true,
        last: true,
      })
    );
    sitesApiMock.list.and.returnValue(of(createSitePage([sampleSite])));
    sitesApiMock.checkCodeTakenForClient.and.returnValue(of(false));
    equipmentApiMock.list.and.returnValue(of(createEquipmentPage(2)));

    await TestBed.configureTestingModule({
      imports: [SitesListComponent],
      providers: [
        provideRouter([]),
        { provide: SitesApiService, useValue: sitesApiMock },
        { provide: ClientsApiService, useValue: clientsApiMock },
        { provide: EquipmentApiService, useValue: equipmentApiMock },
        { provide: NotificationService, useValue: notificationsMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ clientId: 'cli-1' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SitesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should filter sites by route clientId and only offer active clients when creating (RF-02, RN-009)', () => {
    expect(component.clientFilter).toBe('cli-1');
    expect(sitesApiMock.list).toHaveBeenCalledWith({
      clientId: 'cli-1',
      search: '',
      status: '',
      page: 0,
      size: 20,
      sort: 'name,asc',
    });

    component.openCreateForm();
    fixture.detectChanges();

    const selectable = component.selectableClients();
    expect(selectable.map((c) => c.id)).toEqual(['cli-1']);
    expect(component.form.controls.clientId.value).toBe('cli-1');
  });

  it('should validate required client, UF/CEP/coordinates and async site code uniqueness per client', fakeAsync(() => {
    component.openCreateForm();
    component.form.patchValue({
      clientId: '',
      name: '',
      state: 'S',
      postalCode: '123',
      latitude: 120,
      longitude: -200,
    });
    component.submitForm();
    fixture.detectChanges();

    expect(sitesApiMock.create).not.toHaveBeenCalled();
    expect(component.form.controls.clientId.hasError('required')).toBeTrue();
    expect(component.form.controls.name.hasError('required')).toBeTrue();
    expect(component.form.controls.state.hasError('pattern')).toBeTrue();
    expect(component.form.controls.postalCode.hasError('pattern')).toBeTrue();
    expect(component.form.controls.latitude.hasError('max')).toBeTrue();
    expect(component.form.controls.longitude.hasError('min')).toBeTrue();

    sitesApiMock.checkCodeTakenForClient.and.returnValue(of(true));
    component.form.patchValue({
      clientId: 'cli-1',
      code: 'SITE-SOR-01',
      name: 'Nova Unidade',
      state: 'sp',
      postalCode: '18010-000',
      latitude: -23.5,
      longitude: -47.4,
    });
    tick(400);
    fixture.detectChanges();

    expect(component.form.controls.code.hasError('codeTaken')).toBeTrue();

    sitesApiMock.checkCodeTakenForClient.and.returnValue(of(false));
    sitesApiMock.create.and.returnValue(of({ ...sampleSite, id: 'site-2', code: 'SITE-SOR-02' }));
    component.form.controls.code.setValue('SITE-SOR-02');
    tick(400);

    component.submitForm();
    fixture.detectChanges();

    expect(sitesApiMock.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        clientId: 'cli-1',
        code: 'SITE-SOR-02',
        state: 'SP',
      })
    );
    expect(component.formOpen()).toBeFalse();
  }));

  it('should map INACTIVE_CLIENT server error to clientId control', fakeAsync(() => {
    component.openCreateForm();
    fixture.detectChanges();
    component.form.patchValue({
      clientId: 'cli-1',
      name: 'Unidade Teste',
    });
    tick(400);
    fixture.detectChanges();

    sitesApiMock.create.and.returnValue(
      throwError(
        () => new MasterDataApiError('O cliente informado está inativo.', 422, 'INACTIVE_CLIENT')
      )
    );

    component.submitForm();
    fixture.detectChanges();

    expect(component.form.controls.clientId.getError('serverError')).toContain('inativo');
  }));

  it('should query linked active equipments and confirm before deactivating a site (RF-05, CA-04)', () => {
    component.requestDeactivate(sampleSite);
    fixture.detectChanges();

    expect(equipmentApiMock.list).toHaveBeenCalledWith({
      siteId: 'site-1',
      active: true,
      page: 0,
      size: 1,
    });
    expect(component.confirmAlertBanner()).toContain('2 equipamento(s) ativo(s)');

    sitesApiMock.deactivate.and.returnValue(of({ ...sampleSite, status: 'INACTIVE', active: false }));
    component.confirmDeactivate();
    fixture.detectChanges();

    expect(sitesApiMock.deactivate).toHaveBeenCalledWith('site-1');
    expect(component.confirmTarget()).toBeNull();
  });
});

