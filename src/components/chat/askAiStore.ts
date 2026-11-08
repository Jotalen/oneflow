"use client";
import { useCallback, useState, useSyncExternalStore } from "react";
import type { AutoBuyProposal } from "@/lib/chat/facts";

/**
 * Ask AI panel placement. "docked" covers the left sidebar; "expanded" takes over the main area
 * and the sidebar shows again; "closed" is the normal app.
 */
export type AskAiMode = "closed" | "docked" | "expanded";

let mode: AskAiMode = "closed";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function setAskAiMode(next: AskAiMode): void {
  if (next === mode) return;
  mode = next;
  listeners.forEach((l) => l());
}

export function useAskAiMode(): AskAiMode {
  return useSyncExternalStore(subscribe, () => mode, () => "closed");
}

const DESKTOP_QUERY = "(min-width: 768px)";

/** Opens docked over the sidebar; on phones or with the icon rail there is no room, so it opens expanded. */
export function openAskAi(): void {
  const rail = document.documentElement.dataset.sidebar === "collapsed";
  const desktop = window.matchMedia(DESKTOP_QUERY).matches;
  setAskAiMode(desktop && !rail ? "docked" : "expanded");
}

export interface ChatMessage { role: "user" | "assistant"; content: string; proposal?: AutoBuyProposal; provider?: string }

const MAX_SAVED = 30;
const chatKey = (persona: string) => `oneflow:chat:${persona}`;

function readChat(persona: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(chatKey(persona));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

/** Chat history per customer, saved on this device (it also feeds the suggested prompts). */
export function useChatHistory(persona: string): [ChatMessage[], (next: ChatMessage[]) => void] {
  const [state, setState] = useState<{ persona: string; messages: ChatMessage[] } | null>(null);
  const messages = state?.persona === persona ? state.messages : typeof window === "undefined" ? [] : readChat(persona);
  const save = useCallback((next: ChatMessage[]) => {
    const kept = next.slice(-MAX_SAVED);
    setState({ persona, messages: kept });
    try { localStorage.setItem(chatKey(persona), JSON.stringify(kept)); } catch { /* storage full or blocked: history just isn't kept */ }
  }, [persona]);
  return [messages, save];
}

/** A confirmed Solana auto-buy plan, saved on this device. Each buy still needs approval in Phantom. */
export interface AutoBuyPlan { percent: number; perPaycheckCents: number; perPaycheck: string; startsOn: string; savedAt: string }
const planKey = (persona: string) => `oneflow:autobuy:${persona}`;

export function readAutoBuy(persona: string): AutoBuyPlan | null {
  try {
    const raw = localStorage.getItem(planKey(persona));
    return raw ? (JSON.parse(raw) as AutoBuyPlan) : null;
  } catch {
    return null;
  }
}

export function saveAutoBuy(persona: string, p: AutoBuyProposal): AutoBuyPlan {
  const plan: AutoBuyPlan = { percent: p.percent, perPaycheckCents: p.perPaycheckCents, perPaycheck: p.perPaycheck, startsOn: p.nextPayday, savedAt: new Date().toISOString() };
  try { localStorage.setItem(planKey(persona), JSON.stringify(plan)); } catch { /* blocked storage: plan lives for this session only */ }
  return plan;
}
