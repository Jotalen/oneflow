"use client";
import Link from "next/link";
import { PageHeader, initials } from "@/components/nova/ui";
import { useBank } from "@/components/nova/BankProvider";
import { NAV, type NavItem } from "@/lib/nav";

const ACCOUNT_GROUP = { label: "Account", items: [{ href: "/settings", label: "Settings" }] };

function MenuRow({ item, value }: { item: NavItem; value?: string }) {
  return (
    <li className="border-b border-line last:border-0">
      <Link href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
        <span className="h-5 w-5 rounded-md border border-line" aria-hidden />
        <span className="flex-1 text-sm font-medium">{item.label}</span>
        {value && <span className="text-xs text-muted">{value}</span>}
        <span className="text-muted" aria-hidden>›</span>
      </Link>
    </li>
  );
}

export default function MorePage() {
  const { persona, view } = useBank();
  const extra: Record<string, string | undefined> = {
    "/rewards": view ? `${view.rewards.points.toLocaleString("en-US")} pts` : undefined,
    "/credit": view ? `${view.credit.score} est.` : undefined,
  };
  const name = persona?.name ?? "Your profile";
  return (
    <>
      <PageHeader title="More" />
      <Link href="/settings" className="panel flex items-center gap-3 p-4 mb-5 hover:border-fg/40">
        <span className="h-12 w-12 rounded-full bg-surface-2 border border-line grid place-items-center font-semibold" aria-hidden>{initials(name)}</span>
        <span className="flex-1"><span className="block font-semibold">{name}</span><span className="block text-sm text-muted">Profile and settings</span></span>
        <span className="text-muted" aria-hidden>›</span>
      </Link>
      {[...NAV, ACCOUNT_GROUP].map((g, i) => (
        <section key={g.label ?? `group-${i}`} className="mb-5">
          {g.label && <h2 className="text-xs font-semibold tracking-widest uppercase text-muted mb-2 px-1">{g.label}</h2>}
          <ul className="panel p-0 overflow-hidden">{g.items.map((it) => <MenuRow key={it.href} item={it} value={extra[it.href]} />)}</ul>
        </section>
      ))}
    </>
  );
}
