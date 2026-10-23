"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAction } from "@/server/action";
import { assertUser } from "@/server/auth/dal";
import { clearSessionCookie, invalidateSessionByToken, readSessionToken } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { getRequestContext } from "@/server/security/request";
import { enforceRateLimits } from "@/server/security/rate-limit";
import * as auth from "@/server/services/auth";
import {
  changePasswordSchema,
  disableMfaSchema,
  emailOnlySchema,
  loginSchema,
  mfaCodeSchema,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/validation/auth";

export const signUpAction = createAction(signUpSchema, async (input) => {
  await auth.signUp(input, await getRequestContext());
  redirect(`/verificar-email?enviado=1`);
});

export const loginAction = createAction(loginSchema, async (input) => {
  const outcome = await auth.login(input.email, input.password, await getRequestContext());
  const next = input.next ? `?next=${encodeURIComponent(input.next)}` : "";
  if (outcome.status === "mfa_required") redirect(`/entrar/verificacao${next}`);
  if (!outcome.verified) redirect("/verificar-email");
  redirect(input.next ?? "/minha-conta");
});

export const completeMfaAction = createAction(
  mfaCodeSchema.extend({ next: loginSchema.shape.next }),
  async (input) => {
    await auth.completeMfa(input.code, await getRequestContext());
    redirect(input.next ?? "/minha-conta");
  },
);

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    const ctx = await getRequestContext();
    await invalidateSessionByToken(token);
    await audit({ action: "auth.logout", ipHash: ctx.ipHash });
  }
  await clearSessionCookie();
  redirect("/");
}

export const verifyEmailAction = createAction(z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{30,64}$/, "Link inválido.") }), async ({ token }) => {
  const ctx = await getRequestContext();
  await enforceRateLimits([{ key: `verify-email:ip:${ctx.ipHash}`, limit: 30, windowSeconds: 3600 }]);
  const ok = await auth.verifyEmail(token);
  if (!ok) return { ok: false, error: "Link inválido ou expirado." };
  redirect("/entrar?verificado=1");
});

export const resendVerificationAction =createAction(emailOnlySchema, async ({ email }) => {
  await auth.resendVerification(email, await getRequestContext());
  return { ok: true, message: "Se houver uma conta pendente com esse e-mail, enviaremos um novo link." };
});

export const requestPasswordResetAction = createAction(emailOnlySchema, async ({ email }) => {
  await auth.requestPasswordReset(email, await getRequestContext());
  return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };
});

export const resetPasswordAction = createAction(resetPasswordSchema, async (input) => {
  await auth.resetPassword(input.token, input.password, await getRequestContext());
  redirect("/entrar?senha=redefinida");
});

export const changePasswordAction = createAction(changePasswordSchema, async (input) => {
  const user = await assertUser({ allowUnverified: true });
  await auth.changePassword(user.id, input.current, input.password, await getRequestContext());
  return { ok: true, message: "Senha alterada. As outras sessões foram encerradas." };
});

export const startMfaSetupAction = createAction(z.object({}), async () => {
  const user = await assertUser();
  const { secret, uri } = await auth.startMfaSetup(user.id);
  const QRCode = await import("qrcode");
  // Data URL PNG (renderizada via <img>, sem injetar HTML).
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { ok: true, data: { secret, qrDataUrl } };
});

export const confirmMfaSetupAction = createAction(
  z.object({ code: z.string().trim().regex(/^\d{6}$/, "Informe o código de 6 dígitos.") }),
  async ({ code }) => {
    const user = await assertUser();
    const recoveryCodes = await auth.confirmMfaSetup(user.id, code, await getRequestContext());
    return { ok: true, data: { recoveryCodes } };
  },
);

export const disableMfaAction = createAction(disableMfaSchema, async (input) => {
  const user = await assertUser();
  await auth.disableMfa(user.id, input.password, input.code, await getRequestContext());
  return { ok: true, message: "Verificação em duas etapas desativada." };
});
