"use client";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { RISE_PX, SPRING, STAGGER_S, useIntroPhase } from "@/lib/motion";

/**
 * Flipped after the first stagger on the client. Later client navigations render cards
 * in place, so a view-transition morph back to the Overview never captures a hidden card.
 */
let hasStaggered = false;

const HIDDEN = { opacity: 0, y: RISE_PX } as const;
const SHOWN = { opacity: 1, y: 0 } as const;

export interface StaggerItemProps {
  index: number;
  className?: string;
  children: ReactNode;
}

/** Fades and rises a list item in, `index` steps after the first, on the first app load only. */
export function StaggerItem({ index, className, children }: StaggerItemProps): ReactElement {
  const [animateIn] = useState(() => !hasStaggered);
  const phase = useIntroPhase();
  useEffect(() => {
    hasStaggered = true;
  }, []);
  return (
    <motion.div
      className={className}
      initial={animateIn ? HIDDEN : false}
      animate={animateIn && phase === "playing" ? HIDDEN : SHOWN}
      transition={{ ...SPRING, delay: index * STAGGER_S }}
    >
      {children}
    </motion.div>
  );
}
