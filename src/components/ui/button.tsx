import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Button-Varianten aus dem Redesign.
 * Desktop: 34px Höhe, Radius 9px. Grosse CTAs (Handy/Tablet): cta / cta-lg.
 */
export type ButtonVariant =
  | "primary"
  | "ghost"
  | "danger-ghost"
  | "danger"
  | "success-outline"
  | "cta"
  | "cta-ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "h-[34px] gap-[7px] rounded-[9px] bg-action px-3.5 text-[13px] font-semibold text-on-action hover:bg-action-hover",
  ghost:
    "h-[34px] gap-[7px] rounded-[9px] border border-line-strong px-3 text-[13px] font-medium text-ink-2 hover:border-action hover:text-ink",
  "danger-ghost":
    "h-[34px] gap-[7px] rounded-[9px] border px-3 text-[13px] font-medium text-hot-tint border-[var(--hot-border)] hover:bg-hot-dim",
  danger:
    "h-16 gap-2.5 rounded-[14px] bg-hot px-6 text-[19px] font-bold text-on-hot hover:brightness-110",
  "success-outline":
    "h-16 gap-[9px] rounded-xl border-[1.5px] border-done bg-done-dim px-4 text-[17px] font-semibold text-done-tint",
  cta: "h-[60px] gap-2 rounded-xl bg-action px-5 text-[17px] font-bold text-on-action hover:bg-action-hover",
  "cta-ghost":
    "h-[60px] gap-2 rounded-xl border border-line-strong px-5 text-[17px] font-medium text-ink-3 hover:text-ink",
};

const BASE =
  "inline-flex items-center justify-center whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button type="button" {...props} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`} />;
}
