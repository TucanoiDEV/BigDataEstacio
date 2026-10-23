"use client";

import { useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import type { ActionResult } from "@/server/action";

/**
 * Integra React Hook Form + Zod (validação no cliente) a uma Server Action
 * (que valida novamente no servidor). Erros de campo vindos do servidor são
 * aplicados aos inputs correspondentes.
 */
export function useActionForm<S extends z.ZodType<FieldValues, FieldValues>, T = undefined>(opts: {
  schema: S;
  action: (input: z.input<S>) => Promise<ActionResult<T>>;
  defaultValues?: DefaultValues<z.input<S>>;
  onSuccess?: (result: { data?: T; message?: string }) => void;
  successToast?: string | false;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(opts.schema as never) as unknown as Resolver<z.input<S>, unknown, z.output<S>>,
    defaultValues: opts.defaultValues,
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await opts.action(values as z.input<S>);
      if (!res) return; // redirecionamento
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [field, message] of Object.entries(res.fieldErrors)) {
            form.setError(field as Path<z.input<S>>, { message });
          }
        }
        form.setError("root", { message: res.error });
        toast.error(res.error);
        return;
      }
      const msg = opts.successToast === false ? undefined : (opts.successToast ?? res.message);
      if (msg) toast.success(msg);
      opts.onSuccess?.({ data: res.data, message: res.message });
    });
  });

  return { form, onSubmit, pending };
}
