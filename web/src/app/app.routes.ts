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
        component: ModulePlaceholderComponent,
        data: {
          roles: ['ADMIN'],
          title: 'Usuários e Perfis',
          description: 'Gerenciamento de usuários, perfis e status de acesso (TASK-008).',
        },
        title: 'Usuários — FieldOps Admin',
      },
      {
        path: 'clients',
        component: ModulePlaceholderComponent,
        data: {
          roles: ['ADMIN', 'SUPERVISOR'],
          title: 'Clientes',
          description: 'Cadastro e consulta de clientes corporativos (TASK-008).',
        },
        title: 'Clientes — FieldOps Admin',
      },
      {
        path: 'sites',
        component: ModulePlaceholderComponent,
        data: {
          roles: ['ADMIN', 'SUPERVISOR'],
          title: 'Locais',
          description: 'Unidades e endereços vinculados aos clientes (TASK-008).',
        },
        title: 'Locais — FieldOps Admin',
      },
      {
        path: 'equipment',
        component: ModulePlaceholderComponent,
        data: {
          roles: ['ADMIN', 'SUPERVISOR'],
          title: 'Equipamentos',
          description: 'Parque de equipamentos e emissão de QR Codes (TASK-008).',
        },
        title: 'Equipamentos — FieldOps Admin',
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
