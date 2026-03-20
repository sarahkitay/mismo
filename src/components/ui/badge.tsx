import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[var(--radius-small)] border px-2.5 py-1 text-xs font-medium tracking-[0.02em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:outline-none focus-visible:shadow-[var(--mismo-focus-ring)] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow,border-color,background-color] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-border-200)] bg-[var(--color-surface-100)] text-[var(--color-text-secondary)]",
        secondary:
          "border-[var(--color-border-200)] bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]",
        destructive:
          "border-[var(--color-alert-600)] bg-[var(--color-surface-100)] text-[var(--color-alert-600)]",
        outline:
          "border-[var(--color-border-200)] text-[var(--color-text-primary)] bg-[var(--color-surface-100)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
