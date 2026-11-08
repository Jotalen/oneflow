import { z } from "zod";
import { toDollars, type Cents } from "@/lib/money";
import { getNessie, type NessieClient } from "./client";
import { Account, Bill, Customer, EventsPage, list, Loan, Merchant, Simulation, Transaction } from "./types";

export interface AddressDTO { street_number: string; street_name: string; city: string; state: string; zip: string }
export interface CustomerCreate { first_name: string; last_name: string; address: AddressDTO }
export interface AccountCreate { type: "Checking" | "Savings" | "Credit Card"; nickname: string; balance_cents: Cents; credit_limit_cents?: Cents; rewards?: number }
export interface MoneyCreate { amount_cents: Cents; description?: string; medium?: "balance" | "rewards" }
export interface PurchaseCreate extends MoneyCreate { merchant_id: string }
export interface TransferCreate extends MoneyCreate { payee_id: string }
/** Bills are the one dollars-denominated endpoint (ADR-006); we take cents and convert here. */
export interface BillCreate { status: "pending" | "cancelled" | "completed" | "recurring"; payee: string; amountCents: Cents; nickname?: string; payment_date?: string; recurring_date?: number }
export interface LoanCreate { type: string; status: string; credit_score: number; monthly_payment_cents: Cents; amount_cents: Cents; description: string }
export interface MerchantCreate { name: string; category?: string; address?: AddressDTO; geocode?: { lat: number; lng: number } }
export interface SimulationCreate { mode: "historical" | "live"; customers?: number; transactions?: number; anomaly_rate?: number; scenarios?: string[]; seed?: number; rate_per_minute?: number; duration_seconds?: number }
export interface WebhookCreate { mode: "notify" | "decision"; url: string; events?: string[]; kinds?: string[]; account_id?: string; on_error?: "approve" | "decline"; max_wait_seconds?: number }

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export function makeApi(client: NessieClient) {
  return {
    health: () => client.fetch<{ status: string }>("/health"),

    createCustomer: (dto: CustomerCreate) => client.fetch("/customers", { ...json("POST", dto), schema: Customer }),
    getCustomer: (id: string) => client.fetch(`/customers/${id}`, { schema: Customer }),
    deleteCustomer: (id: string) => client.fetch<void>(`/customers/${id}`, json("DELETE")),

    createAccount: (customerId: string, dto: AccountCreate) =>
      client.fetch(`/customers/${customerId}/accounts`, { ...json("POST", dto), schema: Account }),
    getAccount: (id: string) => client.fetch(`/accounts/${id}`, { schema: Account }),
    getCustomerAccounts: (customerId: string) => client.fetch(`/customers/${customerId}/accounts`, { schema: list(Account) }),
    deleteAccount: (id: string) => client.fetch<void>(`/accounts/${id}`, json("DELETE")),

    deposit: (accountId: string, dto: MoneyCreate) => client.fetch(`/accounts/${accountId}/deposits`, { ...json("POST", dto), schema: Transaction }),
    withdrawal: (accountId: string, dto: MoneyCreate) => client.fetch(`/accounts/${accountId}/withdrawals`, { ...json("POST", dto), schema: Transaction }),
    purchase: (accountId: string, dto: PurchaseCreate) => client.fetch(`/accounts/${accountId}/purchases`, { ...json("POST", dto), schema: Transaction }),
    transfer: (accountId: string, dto: TransferCreate) => client.fetch(`/accounts/${accountId}/transfers`, { ...json("POST", dto), schema: Transaction }),
    listTransactions: (accountId: string, limit = 200) =>
      client.fetch(`/accounts/${accountId}/transactions?limit=${limit}`, { schema: list(Transaction) }),
    settle: (txId: string) => client.fetch(`/transactions/${txId}/settle`, { ...json("POST", {}), schema: Transaction }),
    getTransaction: (id: string) => client.fetch(`/transactions/${id}`, { schema: Transaction }),
    decide: (txId: string, dto: { decision: "approve" | "decline"; reason?: string }) =>
      client.fetch(`/transactions/${txId}/decision`, { ...json("POST", dto), schema: Transaction }),

    createBill: (accountId: string, dto: BillCreate) => {
      const { amountCents, ...rest } = dto;
      return client.fetch(`/accounts/${accountId}/bills`, { ...json("POST", { ...rest, payment_amount: toDollars(amountCents) }), schema: Bill });
    },
    getAccountBills: (accountId: string) => client.fetch(`/accounts/${accountId}/bills`, { schema: list(Bill) }),
    updateBill: (id: string, patch: Partial<{ status: BillCreate["status"]; nickname: string; recurring_date: number }>) =>
      client.fetch(`/bills/${id}`, { ...json("PATCH", patch), schema: Bill }),
    deleteBill: (id: string) => client.fetch<void>(`/bills/${id}`, json("DELETE")),
    payBill: (billId: string, dto?: { amount_cents?: Cents; medium?: "balance" | "rewards" }) =>
      client.fetch(`/bills/${billId}/payments`, { ...json("POST", dto ?? {}), schema: Transaction }),

    createLoan: (accountId: string, dto: LoanCreate) => client.fetch(`/accounts/${accountId}/loans`, { ...json("POST", dto), schema: Loan }),
    getAccountLoans: (accountId: string) => client.fetch(`/accounts/${accountId}/loans`, { schema: list(Loan) }),
    deleteLoan: (id: string) => client.fetch<void>(`/loans/${id}`, json("DELETE")),

    createMerchant: (dto: MerchantCreate) => client.fetch("/merchants", { ...json("POST", dto), schema: Merchant }),
    listMerchants: () => client.fetch("/merchants", { schema: list(Merchant) }),
    getMerchant: (id: string) => client.fetch(`/merchants/${id}`, { schema: Merchant }),

    listEvents: (q: { after?: number; types?: string[]; account_id?: string; limit?: number }) => {
      const p = new URLSearchParams();
      if (q.after !== undefined) p.set("after", String(q.after));
      if (q.types?.length) p.set("types", q.types.join(","));
      if (q.account_id) p.set("account_id", q.account_id);
      if (q.limit) p.set("limit", String(q.limit));
      return client.fetch(`/events?${p.toString()}`, { schema: EventsPage });
    },

    createSimulation: (dto: SimulationCreate) => client.fetch("/simulations", { ...json("POST", dto), schema: Simulation }),
    getSimulation: (id: string) => client.fetch(`/simulations/${id}`, { schema: Simulation }),

    createWebhook: (dto: WebhookCreate) => client.fetch("/webhooks", { ...json("POST", dto), schema: z.object({ id: z.string() }).passthrough() }),
  };
}

export type NessieApi = ReturnType<typeof makeApi>;

let singletonApi: NessieApi | null = null;
export function nessieApi(): NessieApi {
  return (singletonApi ??= makeApi(getNessie()));
}
