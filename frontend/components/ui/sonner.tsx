"use client"

import { Toaster as Sonner } from "sonner"
import { cn } from "@/lib/utils"

type ToasterProps = React.ComponentProps<typeof Sonner>

const TOASTER_Z_INDEX = 2147483647

const Toaster = ({
  position = 'top-right',
  offset = { top: 16, right: 16, bottom: 16, left: 16 },
  mobileOffset = { top: 16, right: 16, bottom: 16, left: 16 },
  toastOptions,
  className,
  ...props
}: ToasterProps) => {
  const mergedClassNames = {
    ...toastOptions?.classNames,
    toast: cn(
      "group toast pointer-events-auto group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:font-[family-name:var(--font-outfit)]",
      toastOptions?.classNames?.toast
    ),
    title: cn("group-[.toast]:font-bold group-[.toast]:text-[#476B6B]", toastOptions?.classNames?.title),
    description: cn("group-[.toast]:text-muted-foreground", toastOptions?.classNames?.description),
    actionButton: cn(
      "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
      toastOptions?.classNames?.actionButton
    ),
    cancelButton: cn("group-[.toast]:bg-muted group-[.toast]:text-muted-foreground", toastOptions?.classNames?.cancelButton),
    closeButton: cn("pointer-events-auto", toastOptions?.classNames?.closeButton),
  }

  return (
    <Sonner
      theme="light"
      position={position}
      offset={offset}
      mobileOffset={mobileOffset}
      expand
      gap={8}
      visibleToasts={6}
      className={cn("toaster group pointer-events-none", className)}
      closeButton
      duration={30000}
      style={{ fontFamily: 'var(--font-outfit), sans-serif', zIndex: TOASTER_Z_INDEX }}
      toastOptions={{
        ...toastOptions,
        style: {
          zIndex: TOASTER_Z_INDEX,
          pointerEvents: 'auto',
          ...toastOptions?.style,
        },
        classNames: mergedClassNames,
      }}
      {...props}
    />
  )
}

export { Toaster }
