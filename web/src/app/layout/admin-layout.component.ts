import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../../environments/environment';
import { UserRole } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { NotificationService } from '../core/services/notification.service';

interface NavItem {
  label: string;
  route: string;
  roles: readonly UserRole[];
  shortTag: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', route: '/app/dashboard', roles: ['ADMIN', 'SUPERVISOR'], shortTag: 'DB' },
  { label: 'Usuários', route: '/app/users', roles: ['ADMIN'], shortTag: 'US' },
  { label: 'Clientes', route: '/app/clients', roles: ['ADMIN', 'SUPERVISOR'], shortTag: 'CL' },
  { label: 'Locais', route: '/app/sites', roles: ['ADMIN', 'SUPERVISOR'], shortTag: 'LC' },
  { label: 'Equipamentos', route: '/app/equipment', roles: ['ADMIN', 'SUPERVISOR'], shortTag: 'EQ' },
  {
    label: 'Modelos',
    route: '/app/inspection-templates',
    roles: ['ADMIN', 'SUPERVISOR'],
    shortTag: 'MD',
  },
  { label: 'Inspeções', route: '/app/inspections', roles: ['ADMIN', 'SUPERVISOR'], shortTag: 'IN' },
  {
    label: 'Não Conformidades',
    route: '/app/non-conformities',
    roles: ['ADMIN', 'SUPERVISOR'],
    shortTag: 'NC',
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

