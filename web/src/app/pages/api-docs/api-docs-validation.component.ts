import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ClientsApiService } from '../../core/master/clients-api.service';
import { EquipmentApiService } from '../../core/master/equipment-api.service';
import { MasterDataApiError } from '../../core/master/master-data.models';
import { SitesApiService } from '../../core/master/sites-api.service';
import { UsersApiService } from '../../core/master/users-api.service';

interface EndpointProbeResult {
  label: string;
  method: string;
  endpoint: string;
  ok: boolean;
  status: number;
  durationMs: number;
  payload: string;
}

@Component({
  selector: 'app-api-docs-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="master-page">
      <header class="page-header-bar">
        <div>
          <h1>Swagger UI & Validação de Endpoints (Passo 2)</h1>
          <p>
            Interface para validação humana do contrato OpenAPI e execução direta dos serviços HTTP de
            Users, Clients, Sites e Equipment.
          </p>
        </div>

        <div class="header-actions">
          <a
            [href]="swaggerUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary"
            data-testid="open-swagger-btn"
          >
            Abrir Swagger UI (/swagger-ui.html)
          </a>
          <a
            [href]="openApiJsonUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-secondary"
          >
            Ver OpenAPI JSON (/v3/api-docs)
          </a>
        </div>
      </header>

      <div class="swagger-grid">
        <article class="filters-card">
          <div class="card-section-header">
            <div>
              <h2>1. Credencial Bearer JWT para o Swagger UI</h2>
              <p>
                Copie o token da sua sessão administrativa atual e cole em
                <strong>Authorize</strong> no Swagger UI para testar os endpoints protegidos.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-secondary"
              (click)="copyToken()"
              [disabled]="!accessToken()"
              data-testid="copy-jwt-btn"
            >
              {{ tokenCopied() ? 'Token copiado!' : 'Copiar Token JWT' }}
            </button>
          </div>

          <div class="token-preview">
            <code>{{ maskedToken() }}</code>
          </div>
        </article>

        <article class="filters-card">
          <div class="card-section-header">
            <div>
              <h2>2. Teste Rápido dos Serviços HTTP Frontend</h2>
              <p>
                Executa chamadas reais via <code>UsersApiService</code>,
                <code>ClientsApiService</code>, <code>SitesApiService</code> e
                <code>EquipmentApiService</code>.
              </p>
            </div>
          </div>

          <div class="probe-actions">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              (click)="probeUsers()"
              [disabled]="probing()"
            >
              GET /api/v1/users
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              (click)="probeClients()"
              [disabled]="probing()"
            >
              GET /api/v1/clients
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              (click)="probeSites()"
              [disabled]="probing()"
            >
              GET /api/v1/sites
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              (click)="probeEquipments()"
              [disabled]="probing()"
            >
              GET /api/v1/equipments
            </button>

            <div class="qr-probe-box">
              <input
                type="text"
                [(ngModel)]="qrProbeInput"
                placeholder="QR Code (ex: QR-FIELDOPS-GD001)"
                aria-label="QR Code para consulta"
              />
              <button
                type="button"
                class="btn btn-primary btn-sm"
                (click)="probeQrCode()"
                [disabled]="probing() || !qrProbeInput.trim()"
              >
                GET /equipments/qr/...
              </button>
            </div>
          </div>

          @if (probeResult(); as res) {
            <div class="probe-result" [class.probe-error]="!res.ok">
              <div class="probe-meta">
                <span class="code-chip">{{ res.method }} {{ res.endpoint }}</span>
                <span class="status-badge" [class.badge-active]="res.ok" [class.badge-blocked]="!res.ok">
                  HTTP {{ res.status }} • {{ res.durationMs }} ms
                </span>
              </div>
              <pre>{{ res.payload }}</pre>
            </div>
          }
        </article>
      </div>

      <article class="table-card swagger-embed-card">
        <div class="embed-toolbar">
          <div>
            <strong>Swagger UI Embarcado</strong>
            <span class="cell-secondary">({{ swaggerIndexUrl }})</span>
          </div>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            (click)="toggleEmbed()"
          >
            {{ showEmbed() ? 'Ocultar iframe' : 'Carregar Swagger UI aqui' }}
          </button>
        </div>

        @if (showEmbed()) {
          <iframe
            [src]="safeSwaggerUrl"
            title="FieldOps Swagger UI"
            class="swagger-iframe"
          ></iframe>
        } @else {
          <div class="empty-state">
            <h3>Swagger UI pronto para validação humana</h3>
            <p>
              Clique em <strong>"Carregar Swagger UI aqui"</strong> ou em
              <strong>"Abrir Swagger UI (/swagger-ui.html)"</strong> para testar os endpoints com o
              backend em execução na porta 8080.
            </p>
          </div>
        }
      </article>
    </section>
  `,
  styles: [
    `
      .swagger-grid {
        display: grid;
        gap: 1rem;
      }

      .card-section-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 0.75rem;

        h2 {
          margin: 0 0 0.25rem;
          font-size: 1.05rem;
          color: #0f172a;
        }

        p {
          margin: 0;
          font-size: 0.85rem;
          color: #475569;
        }
      }

      .token-preview {
        padding: 0.65rem 0.85rem;
        border-radius: 0.55rem;
        background: #0f172a;
        color: #e2e8f0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.8rem;
        overflow-x: auto;
      }

      .probe-actions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        flex-wrap: wrap;
      }

      .qr-probe-box {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        margin-left: auto;

        input {
          padding: 0.4rem 0.65rem;
          border-radius: 0.45rem;
          border: 1px solid #cbd5e1;
          font-size: 0.83rem;
          min-width: 220px;
        }
      }

      .probe-result {
        margin-top: 0.9rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.65rem;
        overflow: hidden;

        &.probe-error {
          border-color: #fecaca;
        }

        pre {
          margin: 0;
          padding: 0.85rem;
          background: #0f172a;
          color: #f8fafc;
          font-size: 0.78rem;
          max-height: 300px;
          overflow: auto;
        }
      }

      .probe-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.55rem 0.85rem;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      .embed-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 1.15rem;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
      }

      .swagger-iframe {
        width: 100%;
        height: 760px;
        border: none;
        background: #ffffff;
      }
    `,
  ],
})
export class ApiDocsValidationComponent {
  private readonly authService = inject(AuthService);
  private readonly usersApi = inject(UsersApiService);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly sitesApi = inject(SitesApiService);
  private readonly equipmentApi = inject(EquipmentApiService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly apiBase = environment.apiBaseUrl.replace(/\/+$/, '');
  readonly swaggerUrl = `${this.apiBase}/swagger-ui.html`;
  readonly swaggerIndexUrl = `${this.apiBase}/swagger-ui/index.html`;
  readonly openApiJsonUrl = `${this.apiBase}/v3/api-docs`;
  readonly safeSwaggerUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    this.swaggerIndexUrl
  );

  readonly tokenCopied = signal(false);
  readonly showEmbed = signal(false);
  readonly probing = signal(false);
  readonly probeResult = signal<EndpointProbeResult | null>(null);

  qrProbeInput = 'QR-FIELDOPS-GD001';

  readonly accessToken = computed(() => this.authService.getAccessToken());
  readonly maskedToken = computed(() => {
    const token = this.accessToken();
    if (!token) {
      return 'Nenhum token JWT encontrado na sessão atual.';
    }
    if (token.length <= 36) {
      return token;
    }
    return `${token.slice(0, 22)}...${token.slice(-14)}`;
  });

  toggleEmbed(): void {
    this.showEmbed.update((value) => !value);
  }

  async copyToken(): Promise<void> {
    const token = this.accessToken();
    if (!token || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      this.tokenCopied.set(true);
      setTimeout(() => this.tokenCopied.set(false), 2500);
    } catch {
      this.tokenCopied.set(false);
    }
  }

  probeUsers(): void {
    this.runProbe('GET', '/api/v1/users?page=0&size=5', () =>
      this.usersApi.list({ page: 0, size: 5, sort: 'name,asc' })
    );
  }

  probeClients(): void {
    this.runProbe('GET', '/api/v1/clients?page=0&size=5', () =>
      this.clientsApi.list({ page: 0, size: 5, sort: 'name,asc' })
    );
  }

  probeSites(): void {
    this.runProbe('GET', '/api/v1/sites?page=0&size=5', () =>
      this.sitesApi.list({ page: 0, size: 5, sort: 'name,asc' })
    );
  }

  probeEquipments(): void {
    this.runProbe('GET', '/api/v1/equipments?page=0&size=5', () =>
      this.equipmentApi.list({ page: 0, size: 5, sort: 'name,asc' })
    );
  }

  probeQrCode(): void {
    const qr = this.qrProbeInput.trim();
    if (!qr) {
      return;
    }
    this.runProbe('GET', `/api/v1/equipments/qr/${qr}`, () =>
      this.equipmentApi.getByQrCode(qr)
    );
  }

  private runProbe(
    method: string,
    endpoint: string,
    call: () => import('rxjs').Observable<unknown>
  ): void {
    const startedAt = performance.now();
    this.probing.set(true);

    call().subscribe({
      next: (data) => {
        this.probeResult.set({
          label: endpoint,
          method,
          endpoint,
          ok: true,
          status: 200,
          durationMs: Math.round(performance.now() - startedAt),
          payload: JSON.stringify(data, null, 2),
        });
        this.probing.set(false);
      },
      error: (err: unknown) => {
        const apiError = err instanceof MasterDataApiError ? err : null;
        this.probeResult.set({
          label: endpoint,
          method,
          endpoint,
          ok: false,
          status: apiError?.status ?? 0,
          durationMs: Math.round(performance.now() - startedAt),
          payload: JSON.stringify(
            {
              code: apiError?.code ?? 'UNKNOWN',
              message: apiError?.message ?? 'Falha ao consultar endpoint.',
              fieldErrors: apiError?.fieldErrors ?? {},
            },
            null,
            2
          ),
        });
        this.probing.set(false);
      },
    });
  }
}
