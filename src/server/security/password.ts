import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Parâmetros Argon2id conforme recomendação OWASP (m=19 MiB, t=2, p=1).
const ARGON2_OPTIONS = {
  algorithm: 2, // Algorithm.Argon2id (const enum não pode ser importado com isolatedModules)
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Hash fixo usado quando o usuário não existe, para que o tempo de resposta
// do login não revele se o e-mail está cadastrado.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  await verifyPassword(await dummyHash, password);
}
