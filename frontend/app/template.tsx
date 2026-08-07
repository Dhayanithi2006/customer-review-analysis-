"use client";

import { PageTransition } from "@/components/motion/page-transition";

/**
 * Remounts on navigation — enables subtle page enter transitions app-wide.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
