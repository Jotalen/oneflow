"use client";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export interface PersonaSummary { id: string; name: string; age: number; says: string }
interface Ctx { personaId: string; ready: boolean; setPersonaId: (id: string) => void; personas: PersonaSummary[] }

const PersonaCtx = createContext<Ctx | null>(null);
const DEFAULT_PERSONA = "C003";
const STORAGE_KEY = "nm:persona";
const CHANGE_EVENT = "nm:persona-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/**
 * Persona chosen in the browser: ?p= wins, then the last saved choice. Empty string = none chosen.
 * A ?p= choice is remembered, because in-app links drop the query string.
 */
function readChosen(): string {
  const fromUrl = new URLSearchParams(window.location.search).get("p");
  try {
    if (fromUrl && localStorage.getItem(STORAGE_KEY) !== fromUrl) localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl ?? localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return fromUrl ?? ""; // storage unavailable
  }
}

/** Pages are prerendered, so the persona is only known in the browser; `ready` says when it is. */
export function PersonaProvider({ personas, children }: { personas: PersonaSummary[]; children: ReactNode }) {
  const chosen = useSyncExternalStore(subscribe, readChosen, () => null);
  const ready = chosen !== null;
  const personaId = chosen && personas.some((p) => p.id === chosen) ? chosen : DEFAULT_PERSONA;

  const setPersonaId = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
      const url = new URL(window.location.href);
      url.searchParams.set("p", id);
      window.history.replaceState(null, "", url);
    } catch { /* storage or history unavailable */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo(() => ({ personaId, ready, setPersonaId, personas }), [personaId, ready, setPersonaId, personas]);
  return <PersonaCtx.Provider value={value}>{children}</PersonaCtx.Provider>;
}

export function usePersona(): Ctx {
  const ctx = useContext(PersonaCtx);
  if (!ctx) throw new Error("usePersona outside PersonaProvider");
  return ctx;
}
