"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { PageHeader, Panel, Segmented, initials } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { FraudTile } from "@/components/FraudTile";
import { useDashboardPrefs } from "@/lib/bank/useDashboard";
import { applyPrefs, recommendBubbles, setAutoPick } from "@/lib/bank/bubbles";
import { useGoals } from "@/lib/bank/goals";

const TITLE = "Settings";
const SUBTITLE = "Your profile, security, and how OneFlow works for you.";
const APP_VERSION = "OneFlow demo 0.1.0 · HackUTD 2026";
const NOTIFY_KEY = "nova:notify";
const THEME_KEY = "nova:theme";

type NotifyId = "purchases" | "bills" | "tips" | "weekly";
type Notify = Record<NotifyId, boolean>;
const NOTIFY_ROWS: { id: NotifyId; label: string }[] = [
  { id: "purchases", label: "Purchases over $100" },
  { id: "bills", label: "Bill reminders" },
  { id: "tips", label: "Next best move tips" },
  { id: "weekly", label: "Weekly summary email" },
];
const NOTIFY_DEFAULT: Notify = { purchases: true, bills: true, tips: true, weekly: false };

type Theme = "light" | "dark" | "system";

const STORAGE_EVT = "nova:settings";

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(STORAGE_EVT));
}
function subscribe(cb: () => void) {
  window.addEventListener(STORAGE_EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(STORAGE_EVT, cb); window.removeEventListener("storage", cb); };
}
/** A localStorage string as React state (null on the server and when unset). */
function useStoredString(key: string): string | null {
  return useSyncExternalStore(subscribe, () => readStorage(key), () => null);
}
function parseNotify(raw: string | null): Notify {
  if (!raw) return NOTIFY_DEFAULT;
  try { return { ...NOTIFY_DEFAULT, ...(JSON.parse(raw) as Partial<Notify>) }; } catch { return NOTIFY_DEFAULT; }
}

function Toggle({ label, on, onChange, sub }: { label: string; on: boolean; onChange: (v: boolean) => void; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-0">
      <div className="min-w-0"><div className="text-sm">{label}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function NotificationsPanel() {
  const notify = parseNotify(useStoredString(NOTIFY_KEY));
  const set = (id: NotifyId, v: boolean) => writeStorage(NOTIFY_KEY, JSON.stringify({ ...notify, [id]: v }));
  return (
    <Panel title="Notifications" subtitle="Saved on this device">
      {NOTIFY_ROWS.map((r) => <Toggle key={r.id} label={r.label} on={notify[r.id]} onChange={(v) => set(r.id, v)} />)}
    </Panel>
  );
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }];

function ThemePanel() {
  const stored = useStoredString(THEME_KEY);
  const theme: Theme = stored === "light" || stored === "dark" ? stored : "system";
  const apply = (t: Theme) => {
    if (t === "system") { delete document.documentElement.dataset.theme; writeStorage(THEME_KEY, null); }
    else { document.documentElement.dataset.theme = t; writeStorage(THEME_KEY, t); }
  };
  return (
    <Panel title="Theme" subtitle="Saved on this device">
      <Segmented<Theme> value={theme} onChange={apply} options={THEME_OPTIONS} />
    </Panel>
  );
}

type ReadyBank = NonNullable<ReturnType<typeof useReadyBank>>;

function DashboardPanel({ bank }: { bank: ReadyBank }) {
  const { prefs, save, reset } = useDashboardPrefs(bank.personaId);
  const { goals } = useGoals(bank.personaId);
  const [didReset, setDidReset] = useState(false);
  const current = applyPrefs(recommendBubbles(bank.analysis, bank.view, { hasGoal: goals.length > 0 }), prefs);
  return (
    <Panel title="Dashboard">
      <Toggle label="Let OneFlow pick my bubbles" sub="Bubbles appear when you link a loan, start a goal, or something needs attention. Your changes always win." on={prefs.auto} onChange={(v) => { save(setAutoPick(prefs, current, v)); setDidReset(false); }} />
      <div className="flex flex-wrap gap-2 mt-3">
        <Link href="/dashboard/edit" className="btn btn-primary">Edit dashboard</Link>
        <button type="button" className="btn" onClick={() => { reset(); setDidReset(true); }}>Reset to recommended</button>
      </div>
      {didReset && <p className="text-xs text-muted mt-2" role="status">Dashboard reset to recommended.</p>}
    </Panel>
  );
}

export default function SettingsPage() {
  const b = useReadyBank();
  if (!b) return <><PageHeader title={TITLE} subtitle={SUBTITLE} /><Loading /></>;
  const p = b.analysis.profile;
  const linked = p.accounts.length + (p.contract ? 1 : 0);
  return (
    <>
      <PageHeader title={TITLE} subtitle={SUBTITLE} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Profile">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-surface-2 border border-line grid place-items-center font-semibold" aria-hidden>{initials(p.name)}</div>
            <div className="text-sm">
              <div className="font-semibold">{p.name}, {p.age}</div>
              <div className="text-muted">Toyota customer {p.personaId}</div>
              <div className="text-muted">Synthetic demo customer · no email or phone on file</div>
            </div>
          </div>
        </Panel>
        <Panel title="Security" subtitle="Bank-wide fraud monitor on Nessie simulator data">
          <FraudTile />
        </Panel>
        <NotificationsPanel />
        <DashboardPanel bank={b} />
        <Panel title="Linked accounts">
          <p className="text-sm">{linked} account{linked === 1 ? "" : "s"} linked{p.contract ? " (including your Toyota Financial Services " + p.contract.type + ")" : ""}</p>
          <Link href="/accounts" className="btn mt-3 inline-block">Manage accounts</Link>
        </Panel>
        <ThemePanel />
        <Panel title="Data source">
          <p className="text-sm">
            {b.offline ? "Offline snapshot: the Nessie API wasn't reachable, so you're seeing a saved copy." : b.live ? "Live from the Capital One Nessie API." : "Saved snapshot of the Nessie data (no live API key)."}
          </p>
          <button type="button" className="btn mt-3" onClick={() => void b.refresh()}>Refresh data</button>
        </Panel>
        <Panel title="Help">
          <p className="text-sm text-muted">All customers are synthetic, from the Toyota Financial Services hackathon data pack.</p>
          <p className="text-xs text-muted mt-2">{APP_VERSION}</p>
        </Panel>
      </div>
    </>
  );
}
