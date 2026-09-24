"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const labelVariants = cva(
    [
        "text-sm font-medium text-foreground",
        "leading-none cursor-pointer",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
    ].join(" ")
)

export interface LabelProps
    extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
        VariantProps<typeof labelVariants> {}

/**
 * Label — Etiqueta semantica y accesible para inputs.
 * Click en el label activa el input asociado via htmlFor.
 */
const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
    ({ className, ...props }, ref) => (
        <LabelPrimitive.Root
            ref={ref}
            className={cn(labelVariants(), className)}
            {...props}
        />
    )
)
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
