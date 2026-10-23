import "server-only";
import type { MailMessage } from "@/server/mail/mailer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Block = { kind: "p"; text: string } | { kind: "button"; label: string; url: string } | { kind: "small"; text: string };

function render(to: string, subject: string, blocks: Block[]): MailMessage {
  const text = blocks
    .map((b) => (b.kind === "button" ? `${b.label}: ${b.url}` : b.text))
    .concat(["", "— Emprego Agora", "Você recebeu este e-mail por causa da sua conta no Emprego Agora."])
    .join("\n\n");

  const body = blocks
    .map((b) => {
      if (b.kind === "button") {
        return `<p style="margin:24px 0"><a href="${escapeHtml(b.url)}" style="background:#047857;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(b.label)}</a></p><p style="font-size:12px;color:#64748b">Se o botão não funcionar, copie e cole: ${escapeHtml(b.url)}</p>`;
      }
      if (b.kind === "small") return `<p style="font-size:13px;color:#64748b">${escapeHtml(b.text)}</p>`;
      return `<p style="margin:0 0 12px">${escapeHtml(b.text)}</p>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><div style="max-width:560px;margin:0 auto;padding:32px 16px"><div style="font-weight:700;font-size:18px;color:#0b3b46;margin-bottom:16px">Emprego Agora</div><div style="background:#fff;border-radius:12px;padding:28px;line-height:1.55">${body}</div><p style="font-size:12px;color:#64748b;margin-top:16px">Você recebeu este e-mail por causa da sua conta no Emprego Agora. Gerencie suas preferências de comunicação em Minha conta → Privacidade.</p></div></body></html>`;

  return { to, subject, text, html };
}

export const mail = {
  verifyEmail: (to: string, name: string, url: string) =>
    render(to, "Confirme seu e-mail", [
      { kind: "p", text: `Olá, ${name}!` },
      { kind: "p", text: "Confirme seu endereço de e-mail para ativar sua conta no Emprego Agora." },
      { kind: "button", label: "Confirmar e-mail", url },
      { kind: "small", text: "O link expira em 24 horas. Se você não criou esta conta, ignore esta mensagem." },
    ]),

  signupAttemptExisting: (to: string, loginUrl: string, resetUrl: string) =>
    render(to, "Tentativa de cadastro com seu e-mail", [
      { kind: "p", text: "Alguém tentou criar uma conta no Emprego Agora usando este e-mail, que já está cadastrado." },
      { kind: "p", text: "Se foi você, basta entrar normalmente ou redefinir sua senha." },
      { kind: "button", label: "Entrar", url: loginUrl },
      { kind: "small", text: `Esqueceu a senha? ${resetUrl}. Se não foi você, nenhuma ação é necessária.` },
    ]),

  passwordReset: (to: string, url: string) =>
    render(to, "Redefinição de senha", [
      { kind: "p", text: "Recebemos um pedido para redefinir a senha da sua conta." },
      { kind: "button", label: "Redefinir senha", url },
      { kind: "small", text: "O link expira em 1 hora e só pode ser usado uma vez. Se você não pediu, ignore este e-mail — sua senha continua a mesma." },
    ]),

  passwordChanged: (to: string) =>
    render(to, "Sua senha foi alterada", [
      { kind: "p", text: "A senha da sua conta no Emprego Agora foi alterada e todas as sessões foram encerradas." },
      { kind: "small", text: "Se não foi você, redefina sua senha imediatamente e fale com nosso canal de segurança." },
    ]),

  applicationStatus: (to: string, jobTitle: string, orgName: string, statusLabel: string, url: string, message?: string | null) =>
    render(to, `Atualização da sua candidatura: ${statusLabel}`, [
      { kind: "p", text: `Sua candidatura para "${jobTitle}" em ${orgName} mudou para: ${statusLabel}.` },
      ...(message ? [{ kind: "p" as const, text: `Mensagem da empresa: ${message}` }] : []),
      { kind: "button", label: "Ver candidatura", url },
    ]),

  applicationReceived: (to: string, jobTitle: string, url: string) =>
    render(to, `Nova candidatura: ${jobTitle}`, [
      { kind: "p", text: `Uma nova candidatura foi enviada para a vaga "${jobTitle}".` },
      { kind: "button", label: "Ver candidaturas", url },
    ]),

  jobAlert: (to: string, alertName: string, jobs: { title: string; org: string; url: string }[], manageUrl: string) =>
    render(to, `${jobs.length} nova(s) vaga(s) para "${alertName}"`, [
      { kind: "p", text: `Encontramos vagas novas que combinam com o seu alerta "${alertName}":` },
      ...jobs.slice(0, 10).map((j) => ({ kind: "p" as const, text: `• ${j.title} — ${j.org}: ${j.url}` })),
      { kind: "small", text: `Para editar ou desativar este alerta: ${manageUrl}` },
    ]),

  orgInvite: (to: string, orgName: string, roleLabel: string, url: string) =>
    render(to, `Convite para ${orgName} no Emprego Agora`, [
      { kind: "p", text: `Você foi convidado(a) para participar de ${orgName} como ${roleLabel}.` },
      { kind: "button", label: "Aceitar convite", url },
      { kind: "small", text: "O convite expira em 7 dias. Você precisará entrar com este mesmo e-mail." },
    ]),

  orgVerification: (to: string, orgName: string, approved: boolean, notes?: string | null) =>
    render(to, approved ? `${orgName} foi verificada` : `Verificação de ${orgName}`, [
      {
        kind: "p",
        text: approved
          ? `A empresa ${orgName} foi verificada. Agora vocês já podem publicar vagas.`
          : `Não foi possível verificar a empresa ${orgName} neste momento.`,
      },
      ...(notes ? [{ kind: "p" as const, text: `Observações da equipe: ${notes}` }] : []),
    ]),

  privacyRequestReceived: (to: string, protocol: string, dueDate: string) =>
    render(to, `Solicitação de privacidade recebida — protocolo ${protocol}`, [
      { kind: "p", text: `Recebemos sua solicitação relativa a dados pessoais. Protocolo: ${protocol}.` },
      { kind: "p", text: `Prazo estimado de resposta: até ${dueDate}.` },
      { kind: "small", text: "Podemos pedir informações adicionais para confirmar sua identidade antes de atender ao pedido." },
    ]),
};
