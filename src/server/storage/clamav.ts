import "server-only";
import net from "node:net";

export type ScanResult = { status: "clean" } | { status: "infected"; signature: string } | { status: "error"; message: string };

/**
 * Cliente mínimo do protocolo clamd (comando INSTREAM).
 * https://docs.clamav.net/manual/Usage/Scanning.html#clamd
 */
export function scanWithClamd(buffer: Buffer, host: string, port: number, timeoutMs = 30_000): Promise<ScanResult> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    let settled = false;
    const done = (r: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(r);
    };

    socket.setTimeout(timeoutMs, () => done({ status: "error", message: "timeout" }));
    socket.on("error", (err) => done({ status: "error", message: err.message }));
    socket.on("data", (d) => chunks.push(d));
    socket.on("end", () => {
      const reply = Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim();
      if (/:\s*OK$/.test(reply)) return done({ status: "clean" });
      const found = reply.match(/:\s*(.+)\s+FOUND$/);
      if (found) return done({ status: "infected", signature: found[1] });
      done({ status: "error", message: reply || "resposta vazia" });
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const CHUNK = 64 * 1024;
      for (let i = 0; i < buffer.length; i += CHUNK) {
        const part = buffer.subarray(i, i + CHUNK);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        socket.write(len);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4)); // tamanho zero encerra o stream
    });
  });
}
