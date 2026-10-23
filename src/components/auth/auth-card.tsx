export function AuthCard(props: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-petroleum">{props.title}</h1>
      {props.description && <div className="mt-1.5 text-sm text-muted-foreground">{props.description}</div>}
      <div className="mt-6">{props.children}</div>
      {props.footer && <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{props.footer}</div>}
    </div>
  );
}
