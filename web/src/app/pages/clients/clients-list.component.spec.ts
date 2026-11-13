import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClientsApiService } from '../../core/master/clients-api.service';
import {
  ClientResponse,
  MasterDataApiError,
  PageResponse,
  SiteResponse,
} from '../../core/master/master-data.models';
import { SitesApiService } from '../../core/master/sites-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ClientsListComponent } from './clients-list.component';

describe('ClientsListComponent (TASK-008 Passo 6)', () => {
  let fixture: ComponentFixture<ClientsListComponent>;
  let component: ClientsListComponent;
  let clientsApiMock: jasmine.SpyObj<ClientsApiService>;
  let sitesApiMock: jasmine.SpyObj<SitesApiService>;
  let notificationsMock: jasmine.SpyObj<NotificationService>;

  const sampleClient: ClientResponse = {
    id: 'cli-1',
    code: 'CLI-ALFA',
    name: 'Indústria Alfa',
    legalName: 'Indústria Alfa S.A.',
    document: '12.345.678/0001-90',
    email: 'operacoes@alfa.com.br',
    phone: '+551533334400',
    status: 'ACTIVE',
    active: true,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
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
    latitude: null,
    longitude: null,
    contactName: null,
    contactPhone: null,
    status: 'ACTIVE',
    active: true,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  function pageOf(items: ClientResponse[]): PageResponse<ClientResponse> {
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

  beforeEach(async () => {
    clientsApiMock = jasmine.createSpyObj<ClientsApiService>('ClientsApiService', [
      'list',
      'create',
      'update',
      'deactivate',
      'activate',
      'checkCodeTaken',
    ]);
    sitesApiMock = jasmine.createSpyObj<SitesApiService>('SitesApiService', ['listByClient']);
    notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'showSuccess',
      'showError',
      'showWarning',
      'showInfo',
    ]);

    clientsApiMock.list.and.returnValue(of(pageOf([sampleClient])));
    clientsApiMock.checkCodeTaken.and.returnValue(of(false));
    sitesApiMock.listByClient.and.returnValue(of([sampleSite]));

    await TestBed.configureTestingModule({
      imports: [ClientsListComponent],
      providers: [
        provideRouter([]),
        { provide: ClientsApiService, useValue: clientsApiMock },
        { provide: SitesApiService, useValue: sitesApiMock },
        { provide: NotificationService, useValue: notificationsMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load paginated clients, apply filters, sort and render empty state when no items return', () => {
    expect(clientsApiMock.list).toHaveBeenCalledWith({
      search: '',
      status: '',
      page: 0,
      size: 20,
      sort: 'name,asc',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Indústria Alfa');

    component.searchFilter = 'Beta';
    component.statusFilter = 'INACTIVE';
    component.applyFilters();
    expect(clientsApiMock.list).toHaveBeenCalledWith({
      search: 'Beta',
      status: 'INACTIVE',
      page: 0,
      size: 20,
      sort: 'name,asc',
    });

    component.onSort('code');
    expect(component.sort).toBe('code,asc');

    clientsApiMock.list.and.returnValue(of(pageOf([])));
    component.clearFilters();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nenhum cliente encontrado');
  });

  it('should validate required fields and async code uniqueness before creating client', fakeAsync(() => {
    component.openCreateForm();
    fixture.detectChanges();

    component.submitForm();
    fixture.detectChanges();
    expect(clientsApiMock.create).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('O nome do cliente é obrigatório.');

    clientsApiMock.checkCodeTaken.and.returnValue(of(true));
    component.form.patchValue({ code: 'CLI-ALFA', name: 'Novo Cliente' });
    tick(400);
    fixture.detectChanges();

    expect(component.form.controls.code.hasError('codeTaken')).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Já existe um cliente cadastrado com este código.'
    );

    clientsApiMock.checkCodeTaken.and.returnValue(of(false));
    clientsApiMock.create.and.returnValue(of({ ...sampleClient, id: 'cli-2', code: 'CLI-BETA', name: 'Logística Beta' }));
    component.form.patchValue({ code: 'CLI-BETA', name: 'Logística Beta' });
    tick(400);

    component.submitForm();
    fixture.detectChanges();

    expect(clientsApiMock.create).toHaveBeenCalledTimes(1);
    expect(notificationsMock.showSuccess).toHaveBeenCalled();
    expect(component.formOpen()).toBeFalse();
  }));

  it('should map HTTP 409 DUPLICATE_CLIENT_CODE error onto the code form control', fakeAsync(() => {
    component.openCreateForm();
    fixture.detectChanges();
    component.form.patchValue({ code: 'CLI-DUP', name: 'Cliente Duplicado' });
    tick(400);
    fixture.detectChanges();

    clientsApiMock.create.and.returnValue(
      throwError(
        () =>
          new MasterDataApiError(
            'Já existe um cliente cadastrado com o código informado.',
            409,
            'DUPLICATE_CLIENT_CODE'
          )
      )
    );

    component.submitForm();
    fixture.detectChanges();

    expect(component.formError()).toContain('código informado');
    expect(component.form.controls.code.getError('serverError')).toContain('código informado');
  }));

  it('should require EX-01 modal confirmation before deactivating client from table or edit form', fakeAsync(() => {
    component.requestDeactivate(sampleClient);
    fixture.detectChanges();

    expect(sitesApiMock.listByClient).toHaveBeenCalledWith('cli-1', true, 100);
    expect(component.confirmTarget()?.id).toBe('cli-1');
    expect(component.confirmAlertBanner()).toContain('1 local(is) ativo(s)');

    const modalConfirmBtn = fixture.nativeElement.querySelector(
      '[data-testid="confirm-modal-confirm-btn"]'
    ) as HTMLButtonElement;
    const extraCheckbox = fixture.nativeElement.querySelector(
      '[data-testid="confirm-modal-extra-checkbox"]'
    ) as HTMLInputElement;
    expect(modalConfirmBtn.disabled).toBeTrue();

    clientsApiMock.deactivate.and.returnValue(of({ ...sampleClient, status: 'INACTIVE', active: false }));
    extraCheckbox.click();
    fixture.detectChanges();
    expect(modalConfirmBtn.disabled).toBeFalse();

    modalConfirmBtn.click();
    fixture.detectChanges();
    expect(clientsApiMock.deactivate).toHaveBeenCalledWith('cli-1');
    expect(component.confirmTarget()).toBeNull();

    // Fluxo pelo formulário de edição alterando status de ACTIVE para INACTIVE (CA-04)
    component.openEditForm(sampleClient);
    fixture.detectChanges();
    tick(400);

    component.form.controls.status.setValue('INACTIVE');
    component.submitForm();
    fixture.detectChanges();

    expect(clientsApiMock.update).not.toHaveBeenCalled();
    expect(component.confirmTarget()?.id).toBe('cli-1');

    clientsApiMock.update.and.returnValue(of({ ...sampleClient, status: 'INACTIVE', active: false }));
    component.confirmDeactivate();
    fixture.detectChanges();
    expect(clientsApiMock.update).toHaveBeenCalledWith(
      'cli-1',
      jasmine.objectContaining({ status: 'INACTIVE' })
    );
  }));
});

