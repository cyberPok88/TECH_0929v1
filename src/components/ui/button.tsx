import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANTES DEL BOTON — oklch design system
// Cada variante tiene un proposito semantico claro:
// - default: accion principal de la vista (solo una por pantalla)
// - secondary: accion secundaria o complementaria
// - outline: accion terciaria o de navegacion
// - ghost: accion discreta — toolbars, iconos, menus
// - destructive: acciones irreversibles (eliminar, cancelar pedido)
// - link: navegacion inline en texto
//
// Estilo Premium: gradiente sutil con sombra para la accion principal.
// El gradiente bg-gradient-to-b con shadow-premium-sm da profundidad sin ser llamativo.
// La jerarquia se comunica por color solido, no por efectos.
// ═══════════════════════════════════════════════════════════════════════════════
const buttonVariants = cva(
    // Base: comportamiento y tipografia comunes a todas las variantes
    [
        "inline-flex items-center justify-center gap-2",
        "whitespace-nowrap rounded-md text-sm font-medium",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "select-none",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    ].join(" "),
    {
        variants: {
            variant: {
                // Accion principal: gradiente premium con shadow
                default: [
                    "bg-gradient-to-b from-primary to-primary/80",
                    "text-primary-fg shadow-premium-sm",
                    "hover:from-primary/95 hover:to-primary/70",
                    "active:scale-[0.98]",
                ].join(" "),

                // Accion destructiva: rojo semantico.
                // ⚠️ El texto va con `text-destructive-foreground` (→ `--destructive-fg`): con
                // `--fg` daba 2.40:1 y el botón más peligroso de la app quedaba ilegible.
                destructive: [
                    "bg-destructive text-destructive-foreground",
                    "hover:opacity-90",
                    "active:scale-[0.98]",
                ].join(" "),

                // Accion terciaria: fondo surface con borde
                outline: [
                    "border border-border bg-surface text-foreground",
                    "hover:bg-hover-background",
                    "active:bg-hover-background active:scale-[0.98]",
                ].join(" "),

                // Accion complementaria: fondo secondary suave
                secondary: [
                    "bg-secondary-bg text-secondary",
                    "hover:bg-secondary/20",
                    "active:scale-[0.98]",
                ].join(" "),

                // Accion discreta: sin fondo hasta el hover
                ghost: [
                    "text-foreground",
                    "hover:bg-hover-background hover:text-foreground",
                    "active:scale-[0.98]",
                ].join(" "),

                // Navegacion inline: solo subrayado
                link: [
                    "text-primary underline-offset-4",
                    "hover:underline",
                ].join(" "),
            },
            size: {
                // sm: formularios compactos, toolbars con espacio limitado
                sm:      "h-8 rounded-md px-3 text-xs",
                // default: uso general
                default: "h-9 px-4 py-2",
                // lg: CTAs destacados, botones de submit en formularios principales
                lg:      "h-10 rounded-md px-8",
                // icon: botones de solo icono — toolbar, topbar, acciones de tabla
                icon:    "h-9 w-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    /**
     * Si true, el Button renderiza como su hijo directo usando Radix Slot.
     * Util para usar el estilo de Button en un componente Link de Next.js:
     * <Button asChild><Link href="/dashboard">Ir al dashboard</Link></Button>
     */
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        // Slot permite que el Button "preste" sus estilos a su hijo
        // sin romper la semantica HTML ni el arbol de componentes
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
