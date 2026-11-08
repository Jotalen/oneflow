import type { Cents } from "@/lib/money";
import type { Account, Bill as NessieBill, Customer, Loan, Transaction } from "@/lib/nessie/types";
import type { OptionScenario } from "@/lib/toyota/types";

export type { Cents };
export const AS_OF = "2026-11-07" as const;

export interface BankAccount {
  id: string;
  kind: "checking" | "savings" | "cd" | "card";
  nickname: string;
  balance: Cents;
  available: Cents;
  creditLimit?: Cents;
}

export interface Debt {
  id: string;
  kind: "auto_loan" | "auto_lease" | "card" | "other";
  label: string;
  balance: Cents;
  aprPct: number;
  monthlyPayment: Cents;
  monthsRemaining?: number;
  dueDay?: number;
}

export interface Bill {
  id: string;
  payee: string;
  nickname?: string;
  amount: Cents;
  dueDay?: number;
  status: string;
  isSubscription: boolean;
  isDebtPayment: boolean;
  /** Mirrors the vehicle contract payment (autopay); excluded from cash-flow so it is not counted twice. */
  isVehiclePayment: boolean;
}

export interface Txn {
  id: string;
  accountId: string;
  kind: string;
  status: string;
  amount: Cents;
  merchantId?: string;
  description?: string;
  createdAt?: string;
}

export interface Car {
  model: string;
  year: number;
  trim: string;
  marketValue: Cents;
  /** Optional so older snapshots still parse. */
  purchasePrice?: Cents;
  condition?: string;
  odometer: number;
  annualMilesEst: number;
  toyotaCareEnds: string;
  warrantyEnds: string;
  nextServiceDue: string;
  openRecall: boolean;
}

export interface Contract {
  type: "loan" | "lease";
  monthsRemaining: number;
  termMonths: number;
  contractStart?: string;
  amountFinanced?: Cents;
  monthsElapsed: number;
  monthlyPayment: Cents;
  balance: Cents;
  payoffQuote: Cents;
  residual?: Cents;
  mileageAllowance?: number;
  estEquity: Cents;
  aprPct?: number;
  dueDay: number;
  missedPayments12m: number;
  /** Fees due if a lease is returned at end (excess mileage + disposition), from the RETURN option. */
  leaseEndFees?: Cents;
}

export interface Profile {
  personaId: string;
  name: string;
  age: number;
  asOf: typeof AS_OF;
  incomeMonthly: Cents;
  paydayDay: number;
  creditTier: string;
  accounts: BankAccount[];
  debts: Debt[];
  bills: Bill[];
  recentTxns: Txn[];
  car?: Car;
  contract?: Contract;
  carOptions: OptionScenario[];
  situation?: { says: string; summary: string };
  flags: { vulnerable: boolean; missed12m: number; marketingConsent: boolean; autopay: boolean };
  source: "nessie" | "snapshot";
}

/** Raw Nessie resources for one persona, as fetched by the profile route. */
export interface NessieBundle {
  customer?: Customer;
  accounts: Account[];
  transactionsByAccount: Record<string, Transaction[]>;
  bills: NessieBill[];
  loans: Loan[];
}

/** Bank-side operations a move executes in Nessie (Task 7 runs them). */
export type NessieOp =
  | { op: "transfer"; from: "checking" | "savings"; to: "savings" | "cd" | "checking" | "card"; amount: Cents; description: string }
  | { op: "createBill"; payee: string; amount: Cents; recurringDay: number; nickname: string }
  | { op: "cancelBill"; billId: string }
  | { op: "openCd"; amount: Cents };

export type NextStep = "Self-service" | "Follow-up" | "Offer" | "Bank";

export interface MoveTfs {
  optionId: string;
  eligibility: string;
  tfsTotalVsKeep: Cents | null;
  nextStepType: string;
  plainSummary: string;
  assumption: string;
  tradeoff: string;
}

export interface Move {
  id: string;
  kind: "bank" | "car" | "human";
  title: string;
  why: string;
  impactKind: "netWorth" | "fees" | "risk";
  nextStep?: NextStep;
  /** Partial overrides for project(); imported type lives in project.ts to avoid a cycle. */
  overrides: Record<string, unknown>;
  /** When the projection cannot express the effect (CD yield, fee avoidance, trade-in equity). */
  fixedImpact24?: Cents;
  execution?: NessieOp[];
  tfs?: MoveTfs;
}
