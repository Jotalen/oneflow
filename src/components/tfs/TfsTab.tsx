"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { TfsView } from "@/components/TfsView";
import { PortfolioView } from "./PortfolioView";
import type { Analysis } from "@/lib/engine/analyze";
import type { TfsMeta } from "@/lib/server/tfs-meta";
import type { Portfolio } from "@/lib/tfs/types";

type Sub = "customer" | "portfolio";
const SUB_PARAM = "view";
const SUBS: { value: Sub; label: string }[] = [
  { value: "customer", label: "This customer" },
  { value: "portfolio", label: "Portfolio · all customers" },
];

interface JsonState<T> { data: T | null; error: string | null }

/** GET a static JSON route once; error text is shown to the user. */
function useJson<T>(url: string): JsonState<T> {
  const [state, setState] = useState<JsonState<T>>({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return (await r.json()) as T; })
      .then((data) => { if (alive) setState({ data, error: null }); })
      .catch((e: unknown) => { if (alive) setState({ data: null, error: e instanceof Error ? e.message : "unavailable" }); });
    return () => { alive = false; };
  }, [url]);
  return state;
}

/** Car page "TFS view" tab: this customer from Toyota's side, or the whole portfolio. */
export function TfsTab({ analysis }: { analysis: Analysis }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sub: Sub = params.get(SUB_PARAM) === "portfolio" ? "portfolio" : "customer";
  const setSub = (s: Sub) => {
    const next = new URLSearchParams(params.toString());
    if (s === "customer") next.delete(SUB_PARAM); else next.set(SUB_PARAM, s);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <>
      <div className="mb-4"><Segmented<Sub> size="sm" value={sub} options={SUBS} onChange={setSub} /></div>
      {sub === "customer" ? <CustomerSub analysis={analysis} /> : <PortfolioSub />}
    </>
  );
}

function Failed({ what, error }: { what: string; error: string }) {
  return <p className="panel p-4 text-sm text-bad" role="alert">Couldn&apos;t load the {what}: {error}</p>;
}

function CustomerSub({ analysis }: { analysis: Analysis }) {
  const { data, error } = useJson<TfsMeta>("/api/tfs-meta");
  if (error) return <Failed what="TFS view" error={error} />;
  if (!data) return <Loading />;
  return <TfsView analysis={analysis} meta={data} />;
}

function PortfolioSub() {
  const { data, error } = useJson<Portfolio>("/api/tfs-portfolio");
  if (error) return <Failed what="TFS portfolio" error={error} />;
  if (!data) return <Loading />;
  return <PortfolioView portfolio={data} />;
}
