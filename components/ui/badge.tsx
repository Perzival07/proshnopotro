import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors select-none",
  {
    variants: {
      variant: {
        // Core Assessment Statuses
        available:
          "bg-[#FAEEDA] text-[#633806] border border-[#F3DCB5]/80 font-semibold",
        submitted:
          "bg-[#E1F5EE] text-[#085041] border border-[#C2EBDB]/80 font-semibold",
        closed:
          "bg-[#F1EFE8] text-[#444441] border border-[#E2DFD6] font-medium",
        // System / Category badges
        brand:
          "bg-brand-tint text-brand-navy border border-brand-blue/20",
        outline:
          "border border-brand-border text-brand-ink",
        admin:
          "bg-brand-navy text-white font-medium",
      },
    },
    defaultVariants: {
      variant: "available",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
