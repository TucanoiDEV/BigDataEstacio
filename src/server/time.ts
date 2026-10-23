import "server-only";
import { connection } from "next/server";

/**
 * Hora atual da requisição. Chamar `connection()` antes marca o trecho como
 * dinâmico (exigência do Cache Components para valores dependentes do tempo).
 */
export async function requestNow(): Promise<Date> {
  await connection();
  return new Date();
}
