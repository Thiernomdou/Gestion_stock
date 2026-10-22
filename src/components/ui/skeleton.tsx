import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-[oklch(0.93_0.008_215)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
