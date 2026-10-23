"use client";

import Link from "next/link";
import { Building2, ChevronDown, FileText, Heart, LayoutDashboard, LogOut, Plus, Shield, ShieldCheck, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/actions/auth";
import { initials } from "@/lib/text";

export function UserMenuDropdown(props: {
  name: string;
  email: string;
  isAdmin: boolean;
  orgs: { id: string; tradeName: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted" aria-label="Menu da conta">
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{initials(props.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">{props.name.split(" ")[0]}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-semibold">{props.name}</div>
          <div className="truncate text-xs text-muted-foreground">{props.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/minha-conta"><LayoutDashboard /> Painel do candidato</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/minha-conta/perfil"><User /> Meu perfil</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/minha-conta/candidaturas"><FileText /> Candidaturas</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/minha-conta/favoritas"><Heart /> Vagas salvas</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/minha-conta/privacidade"><ShieldCheck /> Privacidade</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Empresas</DropdownMenuLabel>
        {props.orgs.map((o) => (
          <DropdownMenuItem key={o.id} asChild>
            <Link href={`/empresa/${o.id}`}><Building2 /> <span className="truncate">{o.tradeName}</span></Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/empresa/nova"><Plus /> Cadastrar empresa</Link>
        </DropdownMenuItem>
        {props.isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin"><Shield /> Administração</Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut /> Sair</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
