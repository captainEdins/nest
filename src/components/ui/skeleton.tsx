import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // D-029: shimmer sweep (globals.css .nest-skeleton) replaces the flat
      // pulse — the muted block stays visible under a moving highlight, and
      // prefers-reduced-motion freezes the sweep harmlessly.
      className={cn("bg-accent nest-skeleton rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
