/** Erros de domínio com mensagens seguras para exibir ao usuário. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID" | "RATE_LIMITED",
  ) {
    super(message);
  }
}

export const unauthenticated = (msg = "Entre na sua conta para continuar.") => new AppError(msg, "UNAUTHENTICATED");
export const forbidden = (msg = "Você não tem permissão para esta ação.") => new AppError(msg, "FORBIDDEN");
export const notFound = (msg = "Recurso não encontrado.") => new AppError(msg, "NOT_FOUND");
export const conflict = (msg: string) => new AppError(msg, "CONFLICT");
export const invalid = (msg: string) => new AppError(msg, "INVALID");
