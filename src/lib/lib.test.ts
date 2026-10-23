import { describe, expect, it } from "vitest";
import { formatCnpj, isValidCnpj } from "@/lib/cnpj";
import { checkPasswordPolicy } from "@/lib/password-policy";
import { maskEmail, redact } from "@/lib/redact";
import { normalizeText, slugify, initials, paragraphs, cleanText } from "@/lib/text";
import { detectFraudSignals } from "@/lib/fraud";
import { candidateCanWithdraw, companyCanTransition } from "@/lib/application-status";
import { canManageRole, roleCan } from "@/server/authz/permissions";
import { safeNextPath, signUpSchema } from "@/lib/validation/auth";
import { jobSearchToParams, parseJobSearch } from "@/lib/validation/search";
import { jobSchema } from "@/lib/validation/job";
import { inspectPdf, sanitizeFileName } from "@/lib/file-validation";
import { decodeConsent, encodeConsent } from "@/lib/consent";
import { LEGAL_VERSIONS } from "@/lib/constants";
import { formatRelative, formatSalaryRange } from "@/lib/format";
import { escapeLike } from "@/server/services/search";

describe("CNPJ", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("política de senha", () => {
  it("exige tamanho mínimo e rejeita senhas comuns ou contextuais", () => {
    expect(checkPasswordPolicy("curta").ok).toBe(false);
    expect(checkPasswordPolicy("1234567890").ok).toBe(false);
    expect(checkPasswordPolicy("aaaaaaaaaaaa").ok).toBe(false);
    expect(checkPasswordPolicy("mariana-2026-xyz", ["Mariana Souza"]).ok).toBe(false);
    expect(checkPasswordPolicy("cavalo correto bateria grampo").ok).toBe(true);
  });
});

describe("redação de logs", () => {
  it("remove campos sensíveis e mascara e-mails", () => {
    const out = redact({ password: "x", token: "y", email: "maria.silva@example.com", nested: { cpf: "1", ok: 1 } }) as Record<string, unknown>;
    expect(out.password).toBe("[removido]");
    expect(out.token).toBe("[removido]");
    expect(out.email).toBe("m***@example.com");
    expect(out.nested).toEqual({ cpf: "[removido]", ok: 1 });
    expect(maskEmail("contato: a@b.com")).toBe("contato: a***@b.com");
  });
});

describe("texto", () => {
  it("normaliza, gera slugs e iniciais", () => {
    expect(normalizeText("  São   Paulo ")).toBe("sao paulo");
    expect(slugify("Ação & Cia. Ltda!")).toBe("acao-cia-ltda");
    expect(initials("Maria da Silva")).toBe("MS");
    expect(paragraphs("a\n\n b \n\n\n")).toEqual(["a", "b"]);
    expect(cleanText("ok\u0000\u0007 ")).toBe("ok");
  });
});

describe("sinais de fraude", () => {
  const base = { title: "Auxiliar", description: "", seniority: "JUNIOR", salaryMin: 2000, salaryMax: 2500 };
  it("detecta cobrança, contato por mensageiro e salário irreal", () => {
    expect(detectFraudSignals({ ...base, description: "É necessário pagar taxa de inscrição de R$ 50 via Pix." })).toContain("PAYMENT_REQUEST");
    expect(detectFraudSignals({ ...base, description: "Chama no WhatsApp (11) 98765-4321" })).toContain("MESSAGING_ONLY_CONTACT");
    expect(detectFraudSignals({ ...base, description: "Envie seu CPF e foto do documento" })).toContain("SENSITIVE_DATA_REQUEST");
    expect(detectFraudSignals({ ...base, seniority: "INTERN", salaryMax: 50000 })).toContain("UNREALISTIC_SALARY");
    expect(detectFraudSignals({ ...base, description: "Atendimento ao cliente em loja, escala 6x1, vale-transporte." })).toEqual([]);
    // Números longos (protocolos, códigos internos) não são confundidos com celular.
    expect(detectFraudSignals({ ...base, title: "Analista 1792769230197", description: "Requisição nº 20261023987654321." })).toEqual([]);
    expect(detectFraudSignals({ ...base, description: "Contato: 81 98765-4321" })).toContain("MESSAGING_ONLY_CONTACT");
  });
});

describe("transições de candidatura", () => {
  it("empresa segue o fluxo e estados finais são definitivos", () => {
    expect(companyCanTransition("SUBMITTED", "IN_REVIEW")).toBe(true);
    expect(companyCanTransition("IN_REVIEW", "APPROVED")).toBe(true);
    expect(companyCanTransition("SUBMITTED", "APPROVED")).toBe(false);
    expect(companyCanTransition("APPROVED", "REJECTED")).toBe(false);
    expect(companyCanTransition("WITHDRAWN", "IN_REVIEW")).toBe(false);
    expect(candidateCanWithdraw("INTERVIEW")).toBe(true);
    expect(candidateCanWithdraw("REJECTED")).toBe(false);
  });
});

describe("permissões por papel", () => {
  it("matriz e regras de concessão", () => {
    expect(roleCan("VIEWER", "applications.view")).toBe(true);
    expect(roleCan("VIEWER", "applications.update")).toBe(false);
    expect(roleCan("RECRUITER", "org.members.manage")).toBe(false);
    expect(canManageRole("ADMIN", "RECRUITER")).toBe(true);
    expect(canManageRole("ADMIN", "OWNER")).toBe(false);
    expect(canManageRole("RECRUITER", "VIEWER")).toBe(false);
    expect(canManageRole("OWNER", "OWNER")).toBe(true);
  });
});

describe("validação", () => {
  it("impede open redirect no parâmetro next", () => {
    expect(safeNextPath.parse("/minha-conta")).toBe("/minha-conta");
    expect(safeNextPath.parse("//evil.com")).toBeUndefined();
    expect(safeNextPath.parse("https://evil.com")).toBeUndefined();
    expect(safeNextPath.parse("/\\evil.com")).toBeUndefined();
  });

  it("cadastro exige aceite e normaliza e-mail", () => {
    const ok = signUpSchema.safeParse({ name: "Ana", email: "  ANA@Example.com ", password: "senha-bem-longa", acceptTerms: true });
    expect(ok.success && ok.data.email).toBe("ana@example.com");
    expect(signUpSchema.safeParse({ name: "Ana", email: "ana@example.com", password: "senha-bem-longa", acceptTerms: false }).success).toBe(false);
  });

  it("filtros de busca descartam valores inválidos", () => {
    const f = parseJobSearch({ q: " dev ", uf: "XX", modalidade: "REMOTE,FOO", pagina: "-3", salarioMin: "abc" });
    expect(f.q).toBe("dev");
    expect(f.uf).toBeUndefined();
    expect(f.modalidade).toEqual(["REMOTE"]);
    expect(f.pagina).toBe(1);
    expect(f.salarioMin).toBeUndefined();
    expect(jobSearchToParams({ ...f, pagina: 2 }).toString()).toBe("q=dev&modalidade=REMOTE&pagina=2");
  });

  it("vaga presencial exige local; faixa salarial coerente", () => {
    const base = { title: "Analista", description: "x".repeat(60), sector: "Administração", seniority: "MID", contractType: "CLT", workModel: "ON_SITE" };
    expect(jobSchema.safeParse(base).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, city: "Natal", state: "RN" }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, workModel: "REMOTE", salaryMin: 5000, salaryMax: 3000 }).success).toBe(false);
  });

  it("escapa curingas do LIKE", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });
});

describe("arquivos", () => {
  const pdf = (body: string) => Buffer.from(`%PDF-1.7\n${body}\n%%EOF\n`, "latin1");
  it("aceita PDF simples e recusa conteúdo ativo", () => {
    expect(inspectPdf(pdf("1 0 obj << /Type /Catalog >> endobj")).ok).toBe(true);
    expect(inspectPdf(pdf("<< /S /JavaScript /JS (app.alert(1)) >>")).ok).toBe(false);
    expect(inspectPdf(pdf("<< /Type /EmbeddedFile >>")).ok).toBe(false);
    expect(inspectPdf(pdf("<< /Encrypt 5 0 R >>")).ok).toBe(false);
    expect(inspectPdf(Buffer.from("MZ\x90\x00executavel")).ok).toBe(false);
  });
  it("sanitiza nomes", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\x\\cv<script>.pdf")).toBe("cvscript.pdf");
    expect(sanitizeFileName("")).toBe("arquivo");
  });
});

describe("consentimento de cookies", () => {
  const now = Date.now();
  it("aceita apenas versão vigente e dentro da validade", () => {
    const c = { v: LEGAL_VERSIONS.cookies, a: true, m: false, t: now, id: "abcdefghijklmnop" };
    expect(decodeConsent(encodeConsent(c), now)).toEqual(c);
    expect(decodeConsent(encodeConsent({ ...c, v: "2020-01-01" }), now)).toBeNull();
    expect(decodeConsent(encodeConsent({ ...c, t: now - 200 * 86400_000 }), now)).toBeNull();
    expect(decodeConsent("lixo%%", now)).toBeNull();
  });
});

describe("formatação", () => {
  it("faixas salariais e tempo relativo", () => {
    expect(formatSalaryRange(3000, 5000)).toMatch(/R\$\s?3\.000 – R\$\s?5\.000/);
    expect(formatSalaryRange(null, null)).toBeNull();
    const now = new Date("2026-10-23T12:00:00Z");
    expect(formatRelative(new Date("2026-10-21T12:00:00Z"), now)).toBe("há 2 dias");
    expect(formatRelative(new Date("2026-10-22T12:00:00Z"), now)).toBe("ontem");
  });
});
