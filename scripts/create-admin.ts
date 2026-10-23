// Concede o papel de administrador da plataforma. ÚNICA forma de criar admins
// (não há tela para isso, evitando elevação de privilégio pela interface).
//
// Uso: npm run admin:create -- --email pessoa@empresa.com --name "Nome"
// Senha: variável ADMIN_INITIAL_PASSWORD ou gerada aleatoriamente e exibida UMA vez.
// Em produção, o primeiro acesso exigirá configurar a verificação em duas etapas.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { db } from "@/server/db";
import { hashPassword } from "@/server/security/password";
import { checkPasswordPolicy } from "@/lib/password-policy";

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Informe --email válido.");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { platformRole: "PLATFORM_ADMIN", emailVerifiedAt: existing.emailVerifiedAt ?? new Date() } });
    await db.auditLog.create({ data: { actorUserId: null, action: "admin.role_granted_cli", targetType: "User", targetId: existing.id } });
    console.log(`Usuário existente promovido a administrador: ${email}`);
    return;
  }

  const generated = !process.env.ADMIN_INITIAL_PASSWORD;
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? randomBytes(18).toString("base64url");
  const policy = checkPasswordPolicy(password, [email]);
  if (!policy.ok) throw new Error(`ADMIN_INITIAL_PASSWORD inválida: ${policy.reason}`);

  const user = await db.user.create({
    data: {
      email,
      name: values.name?.trim() || "Administrador(a)",
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      platformRole: "PLATFORM_ADMIN",
      emailVerifiedAt: new Date(),
      commPreference: { create: {} },
    },
  });
  await db.auditLog.create({ data: { actorUserId: null, action: "admin.created_cli", targetType: "User", targetId: user.id } });
  console.log(`Administrador criado: ${email}`);
  if (generated) console.log(`Senha temporária (exibida uma única vez — troque após o primeiro acesso): ${password}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
