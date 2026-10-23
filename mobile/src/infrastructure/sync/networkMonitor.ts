export type NetworkStatusListener = (isOnline: boolean) => void;

export interface INetworkMonitor {
  isOnline(): Promise<boolean>;
  checkConnectivity(): Promise<boolean>;
  subscribe(listener: NetworkStatusListener): () => void;
  setMockStatus(online: boolean | null): void;
  getMockStatus(): boolean | null;
}

/**
 * Monitor de conectividade de rede para operação Offline-First (SPEC-002).
 * Fornece detecção em tempo real, suporte a mock para testes e emissão de eventos.
 */
export class NetworkMonitor implements INetworkMonitor {
  private listeners: Set<NetworkStatusListener> = new Set();
  private mockOnline: boolean | null = null;
  private cachedOnline: boolean = true;
  private checkIntervalTimer: any = null;
  private pingUrl: string = 'https://clients3.google.com/generate_204';
  private pingTimeoutMs: number = 3000;

  constructor(options?: { pingUrl?: string; pingTimeoutMs?: number; initialOnline?: boolean }) {
    if (options?.pingUrl) this.pingUrl = options.pingUrl;
    if (options?.pingTimeoutMs) this.pingTimeoutMs = options.pingTimeoutMs;
    if (options?.initialOnline !== undefined) this.cachedOnline = options.initialOnline;
  }

  /**
   * Define um status simulado para testes e demonstração offline/online.
   * Passar `null` restaura a verificação real da rede.
   */
  setMockStatus(online: boolean | null): void {
    const prevStatus = this.mockOnline ?? this.cachedOnline;
    this.mockOnline = online;
    const newStatus = online ?? this.cachedOnline;

    if (prevStatus !== newStatus) {
      this.cachedOnline = newStatus;
      this.notifyListeners(newStatus);
    }
  }

  /**
   * Retorna o status de mock atual (ou null se inativo).
   */
  getMockStatus(): boolean | null {
    return this.mockOnline;
  }

  /**
   * Retorna se o dispositivo está atualmente com conexão ativa.
   */
  async isOnline(): Promise<boolean> {
    if (this.mockOnline !== null) {
      return this.mockOnline;
    }
    return this.checkConnectivity();
  }

  /**
   * Executa checagem ativa de conectividade através de ping HTTP com timeout.
   */
  async checkConnectivity(): Promise<boolean> {
    if (this.mockOnline !== null) {
      return this.mockOnline;
    }

    // Se estiver em ambiente com navigator.onLine desativado (Web/React Native Web)
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      this.updateState(false);
      return false;
    }

    if (typeof fetch === 'undefined') {
      return this.cachedOnline;
    }

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), this.pingTimeoutMs)
        : null;

      const response = await fetch(this.pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined,
      }).catch(() => null);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const isConnected = !!response && response.status < 500;
      this.updateState(isConnected);
      return isConnected;
    } catch {
      this.updateState(false);
      return false;
    }
  }

  /**
   * Inscreve um callback para ser notificado sobre mudanças no estado da conexão.
   * Retorna uma função para cancelar a inscrição.
   */
  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    // Notifica o estado atual imediatamente
    listener(this.mockOnline ?? this.cachedOnline);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Inicia verificação periódica de conectividade em segundo plano.
   */
  startAutoCheck(intervalMs: number = 10000): void {
    this.stopAutoCheck();
    this.checkIntervalTimer = setInterval(() => {
      this.checkConnectivity().catch(() => {});
    }, intervalMs);
  }

  /**
   * Para a verificação periódica de conectividade.
   */
  stopAutoCheck(): void {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }
  }

  private updateState(isOnline: boolean): void {
    if (this.cachedOnline !== isOnline) {
      this.cachedOnline = isOnline;
      this.notifyListeners(isOnline);
    }
  }

  private notifyListeners(isOnline: boolean): void {
    for (const listener of this.listeners) {
      try {
        listener(isOnline);
      } catch (err) {
        console.error('[NetworkMonitor] Erro no listener:', err);
      }
    }
  }
}

export const networkMonitor = new NetworkMonitor();
