"use client";
import { Empty, PageHeader } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { HouseCalculator } from "@/components/nova/borrowing/HouseCalculator";

const TITLE = "House financing";
const SUBTITLE = "Your mortgage at a glance.";

export default function HousePage() {
  const b = useReadyBank();
  if (!b) return <><PageHeader title={TITLE} subtitle={SUBTITLE} /><Loading /></>;
  const p = b.analysis.profile;
  return (
    <>
      <PageHeader title={TITLE} subtitle={SUBTITLE} />
      <Empty title="No mortgage linked" body={`We don't see a mortgage for ${p.name}. If you're thinking about buying, the calculator below gives a rough monthly payment.`} />
      <HouseCalculator incomeMonthly={p.incomeMonthly} />
    </>
  );
}
