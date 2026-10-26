"use client";

import { useId, useState } from "react";
import { Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Campo de etiquetas acessível: Enter ou vírgula adiciona; botão remove. */
export function TagInput(props: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  hint?: string;
  error?: string;
  placeholder?: string;
  toggleable?: { selected: string[]; onToggle: (tag: string) => void; label: string };
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const max = props.max ?? 20;

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "").slice(0, 40);
    if (tag.length < 2 || props.value.length >= max) return;
    if (props.value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    props.onChange([...props.value, tag]);
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{props.label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-background p-2 focus-within:ring-3 focus-within:ring-ring/50">
        {props.value.map((tag) => {
          const selected = props.toggleable?.selected.includes(tag);
          return (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2.5 pr-1 text-sm text-secondary-foreground">
              {props.toggleable ? (
                <button
                  type="button"
                  onClick={() => props.toggleable!.onToggle(tag)}
                  aria-pressed={selected}
                  className={selected ? "inline-flex items-center gap-1 font-semibold" : "opacity-80"}
                  title={props.toggleable.label}
                >
                  {selected && <Star className="size-3 fill-current" aria-hidden />}
                  {tag}
                </button>
              ) : (
                tag
              )}
              <button
                type="button"
                onClick={() => props.onChange(props.value.filter((v) => v !== tag))}
                className="grid size-5 place-items-center rounded-full hover:bg-black/10"
                aria-label={`Remover ${tag}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          );
        })}
        <Input
          id={id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && props.value.length) {
              props.onChange(props.value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={props.value.length >= max ? `Máximo de ${max}` : (props.placeholder ?? "Digite e pressione Enter")}
          disabled={props.value.length >= max}
          aria-describedby={`${id}-hint`}
          className="h-7 min-w-40 flex-1 border-0 p-1 shadow-none focus-visible:ring-0"
        />
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {props.hint ?? "Pressione Enter ou vírgula para adicionar."} ({props.value.length}/{max})
      </p>
      {props.error && <p role="alert" className="text-xs font-medium text-destructive">{props.error}</p>}
    </div>
  );
}
