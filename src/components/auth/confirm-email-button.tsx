"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyEmailAction } from "@/app/actions/auth";

export function ConfirmEmailButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}{" "}
          <Link href="/verificar-email" className="font-medium underline">
            Pedir novo link
          </Link>
        </p>
      )}
      <Button
        className="h-10 w-full"
        disabled={pending || !token}
        onClick={() =>
          start(async () => {
            const res = await verifyEmailAction({ token });
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Confirmar meu e-mail
      </Button>
    </div>
  );
}
