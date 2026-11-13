import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserRole, UserStatus } from '../../core/auth/auth.models';
import { uniqueUserEmailValidator } from '../../core/master/master-async.validators';
import {
  MasterDataApiError,
  PageResponse,
  UserResponse,
  normalizeOptionalText,
} from '../../core/master/master-data.models';
import { UsersApiService } from '../../core/master/users-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import {
  applyServerFieldErrors,
  clearServerError,
  isControlInvalid,
  sortIndicatorFor,
  toggleSortExpression,
} from '../../shared/utils/form-error.utils';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent],
  templateUrl: './users-list.component.html',
})
export class UsersListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usersApi = inject(UsersApiService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly submitted = signal(false);
  readonly editingUser = signal<UserResponse | null>(null);

  readonly pageData = signal<PageResponse<UserResponse>>({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });

  searchFilter = '';
  roleFilter: UserRole | '' = '';
  statusFilter: UserStatus | '' = '';
  page = 0;
  size = 20;
  sort = 'name,asc';

  readonly roles: readonly { value: UserRole; label: string }[] = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'SUPERVISOR', label: 'Supervisor' },
    { value: 'TECHNICIAN', label: 'Técnico' },
    { value: 'CLIENT_VIEWER', label: 'Cliente (Somente Leitura)' },
  ];

  readonly statuses: readonly { value: UserStatus; label: string }[] = [
    { value: 'ACTIVE', label: 'Ativo' },
    { value: 'INACTIVE', label: 'Inativo' },
    { value: 'BLOCKED', label: 'Bloqueado' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    email: [
      '',
      {
        validators: [Validators.required, Validators.email, Validators.maxLength(255)],
        asyncValidators: [
          uniqueUserEmailValidator(this.usersApi, () => this.editingUser()?.id ?? null),
        ],
      },
    ],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    role: ['SUPERVISOR' as UserRole, [Validators.required]],
    status: ['ACTIVE' as UserStatus, [Validators.required]],
    phone: ['', [Validators.maxLength(32), Validators.pattern(/^\+?[0-9()\s-]{8,20}$/)]],
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.usersApi
      .list({
        search: this.searchFilter,
        role: this.roleFilter,
        status: this.statusFilter,
        page: this.page,
        size: this.size,
        sort: this.sort,
      })
      .subscribe({
        next: (response) => {
          this.pageData.set(response);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          const message =
            err instanceof MasterDataApiError
              ? err.message
              : 'Não foi possível carregar a lista de usuários.';
          this.loadError.set(message);
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.page = 0;
    this.loadUsers();
  }

  clearFilters(): void {
    this.searchFilter = '';
    this.roleFilter = '';
    this.statusFilter = '';
    this.page = 0;
    this.loadUsers();
  }

  onSort(field: string): void {
    this.sort = toggleSortExpression(this.sort, field);
    this.page = 0;
    this.loadUsers();
  }

  sortIcon(field: string): string {
    return sortIndicatorFor(this.sort, field);
  }

  onPageChange(nextPage: number): void {
    this.page = nextPage;
    this.loadUsers();
  }

  onSizeChange(nextSize: number): void {
    this.size = nextSize;
    this.page = 0;
    this.loadUsers();
  }

  openCreateForm(): void {
    this.editingUser.set(null);
    this.submitted.set(false);
    this.formError.set(null);
    this.configurePasswordValidators(false);

    this.form.reset({
      name: '',
      email: '',
      password: '',
      role: 'SUPERVISOR',
      status: 'ACTIVE',
      phone: '',
    });
    this.formOpen.set(true);
  }

  openEditForm(user: UserResponse): void {
    this.editingUser.set(user);
    this.submitted.set(false);
    this.formError.set(null);
    this.configurePasswordValidators(true);

    this.form.reset({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
      phone: user.phone ?? '',
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingUser.set(null);
    this.formError.set(null);
  }

  onFieldInput(controlName: string): void {
    clearServerError(this.form, controlName);
  }

  invalid(controlName: string): boolean {
    return isControlInvalid(this.form, controlName, this.submitted());
  }

  submitForm(): void {
    this.submitted.set(true);
    this.formError.set(null);

    if (this.form.pending) {
      this.formError.set('Aguarde a validação de unicidade do e-mail finalizar.');
      return;
    }

    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const editing = this.editingUser();
    this.saving.set(true);

    const request$ = editing
      ? this.usersApi.update(editing.id, {
          name: raw.name.trim(),
          email: raw.email.trim(),
          password: normalizeOptionalText(raw.password),
          role: raw.role,
          status: raw.status,
          phone: normalizeOptionalText(raw.phone),
        })
      : this.usersApi.create({
          name: raw.name.trim(),
          email: raw.email.trim(),
          password: raw.password,
          role: raw.role,
          status: raw.status,
          phone: normalizeOptionalText(raw.phone),
        });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingUser.set(null);
        this.notifications.showSuccess(
          editing
            ? `Usuário "${saved.name}" atualizado com sucesso.`
            : `Usuário "${saved.name}" cadastrado com sucesso.`
        );
        this.loadUsers();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof MasterDataApiError) {
          this.formError.set(err.message);
          applyServerFieldErrors(this.form, err, { DUPLICATE_EMAIL: 'email' });
          return;
        }
        this.formError.set('Não foi possível salvar o usuário.');
      },
    });
  }

  roleLabel(role: UserRole): string {
    return this.roles.find((item) => item.value === role)?.label ?? role;
  }

  statusLabel(status: UserStatus): string {
    return this.statuses.find((item) => item.value === status)?.label ?? status;
  }

  private configurePasswordValidators(isEditing: boolean): void {
    const control = this.form.controls.password;
    if (isEditing) {
      control.setValidators([Validators.minLength(8), Validators.maxLength(100)]);
    } else {
      control.setValidators([
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(100),
      ]);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }
}
