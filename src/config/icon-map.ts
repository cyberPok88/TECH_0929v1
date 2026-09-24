// ═══════════════════════════════════════════════════════════════════════════════
// DICCIONARIO DE ICONOS — Guía 0.6
//
// La BD guarda el icono como string kebab-case ('file-text'), no como componente.
// Este mapa hace la traducción. Es lo que permite que agregar un módulo al ERP
// sea un INSERT en `modulos`/`submodulos` y no un cambio en el Sidebar.
//
// ⭐ MEJORA 22 Sep 2026 — de lucide a PHOSPHOR. Los iconos de módulo/submódulo son
//    la IDENTIDAD del módulo y se dibujan con el peso **`duotone`** (trazo + relleno
//    tenue): se leen llenos y vivos sobre el badge de color. Lucide (línea) sigue
//    usándose para los utensilios de UI (chevrons, loaders, lápices…) — son dos
//    librerías con dos trabajos distintos.
//
//    ⚠️ Las CLAVES (los valores de `modulos.icono`/`submodulos.icono`) NO cambiaron:
//    siguen en nomenclatura lucide histórica. Solo cambia el COMPONENTE al que apuntan.
//    Donde Phosphor no tiene el equivalente exacto, se eligió el de significado más
//    cercano (ej. `package-plus` → `BoxArrowUp`).
//
// ⚠️ Import explícito, NO `import * as Icons`: el namespace impide el tree-shaking
//    y arrastraría los ~1.500 iconos de Phosphor al bundle.
// ═══════════════════════════════════════════════════════════════════════════════

import { createElement } from 'react'
import {
    // ── Iconos de módulo (9) ───────────────────────────────────────────────────
    GearSix,
    Books,
    Truck,
    Package,
    ShoppingCart,
    Money,
    MapPin,
    FileText,
    ChartBar,

    // ── Iconos de submódulo ────────────────────────────────────────────────────
    SquaresFour,
    Buildings,
    Users,
    ShieldCheck,
    SlidersHorizontal,
    Cube,
    Wrench,
    AddressBook,
    Factory,
    BoxArrowUp,
    BoxArrowDown,
    CreditCard,
    Stack,
    ArrowsLeftRight,
    Receipt,
    ArrowUUpLeft,
    HandCoins,
    DeviceMobile,
    Wallet,
    PaperPlaneTilt,
    Scroll,
    SealCheck,
    Certificate,
    FilePlus,
    FileMinus,
    TrendUp,
    ClipboardText,
    PiggyBank,
    Tray,
    MagnifyingGlass,
    Sparkle,
    Warehouse,
    Warning,
    GridFour,

    // ── Fallback ───────────────────────────────────────────────────────────────
    Question,
} from '@phosphor-icons/react'
import type { Icon as IconPhosphor, IconProps } from '@phosphor-icons/react'

/** Icono ya resuelto por la app: Phosphor con el peso `duotone` fijo. */
export type IconoApp = IconPhosphor

/** Fija el peso `duotone` — la identidad visual de los iconos del ERP.
 *  Se envuelve con `createElement` (no JSX) porque este archivo es `.ts`, no `.tsx`. */
function duotone(Base: IconPhosphor): IconoApp {
    const Envuelto = (props: IconProps) => createElement(Base, { ...props, weight: 'duotone' })
    Envuelto.displayName = `Duotone(${Base.displayName ?? 'Icono'})`
    return Envuelto as unknown as IconoApp
}

/**
 * Registro string → componente.
 * Las claves son EXACTAMENTE los valores de modulos.icono y submodulos.icono.
 */
export const iconMap: Record<string, IconoApp> = {
    // ── Módulos ────────────────────────────────────────────────────────────────
    'settings': duotone(GearSix),
    'library': duotone(Books),
    'truck': duotone(Truck),
    'package': duotone(Package),
    'shopping-cart': duotone(ShoppingCart),
    'banknote': duotone(Money),
    'map-pinned': duotone(MapPin),
    'file-check': duotone(FileText),
    'bar-chart-3': duotone(ChartBar),

    // ── Sistema ────────────────────────────────────────────────────────────────
    'layout-dashboard': duotone(SquaresFour),
    'building-2': duotone(Buildings),
    'users': duotone(Users),
    'shield-check': duotone(ShieldCheck),
    'sliders-horizontal': duotone(SlidersHorizontal),

    // ── Catálogos ──────────────────────────────────────────────────────────────
    'box': duotone(Cube),
    'wrench': duotone(Wrench),
    'contact': duotone(AddressBook),
    'factory': duotone(Factory),

    // ── Compras ────────────────────────────────────────────────────────────────
    'package-plus': duotone(BoxArrowUp),
    'credit-card': duotone(CreditCard),
    'package-minus': duotone(BoxArrowDown),

    // ── Inventario ─────────────────────────────────────────────────────────────
    'boxes': duotone(Stack),
    'arrow-left-right': duotone(ArrowsLeftRight),

    // ── Ventas ─────────────────────────────────────────────────────────────────
    'file-text': duotone(FileText),
    'receipt': duotone(Receipt),
    'undo-2': duotone(ArrowUUpLeft),

    // ── Cobranza ───────────────────────────────────────────────────────────────
    'hand-coins': duotone(HandCoins),
    'tablet-smartphone': duotone(DeviceMobile),
    'wallet': duotone(Wallet),

    // ── Logística ──────────────────────────────────────────────────────────────
    'send': duotone(PaperPlaneTilt),
    'scroll-text': duotone(Scroll),
    'package-check': duotone(SealCheck),

    // ── Facturación ────────────────────────────────────────────────────────────
    'file-badge': duotone(Certificate),
    'file-plus': duotone(FilePlus),
    'file-minus': duotone(FileMinus),

    // ── Reportes ───────────────────────────────────────────────────────────────
    'trending-up': duotone(TrendUp),
    'clipboard-list': duotone(ClipboardText),
    'piggy-bank': duotone(PiggyBank),

    // ── Entradas (FLUJO_01) ─────────────────────────────────────────────────────
    'inbox': duotone(Tray),
    'search-check': duotone(MagnifyingGlass),
    'sparkles': duotone(Sparkle),
    'warehouse': duotone(Warehouse),
    'triangle-alert': duotone(Warning),

    // ── Catálogos básicos (Guía 1.3 · R4) ────────────────────────────────────
    'layout-grid': duotone(GridFour),
}

/** Icono que se usa cuando la BD trae un string no registrado. */
export const ICONO_FALLBACK: IconoApp = duotone(Question)

/**
 * Resuelve el string de la BD a un componente.
 *
 * Nunca lanza: una semilla mal escrita degrada UN ítem del menú, no tumba la app.
 * Ver un `Question` en el Sidebar significa "falta registrar este icono aquí".
 *
 * @param nombre valor de modulos.icono o submodulos.icono (puede ser null)
 */
export function getIcon(nombre: string | null | undefined): IconoApp {
    if (!nombre) return ICONO_FALLBACK
    return iconMap[nombre] ?? ICONO_FALLBACK
}
