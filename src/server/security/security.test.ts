import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, hotp, totpUri, verifyTotp } from "@/server/security/totp";
import { decryptSecret, encryptSecret, keyedHash, randomToken, safeEqual, sha256 } from "@/server/security/crypto";
import { clientIpFrom } from "@/server/security/request";

describe("TOTP (RFC 6238)", () => {
  // Vetores oficiais do apêndice B da RFC 6238 (SHA-1, 8 dígitos, segredo ASCII "12345678901234567890").
  const secret = Buffer.from("12345678901234567890");
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("T=%i -> %s", (t, code) => {
    expect(hotp(secret, Math.floor(t / 30), 8)).toBe(code);
  });

  it("base32 ida e volta", () => {
    const s = generateTotpSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("aceita ±1 passo e bloqueia reutilização", () => {
    const s = generateTotpSecret();
    const now = 1_700_000_000_000;
    const counter = Math.floor(now / 1000 / 30);
    const code = hotp(base32Decode(s), counter);
    expect(verifyTotp(s, code, { nowMs: now })).toBe(counter);
    expect(verifyTotp(s, code, { nowMs: now + 30_000 })).toBe(counter);
    expect(verifyTotp(s, code, { nowMs: now + 90_000 })).toBeNull();
    expect(verifyTotp(s, code, { nowMs: now, lastUsedCounter: counter })).toBeNull();
    expect(verifyTotp(s, "12345", { nowMs: now })).toBeNull();
  });

  it("gera URI otpauth com emissor", () => {
    expect(totpUri("ABC", "a@b.com")).toMatch(/^otpauth:\/\/totp\/Emprego%20Agora%3Aa%40b\.com\?secret=ABC&issuer=Emprego\+Agora/);
  });
});

describe("criptografia", () => {
  it("AES-GCM ida e volta e detecção de adulteração", () => {
    const enc = encryptSecret("segredo-mfa");
    expect(enc).not.toContain("segredo");
    expect(decryptSecret(enc)).toBe("segredo-mfa");
    const parts = enc.split(".");
    parts[3] = Buffer.from("x".repeat(11)).toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("tokens aleatórios e hashes", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
    expect(sha256("a")).toHaveLength(64);
    expect(keyedHash("203.0.113.1")).toHaveLength(32);
    expect(keyedHash("203.0.113.1")).not.toBe(sha256("203.0.113.1").slice(0, 32));
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});

describe("IP do cliente", () => {
  it("sem proxy confiável usa o último salto (não falsificável pelo cliente)", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.5" });
    expect(clientIpFrom(h, false)).toBe("10.0.0.5");
    expect(clientIpFrom(h, true)).toBe("1.1.1.1");
    expect(clientIpFrom(new Headers(), false)).toBe("unknown");
  });
});
