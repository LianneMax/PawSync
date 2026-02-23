import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { nfcService } from '../services/nfcService';

export function initNfcWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws/nfc' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connected to /ws/nfc');

    // Send current reader list on connect
    ws.send(JSON.stringify({
      type: 'readers',
      data: nfcService.getReaders(),
    }));

    // Forward NFC events to this client
    const onCard = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'card', data: event }));
      }
    };

    const onCardRemove = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'card:remove', data: event }));
      }
    };

    const onReaderConnect = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'reader:connect', data: event }));
      }
    };

    const onReaderDisconnect = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'reader:disconnect', data: event }));
      }
    };

    // Write progress events (waiting → card-detected → writing → verifying → complete/timeout)
    const onWriteProgress = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'write:progress', data: event }));
      }
    };

    const onWriteComplete = (event: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'write:complete', data: event }));
      }
    };

    nfcService.on('card', onCard);
    nfcService.on('card:remove', onCardRemove);
    nfcService.on('reader:connect', onReaderConnect);
    nfcService.on('reader:disconnect', onReaderDisconnect);
    nfcService.on('write:progress', onWriteProgress);
    nfcService.on('card:write-complete', onWriteComplete);

    ws.on('close', () => {
      console.log('[WS] Client disconnected from /ws/nfc');
      nfcService.off('card', onCard);
      nfcService.off('card:remove', onCardRemove);
      nfcService.off('reader:connect', onReaderConnect);
      nfcService.off('reader:disconnect', onReaderDisconnect);
      nfcService.off('write:progress', onWriteProgress);
      nfcService.off('card:write-complete', onWriteComplete);
    });
  });

  console.log('[WS] NFC WebSocket server ready at /ws/nfc');
}
