; import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ClientsApiService } from './clients-api.service';
import { EquipmentApiService } from './equipment-api.service';
import { MasterDataApiError } from './master-data.models';
import { SitesApiService } from './sites-api.service';
import { UsersApiService } from './users-api.service';

describe('MasterData HTTP Services (TASK-008 Passo 1)', () => {
  let httpMock: HttpTestingController;
  let usersApi: UsersApiService;
  let clientsApi: ClientsApiService;
  let sitesApi: SitesApiService;
  let equipmentApi: EquipmentApiService;

  const baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    usersApi = TestBed.inject(UsersApiService);
    clientsApi = TestBed.inject(ClientsApiService);
    sitesApi = TestBed.inject(SitesApiService);
    equipmentApi = TestBed.inject(EquipmentApiService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('UsersApiService should pass pagination, sort and filter params', () => {
    usersApi
      .list({ search: 'carlos', role: 'TECHNICIAN', status: 'ACTIVE', page: 1, size: 10, sort: 'name,desc' })
      .subscribe((page) => {
        expect(page.totalElements).toBe(1);
        expect(page.content[0].email).toBe('carlos@fieldops.com');
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/users` &&
        r.params.get('search') === 'carlos' &&
        r.params.get('role') === 'TECHNICIAN' &&
        r.params.get('status') === 'ACTIVE' &&
        r.params.get('page') === '1' &&
        r.params.get('size') === '10' &&
        r.params.get('sort') === 'name,desc'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      content: [
        {
          id: 'u-1',
          name: 'Carlos Técnico',
          email: 'carlos@fieldops.com',
          role: 'TECHNICIAN',
          status: 'ACTIVE',
          active: true,
          phone: null,
          createdAt: '2026-11-13T10:00:00Z',
          updatedAt: '2026-11-13T10:00:00Z',
          version: 0,
        },
      ],
      page: 1,
      size: 10,
      totalElements: 1,
      totalPages: 1,
      first: false,
      last: true,
    });
  });

  it('ClientsApiService.listActive should query active=true ordered by name', () => {
    clientsApi.listActive().subscribe((clients) => {
      expect(clients.length).toBe(1);
      expect(clients[0].code).toBe('CLI-ALFA');
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/clients` &&
        r.params.get('active') === 'true' &&
        r.params.get('sort') === 'name,asc'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      content: [
        {
          id: 'c-1',
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
        },
      ],
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });
  });

  it('SitesApiService.listByClient should filter sites strictly by clientId', () => {
    sitesApi.listByClient('c-1', true).subscribe((sites) => {
      expect(sites.length).toBe(1);
      expect(sites[0].clientId).toBe('c-1');
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/sites` &&
        r.params.get('clientId') === 'c-1' &&
        r.params.get('active') === 'true'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      content: [
        {
          id: 's-1',
          clientId: 'c-1',
          clientName: 'Indústria Alfa',
          code: 'SITE-01',
          name: 'Planta Sorocaba',
          description: null,
          addressLine: null,
          city: 'Sorocaba',
          state: 'SP',
          postalCode: null,
          latitude: null,
          longitude: null,
          contactName: null,
          contactPhone: null,
          status: 'ACTIVE',
          active: true,
          createdAt: '2026-11-13T10:00:00Z',
          updatedAt: '2026-11-13T10:00:00Z',
          version: 0,
        },
      ],
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });
  });

  it('EquipmentApiService.checkQrCodeTaken should return true when QR exists on another equipment and false on 404', () => {
    let takenExisting = false;
    equipmentApi.checkQrCodeTaken('QR-FIELDOPS-GD001', 'eq-other').subscribe((taken) => {
      takenExisting = taken;
    });

    const foundReq = httpMock.expectOne(`${baseUrl}/api/v1/equipments/qr/QR-FIELDOPS-GD001`);
    foundReq.flush({
      id: 'eq-1',
      siteId: 's-1',
      siteName: 'Planta Sorocaba',
      clientId: 'c-1',
      clientName: 'Indústria Alfa',
      code: 'EQP-1',
      name: 'Gerador',
      assetNumber: null,
      serialNumber: null,
      manufacturer: null,
      model: null,
      description: null,
      qrCode: 'QR-FIELDOPS-GD001',
      status: 'ACTIVE',
      active: true,
      installedAt: null,
      createdAt: '2026-11-13T10:00:00Z',
      updatedAt: '2026-11-13T10:00:00Z',
      version: 0,
    });
    expect(takenExisting).toBeTrue();

    let takenFree = true;
    equipmentApi.checkQrCodeTaken('QR-NEW-999').subscribe((taken) => {
      takenFree = taken;
    });

    const missingReq = httpMock.expectOne(`${baseUrl}/api/v1/equipments/qr/QR-NEW-999`);
    missingReq.flush(
      { status: 404, code: 'EQUIPMENT_NOT_FOUND', detail: 'Não encontrado' },
      { status: 404, statusText: 'Not Found' }
    );
    expect(takenFree).toBeFalse();
  });

  it('EquipmentApiService.create should map HTTP 409 DUPLICATE_QR_CODE to MasterDataApiError', () => {
    let capturedError: MasterDataApiError | undefined;

    equipmentApi
      .create({
        siteId: 's-1',
        name: 'Compressor',
        qrCode: 'QR-FIELDOPS-GD001',
      })
      .subscribe({
        error: (err: MasterDataApiError) => {
          capturedError = err;
        },
      });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/equipments`);
    expect(req.request.method).toBe('POST');

    req.flush(
      {
        status: 409,
        code: 'DUPLICATE_QR_CODE',
        detail: "Já existe um equipamento cadastrado com o QR Code 'QR-FIELDOPS-GD001'.",
      },
      { status: 409, statusText: 'Conflict' }
    );

    expect(capturedError).toBeDefined();
    expect(capturedError?.status).toBe(409);
    expect(capturedError?.code).toBe('DUPLICATE_QR_CODE');
    expect(capturedError?.message).toContain('QR-FIELDOPS-GD001');
  });
});
