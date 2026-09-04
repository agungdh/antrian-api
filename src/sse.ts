const clients = new Set<ReadableStreamDefaultController<string>>();
const encoder = new TextEncoder();

function encode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Daftarkan koneksi SSE baru. */
export function addClient(c: ReadableStreamDefaultController<string>) {
  clients.add(c);
}

export function removeClient(c: ReadableStreamDefaultController<string>) {
  clients.delete(c);
}

export function clientCount(): number {
  return clients.size;
}

/** Kirim snapshot penuh ke satu koneksi (dipakai langsung saat TV connect). */
export function sendToOne(
  c: ReadableStreamDefaultController<string>,
  event: string,
  data: unknown
) {
  try {
    c.enqueue(encode(event, data));
  } catch {
    removeClient(c);
  }
}

/** Broadcast ke semua TV/kios yang connect. */
export function broadcast(event: string, data: unknown) {
  const msg = encode(event, data);
  for (const c of [...clients]) {
    try {
      c.enqueue(msg);
    } catch {
      clients.delete(c);
    }
  }
}

/** Heartbeat agar proxy tidak memutus koneksi idle. */
setInterval(() => {
  const ping = `: ping ${Date.now()}\n\n`;
  for (const c of [...clients]) {
    try {
      c.enqueue(ping);
    } catch {
      clients.delete(c);
    }
  }
}, 20_000);

export function sseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

export function encodeChunk(s: string): Uint8Array {
  return encoder.encode(s);
}
