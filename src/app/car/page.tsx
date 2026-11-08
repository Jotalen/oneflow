"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Empty, PageHeader, Segmented } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { CarSummary, LoanProgressPanel, LoanTiles, PayFasterPanel, RecallBanner } from "@/components/nova/borrowing/LoanPanels";
import { LeaseTiles, LeaseTimePanel, MileagePanel } from "@/components/nova/borrowing/LeasePanels";
import { CarOptions } from "@/components/nova/borrowing/CarOptions";
import { ShopFinance } from "@/components/nova/borrowing/ShopFinance";
import type { Analysis } from "@/lib/engine/analyze";
import type { BankView } from "@/lib/bank/view";

type Tab = "loan" | "shop";
const TITLE = "Car financing";
const SUBTITLE = "Your Toyota financing, and options for your next car.";
/** First tab names the customer's actual contract: "My lease" for lessees, "My car" with none. */
function tabsFor(contractType: string | undefined): { value: Tab; label: string }[] {
  const mine = contractType === "lease" ? "My lease" : contractType ? "My loan" : "My car";
  return [
    { value: "loan", label: mine },
    { value: "shop", label: "Shop & finance" },
  ];
}
const parseTab = (t: string | null): Tab => (t === "shop" ? t : "loan");

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
      <div className="mb-4"><Segmented<Tab> value={tab} options={tabsFor(analysis.profile.contract?.type)} onChange={setTab} /></div>
      {tab === "loan" && <MyCar analysis={analysis} view={view} />}
      {tab === "shop" && <ShopFinance profile={analysis.profile} view={view} />}
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
          <LoanProgressPanel contract={contract} loan={view.loan} />
          <PayFasterPanel contract={contract} loan={view.loan} />
        </div>
      )}
      <CarOptions ranked={analysis.ranked} />
    </>
  );
}
