"use client";

import { Bell, BellRing, FileText, Heart, LayoutDashboard, Lock, Send, ShieldCheck, User } from "lucide-react";
import { SideNav } from "@/components/layout/side-nav";

export function CandidateNav() {
  return (
    <SideNav
      label="Minha conta"
      items={[
        { href: "/minha-conta", label: "Painel", icon: LayoutDashboard, exact: true },
        { href: "/minha-conta/perfil", label: "Perfil", icon: User },
        { href: "/minha-conta/curriculos", label: "Currículos", icon: FileText },
        { href: "/minha-conta/candidaturas", label: "Candidaturas", icon: Send },
        { href: "/minha-conta/favoritas", label: "Vagas salvas", icon: Heart },
        { href: "/minha-conta/alertas", label: "Alertas", icon: BellRing },
        { href: "/minha-conta/notificacoes", label: "Notificações", icon: Bell },
        { href: "/minha-conta/seguranca", label: "Segurança", icon: Lock },
        { href: "/minha-conta/privacidade", label: "Privacidade", icon: ShieldCheck },
      ]}
    />
  );
}
