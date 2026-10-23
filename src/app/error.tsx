"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

// Nunca exibe detalhes técnicos ao usuário; o digest permite correlacionar com os logs do servidor.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex-1 py-16">
      <ErrorState title="Não foi possível carregar esta página" description={`Tente novamente em instantes.${error.digest ? ` Código: ${error.digest}` : ""}`}>
        <Button className="mt-4" onClick={reset}>Tentar novamente</Button>
      </ErrorState>
    </div>
  );
}
