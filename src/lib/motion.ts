"use client";
import { useSyncExternalStore } from "react";

/** The one spring used for UI motion across the app: quick and settled, never bouncy. */
export const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;
/** Lists and cards on load: opacity + 6px rise, 40ms apart. */
export const STAGGER_S = 0.04;
export const RISE_PX = 6;
export const HOVER_SCALE = 1.01;
export const PRESS_SCALE = 0.98;

/**
 * Intro state, shared by the overlay, the sidebar logo and count-up numbers.
 * "off": no intro this load (already played, reduced motion, or skipped).
 * "playing": overlay on screen. "reveal": the ball is jumping and the dashboard fades in under it
 * (cards and numbers animate now). "landing": the ball reached the logo spot and the logo assembles.
 */
export type IntroPhase = "off" | "playing" | "reveal" | "landing";

let phase: IntroPhase = "off";
const listeners = new Set<() => void>();

export function setIntroPhase(next: IntroPhase): void {
  if (next === phase) return;
  phase = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getIntroPhase = (): IntroPhase => phase;

/** Current intro phase. The server always renders "off". */
export function useIntroPhase(): IntroPhase {
  return useSyncExternalStore(subscribe, getIntroPhase, () => "off");
}

/**
 * Card → detail morph. The Overview card the user opened and the page it leads to share one
 * view-transition name, so the card grows into the page (and shrinks back on return).
 */
interface OpenedCard { id: string; path: string }
let openedCard: OpenedCard | null = null;

export const cardMorphName = (id: string): string => `card-${id}`;

export function rememberOpenedCard(id: string, href: string): void {
  openedCard = { id, path: href.split(/[?#]/)[0] };
}

/** The shared name for a page, if it is the page of the last opened card. */
export function morphNameForPath(path: string): string | undefined {
  return openedCard && openedCard.path === path ? cardMorphName(openedCard.id) : undefined;
}
