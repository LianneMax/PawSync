try {
  const { NFC } = require('nfc-pcsc');
  const nfc = new NFC();

  if (process.send) process.send({ type: 'ready' });

  nfc.on('reader', (reader: any) => {
    if (process.send) process.send({ type: 'reader:connect', data: { name: reader.name, connected: true } });

    reader.on('card', (card: any) => {
      if (process.send) process.send({
        type: 'card',
        data: { reader: reader.name, uid: card.uid, atr: card.atr.toString('hex') },
      });
    });

    reader.on('card.off', (card: any) => {
      if (process.send) process.send({
        type: 'card:remove',
        data: { reader: reader.name, uid: card.uid },
      });
    });

    reader.on('error', (err: Error) => {
      if (process.send) process.send({ type: 'error', data: err.message });
    });

    reader.on('end', () => {
      if (process.send) process.send({ type: 'reader:disconnect', data: { name: reader.name, connected: false } });
    });
  });

  nfc.on('error', (err: Error) => {
    if (process.send) process.send({ type: 'error', data: err.message });
  });
} catch (err: any) {
  if (process.send) process.send({ type: 'init-failed', data: err.message });
  process.exit(0);
}
