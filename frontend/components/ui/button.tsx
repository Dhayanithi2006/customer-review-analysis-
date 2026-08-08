"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-ripple-host inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[16px] text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
        outline:
          "border border-white/12 bg-transparent text-slate-400 hover:border-white/20 hover:text-slate-100 hover:bg-surface-2 active:scale-[0.98]",
        ghost:
          "bg-transparent text-slate-400 hover:bg-surface-2 hover:text-slate-100 active:scale-[0.98]",
        secondary:
          "bg-surface-2 text-slate-200 border border-white/[0.08] hover:bg-surface-3 hover:border-white/14 active:scale-[0.98]",
        destructive:
          "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 active:scale-[0.98]",
        success:
          "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-[0.98]",
        link:
          "bg-transparent text-primary-glow underline-offset-4 hover:underline p-0 h-auto shadow-none overflow-visible",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3.5 text-xs rounded-xl",
        lg: "h-11 px-7 text-[15px] rounded-2xl",
        icon: "h-10 w-10 rounded-[16px]",
        "icon-sm": "h-8 w-8 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!asChild && variant !== "link" && !props.disabled) {
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const sizePx = Math.max(rect.width, rect.height) * 1.1;
        const ripple = document.createElement("span");
        ripple.className = "btn-ripple";
        ripple.style.width = `${sizePx}px`;
        ripple.style.height = `${sizePx}px`;
        ripple.style.left = `${e.clientX - rect.left - sizePx / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - sizePx / 2}px`;
        button.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove());
      }
      onClick?.(e);
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
