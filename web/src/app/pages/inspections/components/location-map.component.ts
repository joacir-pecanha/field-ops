import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface PlottedPoint {
  x: number;
  y: number;
  lat: number;
  lng: number;
  accuracy: number | null;
}

/**
 * Componente de exibição de localização geográfica (início e conclusão) com coordenadas
 * formatadas, links diretos para o OpenStreetMap, distância calculada e mapa SVG/embed opcional
 * (RF-04, RN-062).
 */
@Component({
  selector: 'app-location-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="location-panel" data-testid="location-map">
      <div class="location-cards-grid">
        <article class="coord-card" data-testid="location-start-card">
          <div class="coord-header">
            <span class="coord-pin pin-start">A • Início</span>
            @if (startedAt) {
              <span class="coord-time">{{ startedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
            }
          </div>

          @if (hasStartCoords()) {
            <div class="coord-values" data-testid="location-start-coords">
              <strong>{{ formatCoordinates(startLatitude, startLongitude) }}</strong>
              @if (startAccuracy !== null && startAccuracy !== undefined) {
                <span class="coord-accuracy">Precisão: ±{{ formatNumber(startAccuracy, 1) }} m</span>
              }
            </div>
            <a
              class="btn btn-secondary btn-sm osm-link"
              [href]="osmUrl(startLatitude, startLongitude)"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="osm-start-link"
            >
              Abrir início no OpenStreetMap ↗
            </a>
          } @else {
            <div class="coord-empty" data-testid="location-empty-start">
              Coordenadas de início não registradas pelo dispositivo.
            </div>
          }
        </article>

        <article class="coord-card" data-testid="location-complete-card">
          <div class="coord-header">
            <span class="coord-pin pin-complete">B • Conclusão</span>
            @if (completedAt) {
              <span class="coord-time">{{ completedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
            }
          </div>

          @if (hasCompleteCoords()) {
            <div class="coord-values" data-testid="location-complete-coords">
              <strong>{{ formatCoordinates(completeLatitude, completeLongitude) }}</strong>
              @if (completeAccuracy !== null && completeAccuracy !== undefined) {
                <span class="coord-accuracy">
                  Precisão: ±{{ formatNumber(completeAccuracy, 1) }} m
                </span>
              }
            </div>
            <a
              class="btn btn-secondary btn-sm osm-link"
              [href]="osmUrl(completeLatitude, completeLongitude)"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="osm-complete-link"
            >
              Abrir conclusão no OpenStreetMap ↗
            </a>
          } @else {
            <div class="coord-empty" data-testid="location-empty-complete">
              Coordenadas de conclusão não registradas pelo dispositivo.
            </div>
          }
        </article>
      </div>

      @if (hasAnyCoords()) {
        <div class="map-visual-card">
          <div class="map-visual-toolbar">
            <div class="map-summary">
              <strong>{{ siteName || 'Local da Inspeção' }}</strong>
              @if (siteAddress) {
                <span> • {{ siteAddress }}</span>
              }
              @if (distanceLabel(); as dist) {
                <span class="distance-pill" data-testid="location-distance-pill">
                  Deslocamento início → fim: {{ dist }}
                </span>
              }
            </div>

            <div class="map-toolbar-actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                (click)="toggleEmbed()"
                data-testid="toggle-osm-embed-btn"
              >
                {{ showEmbed() ? 'Ver mapa esquemático' : 'Carregar mapa OpenStreetMap' }}
              </button>
            </div>
          </div>

          @if (showEmbed() && embedSafeUrl(); as iframeUrl) {
            <iframe
              class="osm-iframe"
              title="Mapa OpenStreetMap da inspeção"
              [src]="iframeUrl"
              loading="lazy"
              data-testid="osm-embed-iframe"
            ></iframe>
          } @else {
            <svg
              class="vector-map"
              viewBox="0 0 420 170"
              role="img"
              aria-label="Mapa vetorial das coordenadas de início e conclusão"
              data-testid="location-vector-map"
            >
              <rect x="0" y="0" width="420" height="170" rx="10" fill="#f1f5f9" />
              <path
                d="M0 42 H420 M0 85 H420 M0 128 H420 M70 0 V170 M140 0 V170 M210 0 V170 M280 0 V170 M350 0 V170"
                stroke="#e2e8f0"
                stroke-width="1"
              />
              @if (plottedStart(); as startPt) {
                @if (plottedComplete(); as endPt) {
                  <line
                    [attr.x1]="startPt.x"
                    [attr.y1]="startPt.y"
                    [attr.x2]="endPt.x"
                    [attr.y2]="endPt.y"
                    stroke="#0f766e"
                    stroke-width="2"
                    stroke-dasharray="5 4"
                  />
                }
              }
              @if (plottedStart(); as startPt) {
                <g>
                  <circle [attr.cx]="startPt.x" [attr.cy]="startPt.y" r="16" fill="rgba(37, 99, 235, 0.16)" />
                  <circle [attr.cx]="startPt.x" [attr.cy]="startPt.y" r="8" fill="#2563eb" stroke="#fff" stroke-width="2" />
                  <text [attr.x]="startPt.x + 12" [attr.y]="startPt.y + 4" font-size="11" font-weight="700" fill="#1e3a8a">
                    Início (A)
                  </text>
                </g>
              }
              @if (plottedComplete(); as endPt) {
                <g>
                  <circle [attr.cx]="endPt.x" [attr.cy]="endPt.y" r="16" fill="rgba(5, 150, 105, 0.16)" />
                  <circle [attr.cx]="endPt.x" [attr.cy]="endPt.y" r="8" fill="#059669" stroke="#fff" stroke-width="2" />
                  <text [attr.x]="endPt.x + 12" [attr.y]="endPt.y + 4" font-size="11" font-weight="700" fill="#065f46">
                    Conclusão (B)
                  </text>
                </g>
              }
            </svg>
          }
        </div>
      } @else {
        <div class="coord-empty-banner" data-testid="location-empty-all">
          Nenhuma coordenada geográfica foi capturada no início ou na conclusão desta inspeção.
        </div>
      }
    </section>
  `,
  styles: [
    `
      .location-panel {
        display: grid;
        gap: 0.9rem;
      }

      .location-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 0.85rem;
      }

      .coord-card {
        border: 1px solid #e2e8f0;
        border-radius: 0.7rem;
        padding: 0.85rem;
        background: #f8fafc;
        display: grid;
        gap: 0.55rem;
      }

      .coord-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .coord-pin {
        font-size: 0.76rem;
        font-weight: 800;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
      }

      .pin-start {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }

      .pin-complete {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
      }

      .coord-time {
        font-size: 0.78rem;
        color: #64748b;
      }

      .coord-values {
        display: grid;
        gap: 0.2rem;

        strong {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.86rem;
          color: #0f172a;
        }
      }

      .coord-accuracy {
        font-size: 0.78rem;
        color: #475569;
      }

      .osm-link {
        justify-self: start;
      }

      .coord-empty,
      .coord-empty-banner {
        font-size: 0.84rem;
        color: #64748b;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 0.65rem;
        padding: 0.7rem 0.85rem;
      }

      .map-visual-card {
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 0.85rem;
        background: #ffffff;
        display: grid;
        gap: 0.7rem;
      }

      .map-visual-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .map-summary {
        font-size: 0.84rem;
        color: #334155;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .distance-pill {
        padding: 0.16rem 0.55rem;
        border-radius: 999px;
        background: #f0fdfa;
        border: 1px solid #99f6e4;
        color: #0f766e;
        font-size: 0.76rem;
        font-weight: 700;
      }

      .vector-map {
        width: 100%;
        height: 170px;
        border-radius: 0.6rem;
        border: 1px solid #e2e8f0;
        display: block;
      }

      .osm-iframe {
        width: 100%;
        height: 240px;
        border: 1px solid #cbd5e1;
        border-radius: 0.6rem;
      }
    `,
  ],
})
export class LocationMapComponent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input() startLatitude: number | null | undefined = null;
  @Input() startLongitude: number | null | undefined = null;
  @Input() startAccuracy: number | null | undefined = null;
  @Input() startedAt: string | null | undefined = null;

  @Input() completeLatitude: number | null | undefined = null;
  @Input() completeLongitude: number | null | undefined = null;
  @Input() completeAccuracy: number | null | undefined = null;
  @Input() completedAt: string | null | undefined = null;

  @Input() siteName: string | null | undefined = null;
  @Input() siteAddress: string | null | undefined = null;

  readonly showEmbed = signal(false);

  hasStartCoords(): boolean {
    return this.isValidCoord(this.startLatitude, this.startLongitude);
  }

  hasCompleteCoords(): boolean {
    return this.isValidCoord(this.completeLatitude, this.completeLongitude);
  }

  hasAnyCoords(): boolean {
    return this.hasStartCoords() || this.hasCompleteCoords();
  }

  formatCoordinates(lat: number | null | undefined, lng: number | null | undefined): string {
    if (!this.isValidCoord(lat, lng)) {
      return '—';
    }
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const latDir = latNum >= 0 ? 'N' : 'S';
    const lngDir = lngNum >= 0 ? 'L' : 'O';
    return `${latNum.toFixed(6)} (${Math.abs(latNum).toFixed(5)}° ${latDir}), ${lngNum.toFixed(6)} (${Math.abs(lngNum).toFixed(5)}° ${lngDir})`;
  }

  formatNumber(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '—';
    }
    return Number(value).toFixed(digits);
  }

  osmUrl(lat: number | null | undefined, lng: number | null | undefined): string {
    if (!this.isValidCoord(lat, lng)) {
      return 'https://www.openstreetmap.org';
    }
    const latStr = Number(lat).toFixed(6);
    const lngStr = Number(lng).toFixed(6);
    return `https://www.openstreetmap.org/?mlat=${latStr}&mlon=${lngStr}#map=17/${latStr}/${lngStr}`;
  }

  distanceLabel(): string | null {
    if (!this.hasStartCoords() || !this.hasCompleteCoords()) {
      return null;
    }
    const meters = this.haversineMeters(
      Number(this.startLatitude),
      Number(this.startLongitude),
      Number(this.completeLatitude),
      Number(this.completeLongitude)
    );
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  }

  plottedStart(): PlottedPoint | null {
    if (!this.hasStartCoords()) {
      return null;
    }
    return this.projectPoint(
      Number(this.startLatitude),
      Number(this.startLongitude),
      this.startAccuracy ?? null,
      true
    );
  }

  plottedComplete(): PlottedPoint | null {
    if (!this.hasCompleteCoords()) {
      return null;
    }
    return this.projectPoint(
      Number(this.completeLatitude),
      Number(this.completeLongitude),
      this.completeAccuracy ?? null,
      false
    );
  }

  toggleEmbed(): void {
    this.showEmbed.update((value) => !value);
  }

  embedSafeUrl(): SafeResourceUrl | null {
    const lat = this.hasStartCoords()
      ? Number(this.startLatitude)
      : this.hasCompleteCoords()
        ? Number(this.completeLatitude)
        : null;
    const lng = this.hasStartCoords()
      ? Number(this.startLongitude)
      : this.hasCompleteCoords()
        ? Number(this.completeLongitude)
        : null;
    if (lat === null || lng === null) {
      return null;
    }
    const delta = 0.004;
    const bbox = `${(lng - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lng + delta).toFixed(6)},${(lat + delta).toFixed(6)}`;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  private projectPoint(
    lat: number,
    lng: number,
    accuracy: number | null,
    isStart: boolean
  ): PlottedPoint {
    if (this.hasStartCoords() && this.hasCompleteCoords()) {
      const sLat = Number(this.startLatitude);
      const sLng = Number(this.startLongitude);
      const cLat = Number(this.completeLatitude);
      const cLng = Number(this.completeLongitude);
      const minLat = Math.min(sLat, cLat);
      const maxLat = Math.max(sLat, cLat);
      const minLng = Math.min(sLng, cLng);
      const maxLng = Math.max(sLng, cLng);
      const spanLat = maxLat - minLat;
      const spanLng = maxLng - minLng;

      if (spanLat < 0.00001 && spanLng < 0.00001) {
        return { x: isStart ? 185 : 225, y: 85, lat, lng, accuracy };
      }

      const normX = spanLng > 0 ? (lng - minLng) / spanLng : 0.5;
      const normY = spanLat > 0 ? 1 - (lat - minLat) / spanLat : 0.5;
      return {
        x: Math.round(90 + normX * 220),
        y: Math.round(35 + normY * 100),
        lat,
        lng,
        accuracy,
      };
    }
    return { x: 195, y: 85, lat, lng, accuracy };
  }

  private isValidCoord(lat: number | null | undefined, lng: number | null | undefined): boolean {
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return false;
    }
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return (
      Number.isFinite(latNum) &&
      Number.isFinite(lngNum) &&
      latNum >= -90 &&
      latNum <= 90 &&
      lngNum >= -180 &&
      lngNum <= 180
    );
  }

  private haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusMeters = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
  }
}
