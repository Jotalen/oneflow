"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader, Panel } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { ScenarioControls } from "@/components/nova/whatif/ScenarioControls";
import { WhatIfChart } from "@/components/nova/whatif/WhatIfChart";
import { IndicatorTable, KeyNumbers } from "@/components/nova/whatif/WhatIfReadouts";
import type { Profile } from "@/lib/engine/types";
import { OVERDRAFT_FEE, CAR_DEPRECIATION_MONTHLY } from "@/lib/engine/project";
import { OBSERVED_WINDOW_MONTHS, TAKE_HOME_RATIO } from "@/lib/engine/cashflow";
import {
  EMPTY_SCENARIO, HORIZON_MONTHS, PRESETS, cancellableBills, chartRows, debtTargets, fmtSignedWhole, fmtWhole, isEmptyScenario, presetScenario, runWhatIf,
  type Scenario, type WhatIfResult,
} from "@/lib/bank/whatif";

const TITLE = "What if";
const SUB = "Change one thing and see both futures, side by side.";

function Assumptions() {
  return (
    <p className="text-xs text-muted">
      A projection from today&apos;s balances and recurring cash flow, not a forecast. Income is before tax; the projection keeps {Math.round(TAKE_HOME_RATIO * 100)}% as take-home.
      Everyday spending is your average from the last {OBSERVED_WINDOW_MONTHS} months of purchases. Card and loan minimums are paid each month, car value drops {Math.round(CAR_DEPRECIATION_MONTHLY * 100)}% a month,
      and each month cash is below zero costs a {fmtWhole(OVERDRAFT_FEE)} overdraft fee. Nothing here moves money.
    </p>
  );
}

/** Phones: the result scrolls away while you drag sliders, so keep a one-line readout pinned above them. */
function MobileTicker({ r }: { r: WhatIfResult }) {
  const out = r.runOut.scenario;
  return (
    <div className="lg:hidden sticky top-2 z-10 -mx-1 mb-4 rounded-xl bg-ink text-ink-fg px-3 py-2 text-xs flex justify-between gap-3" aria-hidden>
      <span>Net worth, month {HORIZON_MONTHS}: <b className="money">{fmtSignedWhole(r.netWorthDelta24)}</b></span>
      <span className={out === null ? "" : "font-semibold"}>{out === null ? <>Low <b className="money">{fmtWhole(r.low.scenario.liquid)}</b></> : `Out of cash month ${out}`}</span>
    </div>
  );
}

function Simulator({ profile }: { profile: Profile }) {
  const [scenario, setScenario] = useState<Scenario>(EMPTY_SCENARIO);
  const deferred = useDeferredValue(scenario);
  const debts = useMemo(() => debtTargets(profile), [profile]);
  const bills = useMemo(() => cancellableBills(profile), [profile]);
  const r = useMemo(() => runWhatIf(profile, deferred), [profile, deferred]);
  const rows = useMemo(() => chartRows(r.baseline, r.scenario), [r]);
  const changed = !isEmptyScenario(deferred);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:items-start">
      <section className="bg-ink text-ink-fg rounded-2xl p-4 sm:p-5 lg:col-start-2 lg:row-start-1" aria-live="polite">
        <div className="text-xs opacity-70 mb-1">{changed ? "Your what-if" : "Your do-nothing future"}</div>
        <p className="text-lg sm:text-xl font-semibold leading-snug">{r.summary}</p>
        <div className="mt-4 text-fg"><KeyNumbers r={r} /></div>
      </section>

      <Panel title="Change something" right={changed ? <button type="button" className="btn h-8 px-3 text-xs" onClick={() => setScenario(EMPTY_SCENARIO)}>Reset</button> : undefined}
        className="lg:col-start-1 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-5 lg:h-auto">
        {changed && <MobileTicker r={r} />}
        <div className="flex flex-wrap gap-2 mb-5" aria-label="Try a scenario">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip hover:border-fg/40" onClick={() => setScenario(presetScenario(profile, p.id))}>{p.label}</button>
          ))}
        </div>
        <ScenarioControls scenario={scenario} incomeMonthly={profile.incomeMonthly} debts={debts} bills={bills} onChange={setScenario} />
      </Panel>

      <Panel title={`Next ${HORIZON_MONTHS} months`} subtitle="Dashed line: do nothing. Solid line: your what-if." className="lg:col-start-2 lg:row-start-2">
        <WhatIfChart rows={rows} runOutMonth={r.runOut.scenario} changed={changed} />
      </Panel>

      <Panel title="Health indicators at month 24" subtitle="Recomputed with the projected cash and your changed monthly bills and income." className="lg:col-start-2 lg:row-start-3">
        <IndicatorTable changes={r.changes} />
        <p className="text-xs text-muted mt-3">Card and loan balances are held at today&apos;s values here, so card utilization and car equity are not shown.</p>
        <div className="mt-3 border-t border-line pt-3"><Assumptions /></div>
      </Panel>
    </div>
  );
}

export default function WhatIfPage() {
  const b = useReadyBank();
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  return (
    <>
      <PageHeader title={TITLE} subtitle={SUB} />
      <Simulator key={b.personaId} profile={b.analysis.profile} />
    </>
  );
}
