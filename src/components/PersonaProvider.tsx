"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface PersonaSummary { id: string; name: string; age: number; says: string }
interface Ctx { personaId: string; setPersonaId: (id: string) => void; personas: PersonaSummary[] }

const PersonaCtx = createContext<Ctx | null>(null);
const DEFAULT_PERSONA = "C003";
const STORAGE_KEY = "nm:persona";

export function PersonaProvider({ personas, children }: { personas: PersonaSummary[]; children: ReactNode }) {
  const [personaId, setPersonaIdState] = useState(DEFAULT_PERSONA);
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("p");
      const saved = fromUrl ?? localStorage.getItem(STORAGE_KEY);
      if (saved && personas.some((p) => p.id === saved)) setPersonaIdState(saved);
    } catch { /* storage unavailable */ }
  }, [personas]);
  const setPersonaId = (id: string) => {
    setPersonaIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
      const url = new URL(window.location.href);
      url.searchParams.set("p", id);
      window.history.replaceState(null, "", url);
    } catch { /* ignore */ }
  };
  const value = useMemo(() => ({ personaId, setPersonaId, personas }), [personaId, personas]);
  return <PersonaCtx.Provider value={value}>{children}</PersonaCtx.Provider>;
}

export function usePersona(): Ctx {
  const ctx = useContext(PersonaCtx);
  if (!ctx) throw new Error("usePersona outside PersonaProvider");
  return ctx;
}
