"use client";

import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { withdrawApplicationAction } from "@/app/actions/candidate";

export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending}><Undo2 /> Retirar candidatura</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retirar candidatura?</AlertDialogTitle>
          <AlertDialogDescription>A empresa será avisada e você não poderá se candidatar novamente a esta vaga.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              start(async () => {
                const r = await withdrawApplicationAction({ applicationId });
                if (r.ok) toast.success(r.message ?? "Retirada.");
                else toast.error(r.error);
              })
            }
          >
            Retirar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
