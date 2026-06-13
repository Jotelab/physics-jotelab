import * as React from "react"
import { Slider } from "radix-ui"

import { cn } from "@/lib/utils"

function SliderRoot({
  className,
  ...props
}: React.ComponentProps<typeof Slider.Root>) {
  return (
    <Slider.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <Slider.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-muted lg:h-1.5">
        <Slider.Range className="absolute h-full bg-primary" />
      </Slider.Track>
      <Slider.Thumb className="block size-7 rounded-full border-2 border-primary/50 bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:size-4 lg:border" />
    </Slider.Root>
  )
}

export { SliderRoot as Slider }
