// Realtime WebSocket Manager For Sensor Telemetry Ingestion Stream
// Maintains Resilient Reconnection And Dispatches Inbound Events

type TelemetryListener = (packet: any) => void;

class WebSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Set<TelemetryListener> = new Set();
  private isConnecting: boolean = false;
  private reconnectTimer: number | null = null;

  public Connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    console.log(`Connecting To Realtime Telemetry Gateway At ${wsUrl}`);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('Realtime WebSocket Connection Established Successfully');
        this.isConnecting = false;
        const token = localStorage.getItem('airroute_token');
        if (token) {
          this.socket?.send(JSON.stringify({ type: 'subscribe', token }));
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry_update') {
            this.listeners.forEach((listener) => listener(data));
          }
        } catch (err) {
          console.error('Failed To Parse Inbound WebSocket Payload');
        }
      };

      this.socket.onclose = () => {
        console.log('Realtime WebSocket Disconnected. Scheduling Automatic Reconnection...');
        this.isConnecting = false;
        this.socket = null;
        if (!this.reconnectTimer) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.Connect();
          }, 3000);
        }
      };

      this.socket.onerror = (err) => {
        console.error('WebSocket Communication Fault Detected');
      };
    } catch (e) {
      this.isConnecting = false;
      console.error('Failed To Initialize WebSocket Client');
    }
  }

  public Subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.Connect();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const WebSocketService = new WebSocketManager();
