import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-module-placeholder',
  standalone: true,
  template: `
    <section class="placeholder-card">
      <span class="module-badge">Módulo Protegido</span>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </section>
  `,
  styles: [
    `
      .placeholder-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.85rem;
        padding: 1.75rem;
        max-width: 720px;

        h1 {
          margin: 0.6rem 0 0.45rem;
          font-size: 1.45rem;
          color: #0f172a;
        }

        p {
          margin: 0;
          color: #475569;
          line-height: 1.55;
        }
      }

      .module-badge {
        display: inline-block;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 0.75rem;
        font-weight: 700;
      }
    `,
  ],
})
export class ModulePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = (this.route.snapshot.data['title'] as string) ?? 'Módulo FieldOps';
  readonly description =
    (this.route.snapshot.data['description'] as string) ??
    'Esta área será habilitada nas próximas tarefas do backlog.';
}

