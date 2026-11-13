import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../../environments/environment';
import { UserRole } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { NotificationService } from '../core/services/notification.service';

type NavIconKey =
  | 'dashboard'
  | 'users'
  | 'clients'
  | 'sites'
  | 'equipment'
  | 'templates'
  | 'inspections'
  | 'non-conformities'
  | 'api-docs';

interface NavItem {
  label: string;
  route: string;
  roles: readonly UserRole[];
  icon: NavIconKey;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', route: '/app/dashboard', roles: ['ADMIN', 'SUPERVISOR'], icon: 'dashboard' },
  { label: 'Usuários', route: '/app/users', roles: ['ADMIN'], icon: 'users' },
  { label: 'Clientes', route: '/app/clients', roles: ['ADMIN', 'SUPERVISOR'], icon: 'clients' },
  { label: 'Locais', route: '/app/sites', roles: ['ADMIN', 'SUPERVISOR'], icon: 'sites' },
  {
    label: 'Equipamentos',
    route: '/app/equipment',
    roles: ['ADMIN', 'SUPERVISOR'],
    icon: 'equipment',
  },
  {
    label: 'Modelos',
    route: '/app/inspection-templates',
    roles: ['ADMIN', 'SUPERVISOR'],
    icon: 'templates',
  },
  {
    label: 'Inspeções',
    route: '/app/inspections',
    roles: ['ADMIN', 'SUPERVISOR'],
    icon: 'inspections',
  },
  {
    label: 'Não Conformidades',
    route: '/app/non-conformities',
    roles: ['ADMIN', 'SUPERVISOR'],
    icon: 'non-conformities',
  },
  {
    label: 'Swagger / API',
    route: '/app/api-docs',
    roles: ['ADMIN', 'SUPERVISOR'],
    icon: 'api-docs',
  },
];

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  readonly currentUser = this.authService.currentUser;
  readonly notifications = this.notificationService.notifications;
  readonly envLabel = environment.appEnvLabel;
  readonly sidebarOpen = signal(false);
  readonly isLoggingOut = signal(false);

  readonly visibleNavItems = computed(() => {
    const role = this.currentUser()?.role;
    if (!role) {
      return [];
    }
    return NAV_ITEMS.filter((item) => item.roles.includes(role));
  });

  readonly userInitials = computed(() => {
    const name = this.currentUser()?.name?.trim();
    if (!name) {
      return 'FO';
    }
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  readonly roleLabel = computed(() => {
    switch (this.currentUser()?.role) {
      case 'ADMIN':
        return 'Administrador';
      case 'SUPERVISOR':
        return 'Supervisor';
      default:
        return this.currentUser()?.role ?? '';
    }
  });

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  dismissNotification(id: number): void {
    this.notificationService.dismiss(id);
  }

  onLogout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.authService.logout().subscribe({
      complete: () => this.isLoggingOut.set(false),
      error: () => this.isLoggingOut.set(false),
    });
  }
}

