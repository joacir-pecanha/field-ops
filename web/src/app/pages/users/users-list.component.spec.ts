import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  MasterDataApiError,
  PageResponse,
  UserResponse,
} from '../../core/master/master-data.models';
import { UsersApiService } from '../../core/master/users-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { UsersListComponent } from './users-list.component';

describe('UsersListComponent (TASK-008 Passo 6)', () => {
  let fixture: ComponentFixture<UsersListComponent>;
  let component: UsersListComponent;
  let usersApiMock: jasmine.SpyObj<UsersApiService>;
  let notificationsMock: jasmine.SpyObj<NotificationService>;

  const sampleUser: UserResponse = {
    id: 'usr-1',
    name: 'Carlos Técnico',
    email: 'carlos@fieldops.com',
    role: 'TECHNICIAN',
    status: 'ACTIVE',
    active: true,
    phone: '+5511999990001',
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  function userPage(items: UserResponse[]): PageResponse<UserResponse> {
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
    usersApiMock = jasmine.createSpyObj<UsersApiService>('UsersApiService', [
      'list',
      'create',
      'update',
      'deactivate',
      'activate',
      'checkEmailTaken',
    ]);
    notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'showSuccess',
      'showError',
      'showWarning',
      'showInfo',
    ]);

    usersApiMock.list.and.returnValue(of(userPage([sampleUser])));
    usersApiMock.checkEmailTaken.and.returnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [UsersListComponent],
      providers: [
        { provide: UsersApiService, useValue: usersApiMock },
        { provide: NotificationService, useValue: notificationsMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load users, filter by role/status and sort columns', () => {
    expect(usersApiMock.list).toHaveBeenCalledWith({
      search: '',
      role: '',
      status: '',
      page: 0,
      size: 20,
      sort: 'name,asc',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Carlos Técnico');

    component.roleFilter = 'TECHNICIAN';
    component.statusFilter = 'ACTIVE';
    component.applyFilters();
    expect(usersApiMock.list).toHaveBeenCalledWith({
      search: '',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
      page: 0,
      size: 20,
      sort: 'name,asc',
    });

    component.onSort('email');
    expect(component.sort).toBe('email,asc');
  });

  it('should require password on creation, check unique email async, and allow optional password on edit', fakeAsync(() => {
    component.openCreateForm();
    component.submitForm();
    fixture.detectChanges();

    expect(usersApiMock.create).not.toHaveBeenCalled();
    expect(component.form.controls.password.hasError('required')).toBeTrue();

    usersApiMock.checkEmailTaken.and.returnValue(of(true));
    component.form.patchValue({
      name: 'Novo Supervisor',
      email: 'carlos@fieldops.com',
      password: 'Password@123',
      role: 'SUPERVISOR',
      status: 'ACTIVE',
    });
    tick(400);
    fixture.detectChanges();

    expect(component.form.controls.email.hasError('emailTaken')).toBeTrue();

    usersApiMock.checkEmailTaken.and.returnValue(of(false));
    usersApiMock.create.and.returnValue(
      of({ ...sampleUser, id: 'usr-2', email: 'supervisor2@fieldops.com', role: 'SUPERVISOR' })
    );
    component.form.controls.email.setValue('supervisor2@fieldops.com');
    tick(400);

    component.submitForm();
    expect(usersApiMock.create).toHaveBeenCalledTimes(1);

    // Edição sem senha mantém formulário válido
    component.openEditForm(sampleUser);
    tick(400);
    expect(component.form.controls.password.hasError('required')).toBeFalse();
    usersApiMock.update.and.returnValue(of({ ...sampleUser, name: 'Carlos Atualizado' }));
    component.form.controls.name.setValue('Carlos Atualizado');
    component.submitForm();

    expect(usersApiMock.update).toHaveBeenCalledWith(
      'usr-1',
      jasmine.objectContaining({ name: 'Carlos Atualizado', password: null })
    );
  }));

  it('should map DUPLICATE_EMAIL 409 error and require confirmation before deactivating or blocking user', fakeAsync(() => {
    component.openCreateForm();
    component.form.patchValue({
      name: 'Duplicado',
      email: 'dup@fieldops.com',
      password: 'Password@123',
    });
    tick(400);

    usersApiMock.create.and.returnValue(
      throwError(
        () => new MasterDataApiError('Já existe um usuário com este e-mail.', 409, 'DUPLICATE_EMAIL')
      )
    );
    component.submitForm();
    expect(component.form.controls.email.getError('serverError')).toContain('e-mail');

    component.requestDeactivate(sampleUser);
    fixture.detectChanges();
    expect(component.confirmTarget()?.id).toBe('usr-1');

    usersApiMock.deactivate.and.returnValue(of({ ...sampleUser, status: 'INACTIVE', active: false }));
    component.confirmDeactivate();
    expect(usersApiMock.deactivate).toHaveBeenCalledWith('usr-1');

    component.openEditForm(sampleUser);
    tick(400);
    component.form.controls.status.setValue('BLOCKED');
    component.submitForm();
    expect(usersApiMock.update).not.toHaveBeenCalled();
    expect(component.pendingFormUpdate()?.status).toBe('BLOCKED');

    usersApiMock.update.and.returnValue(of({ ...sampleUser, status: 'BLOCKED', active: false }));
    component.confirmDeactivate();
    expect(usersApiMock.update).toHaveBeenCalledWith(
      'usr-1',
      jasmine.objectContaining({ status: 'BLOCKED' })
    );
  }));
});

