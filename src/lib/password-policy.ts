// Política de senha alinhada ao NIST SP 800-63B: comprimento mínimo,
// sem regras de composição arbitrárias, bloqueio de senhas comuns/contextuais.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678910",
  "0123456789",
  "qwertyuiop",
  "password123",
  "senha12345",
  "senha123456",
  "minhasenha",
  "mudar12345",
  "abcdefghij",
  "brasil2026",
  "iloveyou12",
  "aaaaaaaaaa",
  "1111111111",
  "1q2w3e4r5t",
  "q1w2e3r4t5",
  "trocar1234",
  "emprego123",
  "empregoagora",
]);

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

export function checkPasswordPolicy(password: string, context: string[] = []): PasswordCheck {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, reason: `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.` };
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(password)) {
    return { ok: false, reason: "Essa senha é muito comum. Escolha outra." };
  }
  // Cada parte do nome e o usuário do e-mail (>= 4 letras) não podem aparecer na senha.
  const tokens = context.flatMap((item) => item.toLowerCase().split("@")[0].split(/[\s._+-]+/));
  for (const token of tokens) {
    if (token.length >= 4 && lower.includes(token)) {
      return { ok: false, reason: "A senha não deve conter seu nome ou e-mail." };
    }
  }
  return { ok: true };
}
