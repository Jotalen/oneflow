"use client";
import { usePersona } from "./PersonaProvider";

export function PersonaSwitcher() {
  const { personaId, setPersonaId, personas } = usePersona();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted hidden sm:inline">Persona</span>
      <select
        name="persona"
        aria-label="Persona"
        value={personaId}
        onChange={(e) => setPersonaId(e.target.value)}
        className="glass px-3 py-1.5 text-sm bg-transparent outline-none focus:border-accent"
      >
        {personas.map((p) => (
          <option key={p.id} value={p.id} className="bg-[#141b34]">
            {p.id} · {p.name}, {p.age}
          </option>
        ))}
      </select>
    </label>
  );
}
