import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as ExpoLocation from 'expo-location';
import { WebView } from 'react-native-webview';
import { tokens } from '@/design-system/tokens';

export const DEFAULT_LOCATION_TIMEOUT_MS = 8000;
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors • Leaflet';

export type LocationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

export type LocationCaptureStatus =
  | 'CAPTURED'
  | 'PERMISSION_DENIED'
  | 'TIMEOUT'
  | 'SERVICE_DISABLED'
  | 'ERROR';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: string;
}

export interface LocationCaptureResult {
  captured: boolean;
  status: LocationCaptureStatus;
  permissionStatus: LocationPermissionStatus;
  coordinates: LocationCoordinates | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  message: string;
  guidance?: string;
}

export interface RawPermissionResponse {
  status?: string;
  granted?: boolean;
  canAskAgain?: boolean;
}

export interface RawPositionResponse {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  timestamp?: number;
}

export interface LocationProviderAdapter {
  getForegroundPermissionsAsync: () => Promise<RawPermissionResponse>;
  requestForegroundPermissionsAsync: () => Promise<RawPermissionResponse>;
  hasServicesEnabledAsync?: () => Promise<boolean>;
  getCurrentPositionAsync: (options?: {
    accuracy?: number;
  }) => Promise<RawPositionResponse>;
}

export interface CaptureLocationOptions {
  timeoutMs?: number;
  accuracy?: number;
  locationProvider?: LocationProviderAdapter;
  now?: () => Date;
}

export interface OsmLeafletHtmlParams {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  title?: string;
  subtitle?: string;
  zoom?: number;
}

export interface OsmLeafletMapProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  accuracy?: number | null;
  title?: string;
  subtitle?: string;
  zoom?: number;
  height?: number;
  testID?: string;
}

function createDefaultLocationProvider(): LocationProviderAdapter {
  return {
    getForegroundPermissionsAsync: () => ExpoLocation.getForegroundPermissionsAsync(),
    requestForegroundPermissionsAsync: () => ExpoLocation.requestForegroundPermissionsAsync(),
    hasServicesEnabledAsync: () => ExpoLocation.hasServicesEnabledAsync(),
    getCurrentPositionAsync: (options) =>
      ExpoLocation.getCurrentPositionAsync({
        accuracy: options?.accuracy ?? ExpoLocation.Accuracy.Balanced,
      }),
  };
}

function normalizePermissionStatus(raw?: RawPermissionResponse | null): LocationPermissionStatus {
  if (!raw) return 'unavailable';
  if (raw.granted || raw.status === 'granted') return 'granted';
  if (raw.status === 'denied') return 'denied';
  return 'undetermined';
}

function formatPositionTimestamp(rawTimestamp: number | undefined, fallbackDate: Date): string {
  if (typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp) && rawTimestamp > 0) {
    const parsed = new Date(rawTimestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallbackDate.toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCoordinatesSummary(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  accuracy?: number | null
): string {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return 'Coordenadas não disponíveis';
  }
  const latStr = latitude.toFixed(6);
  const lngStr = longitude.toFixed(6);
  if (typeof accuracy === 'number' && Number.isFinite(accuracy)) {
    return `${latStr}, ${lngStr} (±${Math.round(accuracy)} m)`;
  }
  return `${latStr}, ${lngStr}`;
}

/**
 * Captura localização pontual via expo-location em primeiro plano com timeout seguro (RF-02, RT-01, RT-02, EX-01).
 * Nunca utiliza rastreamento contínuo ou em segundo plano no MVP (RN-060).
 * Nunca lança exceção bloqueante caso a permissão seja negada ou o sinal esteja indisponível.
 */
export async function captureCurrentLocation(
  options: CaptureLocationOptions = {}
): Promise<LocationCaptureResult> {
  const nowFn = options.now ?? (() => new Date());
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_LOCATION_TIMEOUT_MS;
  const provider = options.locationProvider ?? createDefaultLocationProvider();
  const capturedAtFallback = nowFn();

  try {
    // 1. Verifica/solicita permissão exclusivamente em primeiro plano (RN-058 / RT-01)
    let permissionResponse = await provider.getForegroundPermissionsAsync();
    let permissionStatus = normalizePermissionStatus(permissionResponse);

    if (permissionStatus !== 'granted' && permissionResponse?.canAskAgain !== false) {
      permissionResponse = await provider.requestForegroundPermissionsAsync();
      permissionStatus = normalizePermissionStatus(permissionResponse);
    }

    if (permissionStatus !== 'granted') {
      return {
        captured: false,
        status: 'PERMISSION_DENIED',
        permissionStatus: 'denied',
        coordinates: null,
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: nowFn().toISOString(),
        message: 'Permissão de localização negada. Inspeção seguirá sem coordenadas GPS.',
        guidance:
          'Ative a permissão de localização nas configurações do dispositivo para registrar coordenadas futuras.',
      };
    }

    // 2. Verifica se o serviço de localização/GPS está ativo
    if (typeof provider.hasServicesEnabledAsync === 'function') {
      const servicesEnabled = await provider.hasServicesEnabledAsync().catch(() => true);
      if (!servicesEnabled) {
        return {
          captured: false,
          status: 'SERVICE_DISABLED',
          permissionStatus: 'granted',
          coordinates: null,
          latitude: null,
          longitude: null,
          accuracy: null,
          timestamp: nowFn().toISOString(),
          message: 'GPS desativado no dispositivo. Inspeção registrada sem coordenadas.',
          guidance: 'Ative o GPS do aparelho se desejar capturar coordenadas em campo.',
        };
      }
    }

    // 3. Captura pontual protegida por timeout seguro
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error('LOCATION_TIMEOUT'));
      }, timeoutMs);
    });

    let position: RawPositionResponse;
    try {
      position = await Promise.race([
        provider.getCurrentPositionAsync({ accuracy: options.accuracy }),
        timeoutPromise,
      ]);
    } finally {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    }

    const lat = position?.coords?.latitude;
    const lng = position?.coords?.longitude;
    const acc =
      typeof position?.coords?.accuracy === 'number' && Number.isFinite(position.coords.accuracy)
        ? Number(position.coords.accuracy.toFixed(2))
        : null;

    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        captured: false,
        status: 'ERROR',
        permissionStatus: 'granted',
        coordinates: null,
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: nowFn().toISOString(),
        message: 'Coordenadas GPS indisponíveis no momento. Prosseguindo sem localização.',
      };
    }

    const timestamp = formatPositionTimestamp(position.timestamp, nowFn());
    const coordinates: LocationCoordinates = {
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      timestamp,
    };

    return {
      captured: true,
      status: 'CAPTURED',
      permissionStatus: 'granted',
      coordinates,
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      timestamp,
      message: `Localização registrada (${formatCoordinatesSummary(lat, lng, acc)}).`,
    };
  } catch (error: any) {
    const isTimeout =
      error?.message === 'LOCATION_TIMEOUT' ||
      String(error?.code ?? '').toUpperCase().includes('TIMEOUT') ||
      error?.code === 3;

    if (error?.code === 1 || String(error?.message ?? '').toLowerCase().includes('denied')) {
      return {
        captured: false,
        status: 'PERMISSION_DENIED',
        permissionStatus: 'denied',
        coordinates: null,
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: capturedAtFallback.toISOString(),
        message: 'Permissão de localização recusada. Operação registrada sem coordenadas GPS.',
        guidance: 'Você pode conceder acesso à localização nas permissões do navegador ou sistema.',
      };
    }

    return {
      captured: false,
      status: isTimeout ? 'TIMEOUT' : 'ERROR',
      permissionStatus: 'granted',
      coordinates: null,
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp: nowFn().toISOString(),
      message: isTimeout
        ? `Tempo limite (${timeoutMs}ms) atingido ao obter GPS. Operação concluída sem travar.`
        : 'Sinal de GPS indisponível no momento. Operação registrada sem coordenadas.',
      guidance: 'Em áreas cobertas ou sem sinal, o FieldOps registra a operação normalmente.',
    };
  }
}

export const getCurrentPositionSafe = captureCurrentLocation;

/**
 * Gera HTML autossuficiente com Leaflet + tiles OpenStreetMap (sem chave Google Maps)
 * para exibição em react-native-webview em dispositivos Android/iOS.
 */
export function buildOsmLeafletHtml(params: OsmLeafletHtmlParams): string {
  const lat = Number(params.latitude);
  const lng = Number(params.longitude);
  const zoom = params.zoom ?? 16;
  const accuracy =
    typeof params.accuracy === 'number' && Number.isFinite(params.accuracy) && params.accuracy > 0
      ? Math.round(params.accuracy)
      : null;
  const safeTitle = escapeHtml(params.title || 'Local da Inspeção');
  const safeSubtitle = escapeHtml(
    params.subtitle || formatCoordinatesSummary(lat, lng, accuracy)
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #e9eef5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .coord-pill {
      position: absolute;
      bottom: 8px;
      left: 8px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      color: #1e293b;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }
    .offline-fallback {
      display: none;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      text-align: center;
      padding: 16px;
      box-sizing: border-box;
      color: #1e293b;
      background: radial-gradient(circle at center, #dbeafe 0%, #f1f5f9 75%);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="offline-fallback" class="offline-fallback">
    <strong>${safeTitle}</strong>
    <span style="font-size:12px;margin-top:4px;">${safeSubtitle}</span>
    <span style="font-size:10px;color:#64748b;margin-top:6px;">${OSM_ATTRIBUTION}</span>
  </div>
  <div class="coord-pill">${safeTitle}: ${lat.toFixed(5)}, ${lng.toFixed(5)}${accuracy ? ` (±${accuracy} m)` : ''}</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      if (typeof L === 'undefined') {
        document.getElementById('map').style.display = 'none';
        document.getElementById('offline-fallback').style.display = 'flex';
        return;
      }
      var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], ${zoom});
      L.tileLayer('${OSM_TILE_URL}', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      var marker = L.circleMarker([${lat}, ${lng}], {
        radius: 8,
        color: '#004494',
        weight: 2,
        fillColor: '#0056b3',
        fillOpacity: 0.9
      }).addTo(map);
      marker.bindPopup('<strong>${safeTitle}</strong><br/>${safeSubtitle}').openPopup();
      ${
        accuracy
          ? `L.circle([${lat}, ${lng}], { radius: ${accuracy}, color: '#0056b3', fillColor: '#60a5fa', fillOpacity: 0.18, weight: 1 }).addTo(map);`
          : ''
      }
    })();
  </script>
</body>
</html>`;
}

function ensureLeafletCssInDocument(): void {
  if (typeof document === 'undefined') return;
  const styleId = 'fieldops-leaflet-css';
  if (!document.getElementById(styleId)) {
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  const fallbackStyleId = 'fieldops-leaflet-layout-css';
  if (!document.getElementById(fallbackStyleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = fallbackStyleId;
    styleEl.textContent =
      '.leaflet-container{width:100%;height:100%;background:#e9eef5;font-family:sans-serif;}';
    document.head.appendChild(styleEl);
  }
}

function WebBrowserOsmLeafletMap({
  latitude,
  longitude,
  accuracy,
  title = 'Local da Inspeção',
  subtitle,
  zoom = 16,
  height = 200,
  testID = 'osm-leaflet-map',
}: Required<Pick<OsmLeafletMapProps, 'latitude' | 'longitude'>> & OsmLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    let cancelled = false;
    let mapInstance: any = null;
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const initLeaflet = async () => {
      try {
        ensureLeafletCssInDocument();
        const leafletMod: any = await import('leaflet');
        if (cancelled) return;
        const L = leafletMod.default ?? leafletMod;
        if (!L || typeof L.map !== 'function') {
          setMapError(true);
          return;
        }

        containerEl.innerHTML = '';
        mapInstance = L.map(containerEl, { zoomControl: true }).setView(
          [latitude, longitude],
          zoom
        );
        L.tileLayer(OSM_TILE_URL, {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstance);

        const marker = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: '#004494',
          weight: 2,
          fillColor: '#0056b3',
          fillOpacity: 0.9,
        }).addTo(mapInstance);

        const labelText = subtitle || formatCoordinatesSummary(latitude, longitude, accuracy);
        marker.bindPopup(`<strong>${escapeHtml(title)}</strong><br/>${escapeHtml(labelText)}`);

        if (typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy > 0) {
          L.circle([latitude, longitude], {
            radius: accuracy,
            color: '#0056b3',
            fillColor: '#60a5fa',
            fillOpacity: 0.18,
            weight: 1,
          }).addTo(mapInstance);
        }

        setMapError(false);
      } catch {
        if (!cancelled) {
          setMapError(true);
        }
      }
    };

    void initLeaflet();

    return () => {
      cancelled = true;
      if (mapInstance && typeof mapInstance.remove === 'function') {
        mapInstance.remove();
      }
    };
  }, [latitude, longitude, accuracy, title, subtitle, zoom]);

  return React.createElement(
    View,
    { testID, style: [styles.mapContainer, { height }] },
    mapError
      ? React.createElement(
          View,
          { style: styles.mapFallbackBox },
          React.createElement(Text, { style: styles.mapFallbackTitle }, title),
          React.createElement(
            Text,
            { style: styles.mapFallbackCoords },
            formatCoordinatesSummary(latitude, longitude, accuracy)
          ),
          React.createElement(Text, { style: styles.mapAttribution }, OSM_ATTRIBUTION)
        )
      : React.createElement('div', {
          ref: containerRef,
          'data-osm-leaflet-web': 'true',
          style: { width: '100%', height: '100%', minHeight: `${height}px` },
        }),
    React.createElement(
      View,
      { style: styles.mapOverlayFooter },
      React.createElement(
        Text,
        { style: styles.mapOverlayText },
        `${title}: ${formatCoordinatesSummary(latitude, longitude, accuracy)} • ${OSM_ATTRIBUTION}`
      )
    )
  );
}

/**
 * Componente multiplataforma de mapa OpenStreetMap + Leaflet sem chave Google Maps.
 * - Mobile (iOS/Android): Leaflet via react-native-webview.
 * - Web: Leaflet diretamente no navegador (ou representação estruturada no SSR de testes).
 */
export function OsmLeafletMap({
  latitude,
  longitude,
  accuracy = null,
  title = 'Local da Inspeção',
  subtitle,
  zoom = 16,
  height = 200,
  testID = 'osm-leaflet-map',
}: OsmLeafletMapProps) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return React.createElement(
      View,
      { testID: `${testID}-unavailable`, style: [styles.mapUnavailableBox, { minHeight: 96 }] },
      React.createElement(Text, { style: styles.mapFallbackTitle }, title),
      React.createElement(
        Text,
        { style: styles.mapUnavailableText },
        'Coordenadas GPS não disponíveis para exibição no mapa OpenStreetMap.'
      )
    );
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return React.createElement(WebBrowserOsmLeafletMap, {
        latitude,
        longitude,
        accuracy,
        title,
        subtitle,
        zoom,
        height,
        testID,
      });
    }

    return React.createElement(
      View,
      { testID, style: [styles.mapContainer, styles.mapFallbackBox, { height }] },
      React.createElement(Text, { style: styles.mapFallbackTitle }, title),
      React.createElement(
        Text,
        { style: styles.mapFallbackCoords },
        formatCoordinatesSummary(latitude, longitude, accuracy)
      ),
      React.createElement(Text, { style: styles.mapAttribution }, OSM_ATTRIBUTION)
    );
  }

  const html = buildOsmLeafletHtml({
    latitude,
    longitude,
    accuracy,
    title,
    subtitle,
    zoom,
  });

  return React.createElement(
    View,
    { testID, style: [styles.mapContainer, { height }] },
    React.createElement(WebView, {
      originWhitelist: ['*'],
      source: { html },
      style: styles.webview,
      javaScriptEnabled: true,
      domStorageEnabled: true,
      scrollEnabled: false,
    })
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    width: '100%',
    borderRadius: tokens.borderRadius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#e9eef5',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mapFallbackBox: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.m,
    gap: 4,
  },
  mapFallbackTitle: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  mapFallbackCoords: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.primary,
    fontWeight: tokens.typography.fontWeights.medium,
  },
  mapAttribution: {
    fontSize: tokens.typography.fontSizes.small - 1,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  mapOverlayFooter: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingHorizontal: tokens.spacing.s,
    paddingVertical: 4,
  },
  mapOverlayText: {
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  mapUnavailableBox: {
    width: '100%',
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    padding: tokens.spacing.m,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  mapUnavailableText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
});
