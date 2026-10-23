import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/server/env";
import { maskEmail } from "@/lib/redact";

export type MailMessage = { to: string; subject: string; text: string; html: string };

let transporter: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const e = env();
  if (!e.SMTP_HOST) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE ?? e.SMTP_PORT === 465,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    // Em produção exige TLS válido; em dev o Mailpit não usa TLS.
    requireTLS: e.isProduction && e.SMTP_PORT !== 465,
  });
  return transporter;
}

/**
 * Envia e-mail transacional. Sem SMTP configurado (apenas fora de produção),
 * o conteúdo é exibido no console do servidor para permitir testes locais.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    if (env().isProduction) throw new Error("SMTP não configurado");
    console.info(`[mail:dev] para=${maskEmail(message.to)} assunto="${message.subject}"\n${message.text}\n`);
    return;
  }
  await transport.sendMail({ from: env().MAIL_FROM, ...message });
}

/** Envio que não deve interromper o fluxo do usuário (ex.: notificações). */
export async function sendMailSafe(message: MailMessage): Promise<boolean> {
  try {
    await sendMail(message);
    return true;
  } catch (err) {
    console.error("[mail] falha no envio", maskEmail(message.to), err instanceof Error ? err.message : err);
    return false;
  }
}
