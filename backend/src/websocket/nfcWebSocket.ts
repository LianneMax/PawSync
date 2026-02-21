import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { nfcService } from '../services/nfcService';

export function initNfcWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws/nfc' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connected to /ws/nfc');
    console.log(`[WS] Currently ${nfcService.getReaders().length} reader(s) available`);

    // Send current reader list on connect
    ws.send(JSON.stringify({
      type: 'readers',
      data: nfcService.getReaders(),
    }));

    // Forward NFC events to this client
    const onCard = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({ type: 'card', data: event });
        console.log('[WS] Sending card event to client:', event);
        ws.send(message);
      }
    };

    const onCardRemove = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'card:remove', data: event }));
      }
    };

    const onReaderConnect = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('[WS] Notifying client of reader connection:', event);
        ws.send(JSON.stringify({ type: 'reader:connect', data: event }));
      }
    };

    const onReaderDisconnect = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'reader:disconnect', data: event }));
      }
    };

    nfcService.on('card', onCard);
    nfcService.on('card:remove', onCardRemove);
    nfcService.on('reader:connect', onReaderConnect);
    nfcService.on('reader:disconnect', onReaderDisconnect);

    ws.on('close', () => {
      console.log('[WS] Client disconnected from /ws/nfc');
      console.log('[WS] Removed event listeners for disconnected client');
      nfcService.off('card', onCard);
      nfcService.off('card:remove', onCardRemove);
      nfcService.off('reader:connect', onReaderConnect);
      nfcService.off('reader:disconnect', onReaderDisconnect);
    });
  });

  console.log('[WS] NFC WebSocket server ready at /ws/nfc');
}
