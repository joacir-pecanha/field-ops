import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title?: string;
  message: string;
}

/**
 * Serviço global de notificações/banners da interface administrativa.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly _notifications = signal<AppNotification[]>([]);

  readonly notifications = this._notifications.asReadonly();

  show(
    type: NotificationType,
    message: string,
    title?: string,
    autoDismissMs = 6000
  ): number {
    const id = this.nextId++;
    const notification: AppNotification = { id, type, title, message };
    this._notifications.update((list) => [...list, notification]);

    if (autoDismissMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => this.dismiss(id), autoDismissMs);
    }

    return id;
  }

  showSuccess(message: string, title = 'Sucesso'): number {
    return this.show('success', message, title);
  }

  showError(message: string, title = 'Erro'): number {
    return this.show('error', message, title);
  }

  showWarning(message: string, title = 'Atenção'): number {
    return this.show('warning', message, title);
  }

  showInfo(message: string, title = 'Informação'): number {
    return this.show('info', message, title);
  }

  dismiss(id: number): void {
    this._notifications.update((list) => list.filter((item) => item.id !== id));
  }

  clear(): void {
    this._notifications.set([]);
  }
}

