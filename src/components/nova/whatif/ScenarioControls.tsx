"use client";
import type { ReactNode } from "react";
import type { Cents } from "@/lib/money";
import { HORIZON_MONTHS, fmtSignedWhole, fmtWhole, monthLabel, type CancellableBill, type DebtTarget, type Scenario } from "@/lib/bank/whatif";

/** Slider limits in whole dollars. */
const RAISE_MAX = 5_000;
const INCOME_STEP = 100;
const EXPENSE_MAX = 10_000;
const EXPENSE_STEP = 100;
const EXTRA_MAX = 1_000;
const BILL_MAX = 1_500;
const SMALL_STEP = 25;
const SELECT = "w-full rounded-full border border-line bg-surface px-3 py-2 text-sm";

interface RangeFieldProps {
  id: string;
  label: string;
  value: ReactNode;
  /** Slider position and bounds in whole dollars (or months). */
  current: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  hint?: ReactNode;
}

function RangeField({ id, label, value, current, min, max, step, onChange, hint }: RangeFieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id} className="min-w-0">{label}</label>
        <span className="font-semibold money shrink-0">{value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={current} onChange={(e) => onChange(Number(e.target.value))} className="w-full mt-2 accent-[var(--accent)]" />
      {hint && <p className="text-[0.7rem] text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-t border-line pt-4 first:border-0 first:pt-0">
      <legend className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">{title}</legend>
      {children}
    </fieldset>
  );
}

export interface ScenarioControlsProps {
  scenario: Scenario;
  incomeMonthly: Cents;
  debts: DebtTarget[];
  bills: CancellableBill[];
  onChange: (next: Scenario) => void;
}

const toDollars = (c: Cents) => Math.round(c / 100);

/** Every input the what-if simulator takes. Values are cents; sliders move in whole dollars. */
export function ScenarioControls({ scenario: s, incomeMonthly, debts, bills, onChange }: ScenarioControlsProps) {
  const set = <K extends keyof Scenario>(key: K, value: Scenario[K]) => onChange({ ...s, [key]: value });
  const lossMax = Math.floor(toDollars(incomeMonthly) / INCOME_STEP) * INCOME_STEP;
  const toggleBill = (id: string) => set("cancelBillIds", s.cancelBillIds.includes(id) ? s.cancelBillIds.filter((x) => x !== id) : [...s.cancelBillIds, id]);
  const target = s.extraToDebtTargetId ?? debts[0]?.id ?? "";

  return (
    <div className="grid gap-4">
      <Group title="Income">
        <RangeField id="wi-income" label="Monthly income change" value={fmtSignedWhole(s.incomeMonthlyDelta)}
          current={toDollars(s.incomeMonthlyDelta)} min={-lossMax} max={RAISE_MAX} step={INCOME_STEP}
          onChange={(n) => set("incomeMonthlyDelta", n * 100)}
          hint={`Before tax. Today: ${fmtWhole(incomeMonthly)}/mo. Slide left for a pay cut or job loss.`} />
      </Group>

      <Group title="One-time expense">
        <RangeField id="wi-expense" label="Amount" value={fmtWhole(s.expenseAmount)}
          current={toDollars(s.expenseAmount)} min={0} max={EXPENSE_MAX} step={EXPENSE_STEP}
          onChange={(n) => set("expenseAmount", n * 100)} hint="A car repair, a medical bill, a move." />
        <RangeField id="wi-expense-month" label="When" value={`Month ${s.expenseMonth} · ${monthLabel(s.expenseMonth)}`}
          current={s.expenseMonth} min={1} max={HORIZON_MONTHS} step={1} onChange={(n) => set("expenseMonth", n)} />
      </Group>

      <Group title="Extra toward debt">
        {debts.length === 0 ? <p className="text-sm text-muted">No balance to pay down.</p> : (
          <>
            <label className="block text-sm">
              <span className="sr-only">Debt to pay down</span>
              <select name="extraToDebtTarget" className={SELECT} value={target} onChange={(e) => set("extraToDebtTargetId", e.target.value)}>
                {debts.map((d) => <option key={d.id} value={d.id}>{d.label} · {d.aprPct}% APR · {fmtWhole(d.balance)}</option>)}
              </select>
            </label>
            <RangeField id="wi-extra" label="Extra each month" value={fmtWhole(s.extraToDebtMonthly)}
              current={toDollars(s.extraToDebtMonthly)} min={0} max={EXTRA_MAX} step={SMALL_STEP}
              onChange={(n) => set("extraToDebtMonthly", n * 100)} hint="Paid from cash on top of the minimum." />
          </>
        )}
      </Group>

      <Group title="Cancel recurring bills">
        {bills.length === 0 ? <p className="text-sm text-muted">No recurring bills found.</p> : (
          <ul className="grid gap-1">
            {bills.map((b) => (
              <li key={b.id}>
                <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-2 cursor-pointer text-sm">
                  <input type="checkbox" name={`cancel-${b.id}`} checked={s.cancelBillIds.includes(b.id)} onChange={() => toggleBill(b.id)} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="flex-1 min-w-0 truncate">{b.label}{b.isSubscription ? "" : " (bill)"}</span>
                  <span className="money text-muted">{fmtWhole(b.amount)}/mo</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Group>

      <Group title="New monthly bill">
        <RangeField id="wi-new-bill" label="Amount each month" value={fmtWhole(s.newBillMonthly)}
          current={toDollars(s.newBillMonthly)} min={0} max={BILL_MAX} step={SMALL_STEP}
          onChange={(n) => set("newBillMonthly", n * 100)} hint="A rent increase, childcare, insurance." />
      </Group>
    </div>
  );
}
