import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="dashboard-welcome">
      <header class="page-header">
        <div>
          <h1>Painel Operacional FieldOps</h1>
          <p>
            Bem-vindo(a), <strong>{{ currentUser()?.name }}</strong
            >. Sua sessão administrativa está ativa e protegida.
          </p>
        </div>
        <span class="session-pill">Sessão verificada</span>
      </header>

      <div class="summary-grid">
        <article class="summary-card">
          <span class="card-label">Perfil conectado</span>
          <strong class="card-value">{{ currentUser()?.role }}</strong>
          <span class="card-hint">{{ currentUser()?.email }}</span>
        </article>

        <article class="summary-card">
          <span class="card-label">Inspeções em andamento</span>
          <strong class="card-value">0</strong>
          <span class="card-hint">Módulo de acompanhamento será integrado na TASK-021</span>
        </article>

        <article class="summary-card">
          <span class="card-label">Aguardando revisão</span>
          <strong class="card-value">0</strong>
          <span class="card-hint">Módulo de revisão técnica será integrado na TASK-020</span>
        </article>

        <article class="summary-card">
          <span class="card-label">Atrasadas</span>
          <strong class="card-value">0</strong>
          <span class="card-hint">Monitoramento em tempo real habilitado após sincronização</span>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .dashboard-welcome {
        display: grid;
        gap: 1.5rem;
      }

      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;

        h1 {
          margin: 0 0 0.35rem;
          font-size: 1.6rem;
          font-weight: 700;
          color: #0f172a;
        }

        p {
          margin: 0;
          color: #475569;
          font-size: 0.95rem;
        }
      }

      .session-pill {
        padding: 0.35rem 0.8rem;
        border-radius: 999px;
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }

      .summary-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.85rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
      }

      .card-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: #64748b;
      }

      .card-value {
        font-size: 1.65rem;
        font-weight: 700;
        color: #0f172a;
      }

      .card-hint {
        font-size: 0.78rem;
        color: #64748b;
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  readonly currentUser = this.authService.currentUser;
}

