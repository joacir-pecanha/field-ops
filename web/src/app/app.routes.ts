import { Routes } from '@angular/router';
import { authChildGuard, authGuard, guestGuard } from './core/auth/auth.guard';
import { WEB_ALLOWED_ROLES } from './core/auth/auth.models';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LoginComponent } from './pages/login/login.component';
import { ModulePlaceholderComponent } from './pages/module-placeholder/module-placeholder.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app/dashboard',
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
    title: 'Login — FieldOps Admin',
  },
  {
    path: 'app',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    data: { roles: WEB_ALLOWED_ROLES },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        data: { roles: ['ADMIN', 'SUPERVISOR'] },
        title: 'Dashboard — FieldOps Admin',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users-list.component').then((m) => m.UsersListComponent),
        data: { roles: ['ADMIN'] },
        title: 'Usuários — FieldOps Admin',
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./pages/clients/clients-list.component').then((m) => m.ClientsListComponent),
        data: { roles: ['ADMIN', 'SUPERVISOR'] },
        title: 'Clientes — FieldOps Admin',
      },
      {
        path: 'clients/:clientId/sites',
        loadComponent: () =>
          import('./pages/sites/sites-list.component').then((m) => m.SitesListComponent),
        data: { roles: ['ADMIN', 'SUPERVISOR'] },
        title: 'Locais do Cliente — FieldOps Admin',
      },
      {
        path: 'sites',
        loadComponent: () =>
          import('./pages/sites/sites-list.component').then((m) => m.SitesListComponent),
        data: { roles: ['ADMIN', 'SUPERVISOR'] },
        title: 'Locais — FieldOps Admin',
      },
      {
        path: 'sites/:siteId/equipment',
        loadComponent: () =>
          import('./pages/equipment/equipment-list.component').then(
            (m) => m.EquipmentListComponent
          ),
        data: { roles: ['ADMIN', 'SUPERVISOR'] },
        title: 'Equipamentos do Local — FieldOps Admin',
      },
      {
        path: 'equipment',
        loadComponent: () =>
          import('./pages/equipment/equipment-list.component').then(
            (m) => m.EquipmentListComponent
          ),
        data: { roles: ['ADMIN', 'SUPERVISOR'] },
        title: 'Equipamentos — FieldOps Admin',
      },
      {
        path: 'api-docs',
        loadComponent: () =>
          import('./pages/api-docs/api-docs-validation.component').then(
            (m) => m.ApiDocsValidationComponent
          ),
        data: { roles: ['ADMIN', 'SUPERVISOR'] },
        title: 'Swagger & API — FieldOps Admin',
      },
      {
        path: 'inspection-templates',
        component: ModulePlaceholderComponent,
        data: {
          roles: ['ADMIN', 'SUPERVISOR'],
          title: 'Modelos de Inspeção',
          description: 'Construtor de checklists dinâmicos e versionamento (TASK-010).',
        },
        title: 'Modelos — FieldOps Admin',
      },
      {
        path: 'inspections',
        component: ModulePlaceholderComponent,
        data: {
          roles: ['ADMIN', 'SUPERVISOR'],
          title: 'Inspeções',
          description: 'Planejamento, agendamento e revisão técnica (TASK-012 / TASK-020).',
        },
        title: 'Inspeções — FieldOps Admin',
      },
      {
        path: 'non-conformities',
        component: ModulePlaceholderComponent,
        data: {
          roles: ['ADMIN', 'SUPERVISOR'],
          title: 'Não Conformidades',
          description: 'Monitoramento de não conformidades por criticidade (TASK-020).',
        },
        title: 'Não Conformidades — FieldOps Admin',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'app/dashboard',
  },
];
