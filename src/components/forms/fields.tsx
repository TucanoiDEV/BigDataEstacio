"use client";

import { useId } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Controller } from "react-hook-form";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- aceita formulários com tipos de saída transformados pelo Zod
type AnyForm<T extends FieldValues> = UseFormReturn<T, any, any>;
import { AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Base<T extends FieldValues> = {
  form: AnyForm<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  className?: string;
};

function errorOf<T extends FieldValues>(form: AnyForm<T>, name: Path<T>): string | undefined {
  const parts = name.split(".");
  let cur: unknown = form.formState.errors;
  for (const p of parts) cur = (cur as Record<string, unknown> | undefined)?.[p];
  return (cur as { message?: string } | undefined)?.message;
}

function FieldShell(props: { id: string; label: string; hint?: string; error?: string; className?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className={cn("space-y-1.5", props.className)}>
      <Label htmlFor={props.id}>
        {props.label}
        {props.required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {props.children}
      {props.hint && !props.error && (
        <p id={`${props.id}-hint`} className="text-xs text-muted-foreground">
          {props.hint}
        </p>
      )}
      {props.error && (
        <p id={`${props.id}-error`} role="alert" className="flex items-center gap-1 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5" aria-hidden /> {props.error}
        </p>
      )}
    </div>
  );
}

export function TextField<T extends FieldValues>(
  props: Base<T> & Omit<React.ComponentProps<typeof Input>, "form" | "name"> & { required?: boolean },
) {
  const { form, name, label, hint, className, required, ...inputProps } = props;
  const id = useId();
  const error = errorOf(form, name);
  const isNumber = inputProps.type === "number";
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} required={required}>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        aria-required={required}
        {...inputProps}
        {...form.register(name, isNumber ? { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) } : undefined)}
      />
    </FieldShell>
  );
}

export function TextAreaField<T extends FieldValues>(
  props: Base<T> & Omit<React.ComponentProps<typeof Textarea>, "form" | "name"> & { required?: boolean },
) {
  const { form, name, label, hint, className, required, ...rest } = props;
  const id = useId();
  const error = errorOf(form, name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} required={required}>
      <Textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
        {...form.register(name)}
      />
    </FieldShell>
  );
}

export function SelectField<T extends FieldValues>(
  props: Base<T> & { options: readonly { value: string; label: string }[]; placeholder?: string; required?: boolean; allowEmpty?: boolean },
) {
  const { form, name, label, hint, className, options, placeholder, required, allowEmpty } = props;
  const id = useId();
  const error = errorOf(form, name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} required={required}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value ?? ""}
            onValueChange={(v) => field.onChange(v === "__none" ? null : v)}
          >
            <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)} onBlur={field.onBlur}>
              <SelectValue placeholder={placeholder ?? "Selecione"} />
            </SelectTrigger>
            <SelectContent>
              {allowEmpty && <SelectItem value="__none">Não informar</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FieldShell>
  );
}

export function CheckboxField<T extends FieldValues>(props: Base<T> & { description?: React.ReactNode }) {
  const { form, name, label, className, description } = props;
  const id = useId();
  const error = errorOf(form, name);
  return (
    <div className={cn("space-y-1", className)}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <div className="flex items-start gap-2.5">
            <Checkbox
              id={id}
              checked={Boolean(field.value)}
              onCheckedChange={(v) => field.onChange(v === true)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
              className="mt-0.5"
            />
            <Label htmlFor={id} className="text-sm font-normal leading-snug">
              {label}
              {description && <span className="block text-muted-foreground">{description}</span>}
            </Label>
          </div>
        )}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Grupo de checkboxes para campos array (ex.: modalidades desejadas). */
export function CheckboxGroupField<T extends FieldValues>(
  props: Base<T> & { options: readonly { value: string; label: string }[] },
) {
  const { form, name, label, hint, className, options } = props;
  const error = errorOf(form, name);
  const groupId = useId();
  return (
    <fieldset className={cn("space-y-2", className)} aria-describedby={error ? `${groupId}-error` : undefined}>
      <legend className="text-sm font-medium">{label}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => {
          const value: string[] = Array.isArray(field.value) ? field.value : [];
          return (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {options.map((o) => {
                const id = `${groupId}-${o.value}`;
                return (
                  <div key={o.value} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={value.includes(o.value)}
                      onCheckedChange={(c) =>
                        field.onChange(c === true ? [...value, o.value] : value.filter((v) => v !== o.value))
                      }
                    />
                    <Label htmlFor={id} className="text-sm font-normal">
                      {o.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          );
        }}
      />
      {error && (
        <p id={`${groupId}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function FormRootError<T extends FieldValues>({ form }: { form: AnyForm<T> }) {
  const msg = form.formState.errors.root?.message;
  if (!msg) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{msg}</span>
    </div>
  );
}

export function SubmitButton({ pending, children, className, ...rest }: React.ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={cn("h-10 px-4", className)} {...rest}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
