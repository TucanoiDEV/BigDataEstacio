import { normalizeText } from "@/lib/text";

// Heurísticas para reter vagas potencialmente fraudulentas para revisão humana.
// Nunca rejeitam automaticamente: apenas encaminham à moderação com o motivo.

export type FraudSignal =
  | "PAYMENT_REQUEST"
  | "MESSAGING_ONLY_CONTACT"
  | "EASY_MONEY"
  | "SENSITIVE_DATA_REQUEST"
  | "URL_SHORTENER"
  | "UNREALISTIC_SALARY";

export const FRAUD_SIGNAL_LABEL: Record<FraudSignal, string> = {
  PAYMENT_REQUEST: "Menciona cobrança de taxa/pagamento do candidato",
  MESSAGING_ONLY_CONTACT: "Direciona candidatura para WhatsApp/telefone fora da plataforma",
  EASY_MONEY: "Promessa de ganho fácil ou renda extra",
  SENSITIVE_DATA_REQUEST: "Solicita documentos ou dados bancários no anúncio",
  URL_SHORTENER: "Contém links encurtados",
  UNREALISTIC_SALARY: "Salário incompatível com a senioridade",
};

const RULES: { signal: FraudSignal; pattern: RegExp }[] = [
  {
    signal: "PAYMENT_REQUEST",
    pattern: /(taxa|pagamento|pagar|pix|deposito|boleto|investimento)\W+(?:\w+\W+){0,6}?(inscricao|cadastro|curso|material|uniforme|exame|treinamento|kit|adesao|vaga)/,
  },
  // Celular brasileiro isolado: os limites (?<!\d)/(?!\d) evitam falsos positivos em números longos (protocolos, códigos).
  { signal: "MESSAGING_ONLY_CONTACT", pattern: /(whats ?app|wa\.me|telegram|chama no (zap|whats)|(?<!\d)\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}(?!\d))/ },
  { signal: "EASY_MONEY", pattern: /(ganhe|lucre|renda extra|fature|ganhos? de)\W+(?:\w+\W+){0,5}?(por dia|por semana|em casa|sem experiencia|r\$ ?\d)/ },
  { signal: "SENSITIVE_DATA_REQUEST", pattern: /(envie|mande|informe|enviar)\W+(?:\w+\W+){0,5}?(cpf|rg|cartao|senha|dados bancarios|conta bancaria|foto do documento)/ },
  { signal: "URL_SHORTENER", pattern: /(bit\.ly|tinyurl|encurtador|cutt\.ly|is\.gd|t\.co\/)/ },
];

export function detectFraudSignals(job: {
  title: string;
  description: string;
  requirements?: string | null;
  benefits?: string | null;
  seniority: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
}): FraudSignal[] {
  const corpus = normalizeText([job.title, job.description, job.requirements ?? "", job.benefits ?? ""].join(" \n "));
  const signals = new Set<FraudSignal>();
  for (const rule of RULES) if (rule.pattern.test(corpus)) signals.add(rule.signal);

  const top = Math.max(job.salaryMin ?? 0, job.salaryMax ?? 0);
  if ((job.seniority === "INTERN" && top > 15000) || (job.seniority === "JUNIOR" && top > 40000) || top > 200000) {
    signals.add("UNREALISTIC_SALARY");
  }
  return [...signals];
}
