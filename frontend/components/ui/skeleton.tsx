import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-[#0f111a] via-[#161827] to-[#0f111a] bg-[length:200%_100%]",
        className
      )}
      style={{
        animation: "shimmer 1.8s ease-in-out infinite",
        backgroundSize: "200% 100%",
      }}
      {...props}
    />
  );
}

export { Skeleton };
