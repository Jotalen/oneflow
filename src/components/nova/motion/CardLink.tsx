"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactElement, ReactNode } from "react";
import { HOVER_SCALE, PRESS_SCALE, SPRING } from "@/lib/motion";

const MotionLink = motion.create(Link);

export interface CardLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * Link for a clickable card: grows 1% on hover and settles to 98% on press, on the shared spring.
 * Reduced motion keeps it still. The hover shadow is CSS (`.card-lift` on the card surface).
 */
export function CardLink({ href, className, children }: CardLinkProps): ReactElement {
  const reduce = useReducedMotion();
  return (
    <MotionLink
      href={href}
      className={className}
      whileHover={reduce ? undefined : { scale: HOVER_SCALE }}
      whileTap={reduce ? undefined : { scale: PRESS_SCALE }}
      transition={SPRING}
    >
      {children}
    </MotionLink>
  );
}
