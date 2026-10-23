// TOTP (RFC 6238) com HMAC-SHA1, 6 dígitos e passo de 30 s — compatível com
// Google Authenticator, Microsoft Authenticator, 1Password, Aegis etc.
import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Base32 inválido");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function totpCounter(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

/**
 * Verifica um código aceitando ±1 passo de tolerância de relógio.
 * Retorna o contador usado (para impedir reutilização) ou null.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  opts: { nowMs: number; lastUsedCounter?: number | null; window?: number },
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpCounter(opts.nowMs);
  const window = opts.window ?? 1;
  for (let i = -window; i <= window; i++) {
    const counter = current + i;
    if (opts.lastUsedCounter != null && counter <= opts.lastUsedCounter) continue;
    if (hotp(secret, counter) === code) return counter;
  }
  return null;
}

export function totpUri(secretBase32: string, account: string, issuer = "Emprego Agora"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
