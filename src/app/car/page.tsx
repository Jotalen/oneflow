"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Empty, PageHeader, Segmented } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { TfsView } from "@/components/TfsView";
import { CarSummary, LoanTiles, PaidSoFarPanel, PayFasterPanel, PaymentsPanel, RecallBanner, RecentPaymentsPanel } from "@/components/nova/borrowing/LoanPanels";
import { LeaseTiles, LeaseTimePanel, MileagePanel } from "@/components/nova/borrowing/LeasePanels";
import { CarOptions } from "@/components/nova/borrowing/CarOptions";
import { ShopFinance } from "@/components/nova/borrowing/ShopFinance";
import type { Analysis } from "@/lib/engine/analyze";
import type { BankView } from "@/lib/bank/view";
import type { TfsMeta } from "@/lib/server/tfs-meta";

type Tab = "loan" | "shop" | "tfs";
const TITLE = "Car financing";
const SUBTITLE = "Your Toyota loan, and options for your next car.";
const TABS: { value: Tab; label: string }[] = [
  { value: "loan", label: "My loan" },
  { value: "shop", label: "Shop & finance" },
  { value: "tfs", label: "TFS view" },
];
const parseTab = (t: string | null): Tab => (t === "shop" || t === "tfs" ? t : "loan");

export default function CarPage() {
  return (
    <Suspense fallback={<><PageHeader title={TITLE} subtitle={SUBTITLE} /><Loading /></>}>
      <CarPageInner />
    </Suspense>
  );
}

function CarPageInner() {
  const b = useReadyBank();
  const params = useSearchParams();
  const router = useRouter();
  const tab = parseTab(params.get("tab"));
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params.toString());
    if (t === "loan") next.delete("tab"); else next.set("tab", t);
    const qs = next.toString();
    router.replace(qs ? `/car?${qs}` : "/car", { scroll: false });
  };
  const header = <PageHeader title={TITLE} subtitle={SUBTITLE} />;
  if (!b) return <>{header}<Loading /></>;
  const { analysis, view } = b;
  return (
    <>
      {header}
      <div className="mb-4"><Segmented<Tab> value={tab} options={TABS} onChange={setTab} /></div>
      {tab === "loan" && <MyCar analysis={analysis} view={view} />}
      {tab === "shop" && <ShopFinance profile={analysis.profile} view={view} />}
      {tab === "tfs" && <TfsTab analysis={analysis} />}
    </>
  );
}

function MyCar({ analysis, view }: { analysis: Analysis; view: BankView }) {
  const p = analysis.profile;
  if (!p.car || !p.contract) {
    return <Empty title="No Toyota linked" body="We don't see a Toyota Financial Services loan or lease for you. Use Shop & finance to price your next car." />;
  }
  const { car, contract } = p;
  const isLease = contract.type === "lease";
  return (
    <>
      <RecallBanner car={car} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <CarSummary car={car} contract={contract} autopay={p.flags.autopay} />
        {isLease ? <LeaseTiles car={car} contract={contract} /> : <LoanTiles car={car} contract={contract} />}
      </div>
      {isLease ? (
        <div className="grid gap-4 lg:grid-cols-2 mt-4">
          <LeaseTimePanel contract={contract} />
          <MileagePanel car={car} contract={contract} />
        </div>
      ) : view.loan && (
        <div className="grid gap-4 lg:grid-cols-2 mt-4">
          <PaymentsPanel contract={contract} loan={view.loan} />
          <PaidSoFarPanel contract={contract} loan={view.loan} />
          <PayFasterPanel contract={contract} loan={view.loan} />
          <RecentPaymentsPanel contract={contract} loan={view.loan} />
        </div>
      )}
      <CarOptions ranked={analysis.ranked} />
    </>
  );
}

function TfsTab({ analysis }: { analysis: Analysis }) {
  const [meta, setMeta] = useState<TfsMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/tfs-meta")
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return (await r.json()) as TfsMeta; })
      .then((m) => { if (alive) setMeta(m); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "unavailable"); });
    return () => { alive = false; };
  }, []);
  if (error) return <p className="panel p-4 text-sm text-bad" role="alert">Couldn&apos;t load the TFS view: {error}</p>;
  if (!meta) return <Loading />;
  return <TfsView analysis={analysis} meta={meta} />;
}
