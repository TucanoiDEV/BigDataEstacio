"use server";

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getCurrentUser } from "@/server/auth/dal";
import { keyedHash } from "@/server/security/crypto";
import { getRequestContext } from "@/server/security/request";
import { enforceRateLimits } from "@/server/security/rate-limit";
import { createAction } from "@/server/action";
import { LEGAL_VERSIONS } from "@/lib/constants";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_DAYS, consentChoiceSchema, decodeConsent, encodeConsent } from "@/lib/consent";

/** Registra a escolha de cookies (prova de consentimento) e grava o cookie. */
export const saveConsentAction = createAction(consentChoiceSchema, async (choice) => {
  const ctx = await getRequestContext();
  await enforceRateLimits([{ key: `consent:ip:${ctx.ipHash}`, limit: 60, windowSeconds: 3600 }]);

  const store = await cookies();
  const now = Date.now();
  const previous = decodeConsent(store.get(CONSENT_COOKIE)?.value, now);
  const anonId = previous?.id ?? randomBytes(16).toString("base64url");
  const user = await getCurrentUser();

  await db.consentRecord.create({
    data: {
      userId: user?.id ?? null,
      anonymousIdHash: keyedHash(anonId),
      kind: "COOKIES",
      version: LEGAL_VERSIONS.cookies,
      action: choice.action,
      choices: { necessary: true, analytics: choice.analytics, marketing: choice.marketing },
      ipHash: ctx.ipHash,
    },
  });

  store.set(CONSENT_COOKIE, encodeConsent({ v: LEGAL_VERSIONS.cookies, a: choice.analytics, m: choice.marketing, t: now, id: anonId }), {
    httpOnly: false, // lido no navegador para decidir o carregamento de scripts opcionais
    secure: env().isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: CONSENT_MAX_AGE_DAYS * 86400,
  });
});
