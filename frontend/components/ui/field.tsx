import * as React from "react"
import { cn } from "@/lib/utils"

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

function Field({ orientation = "vertical", className, ...props }: FieldProps) {
  return (
    <div
      className={cn(
        "flex gap-2",
        orientation === "horizontal" ? "flex-row items-center" : "flex-col",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  )
}

export { Field, FieldLabel }
