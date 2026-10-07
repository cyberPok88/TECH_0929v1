'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL DE AYUDAS — la pieza del kit que apaga las descripciones (Guía 2.4)
//
// ⭐ PROMOCIÓN A LA 0.8 (criterio del gate de componente-ui): nació con **DOS consumidores**
//   —el Popover del Topbar y la pantalla de Configuración—. Construirlo local "para
//   promoverlo después" habría sido el anti-patrón.
//
// ⭐ 05 Oct 2026 — **EL POPOVER DEL TOPBAR SE RETIRÓ** (decisión del dueño: *«esa
//   configuración ahora está en Configuración»*), y con él `shell/AyudasToggler.tsx`.
//   Hoy el panel tiene **UN solo consumidor**: la tarjeta de Configuración, con
//   `mostrarTextos`. ⇒ La prop se conserva como **contrato del kit** (un envoltorio
//   externo podría querer solo las categorías), pero **hoy nadie la pasa en `false`**.
//
// ⚠️ El buscador y el filtro «solo apagadas» viven ADENTRO (decisión C3 de la Fase 5):
//    solo tienen sentido cuando hay textos que listar, y así los dos envoltorios no
//    tienen que cablear el estado del filtro.
// ⚠️ La escritura son DOS pasos, en el orden del tema: el store (instantáneo, y
//    `<Ayuda>` reacciona solo) y después la BD (fire-and-forget: solo afecta a los
//    otros dispositivos).
// ⚠️ Las ayudas `fijo` NO se listan: no se pueden apagar y ofrecer la casilla sería
//    mentir. Se cuentan aparte y el panel lo dice.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
    MODULOS_CON_AYUDAS,
    NOMBRE_MODULO,
    contarAyudas,
    contarFijas,
    contarPorTipo,
    textosDe,
} from '@/config/ayudas'
import { guardarAyudasAction } from '@/lib/actions/preferences'
import { useAuth, useAuthStoreBase } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'
import { NOMBRE_TIPO, TIPOS_AYUDA, type PreferenciasAyudas, type TipoAyuda } from '@/types/ayudas'

interface PanelAyudasProps {
    /**
     * `true` = además de las categorías, lista **cada texto** con su casilla.
     * ⭐ Hoy **el único consumidor** (la tarjeta de Configuración) lo pasa encendido: el
     * detalle por texto es la razón de ser de esa pantalla. La prop se conserva como
     * contrato del kit — un envoltorio externo podría querer solo las categorías.
     */
    mostrarTextos?: boolean
    className?: string
}

export function PanelAyudas({ mostrarTextos = false, className }: PanelAyudasProps) {
    const ayudas = useAuth((s) => s.usuario?.preferencias?.ayudas)
    const prefs: PreferenciasAyudas = ayudas ?? {}

    const [q, setQ] = useState('')
    const [soloApagadas, setSoloApagadas] = useState(false)
    const [abierto, setAbierto] = useState<string | null>(null)

    /** ¿Se ve esa categoría de ese módulo? **Defecto: sí**. */
    const visible = (modulo: string, tipo: TipoAyuda): boolean => prefs[modulo]?.[tipo] ?? true

    /** ¿Se ve ese texto suelto? **Defecto: sí**. */
    const textoVisible = (modulo: string, clave: string): boolean =>
        prefs[modulo]?.textos?.[clave] ?? true

    const total = MODULOS_CON_AYUDAS.length * TIPOS_AYUDA.length
    const prendidas = MODULOS_CON_AYUDAS.reduce(
        (n, m) => n + TIPOS_AYUDA.filter((t) => visible(m, t)).length,
        0
    )
    const todoVisible = prendidas === total

    /**
     * Aplica y persiste, en el orden del tema:
     *   1. el store — el cambio se ve al instante (y `<Ayuda>` reacciona solo);
     *   2. la BD    — fire-and-forget.
     * ⚠️ Se manda el mapa **completo** ya fusionado: el merge del store y el de la
     *    action son **superficiales** (igual que con `tema`).
     */
    const aplicar = (siguiente: PreferenciasAyudas) => {
        useAuthStoreBase.getState().actualizarPreferencias({ ayudas: siguiente })
        void guardarAyudasAction(siguiente)
    }

    const cambiar = (modulo: string, tipo: TipoAyuda, valor: boolean) =>
        aplicar({ ...prefs, [modulo]: { ...prefs[modulo], [tipo]: valor } })

    const cambiarTexto = (modulo: string, clave: string, valor: boolean) =>
        aplicar({
            ...prefs,
            [modulo]: {
                ...prefs[modulo],
                textos: { ...prefs[modulo]?.textos, [clave]: valor },
            },
        })

    /** Todo el sistema de una vez: prender o apagar **todas** las categorías. */
    const cambiarTodo = (valor: boolean) => {
        const siguiente: PreferenciasAyudas = {}
        for (const modulo of MODULOS_CON_AYUDAS) {
            siguiente[modulo] = {}
            for (const tipo of TIPOS_AYUDA) siguiente[modulo][tipo] = valor
        }
        aplicar(siguiente)
    }

    /** El filtro de la variante larga: por clave o por contenido, y «solo apagadas». */
    const filtrar = useMemo(() => {
        const termino = q.trim().toLowerCase()
        return (clave: string, texto: string, modulo: string) => {
            if (soloApagadas && textoVisible(modulo, clave)) return false
            if (!termino) return true
            return clave.toLowerCase().includes(termino) || texto.toLowerCase().includes(termino)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, soloApagadas, prefs])

    return (
        <div className={cn('flex flex-col', className)}>
            {/* Interruptor maestro */}
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
                <Checkbox
                    id="ayudas-todo"
                    checked={todoVisible}
                    onCheckedChange={(v) => cambiarTodo(v === true)}
                />
                <label htmlFor="ayudas-todo" className="cursor-pointer text-[12.5px] font-medium">
                    Ver todo
                </label>
                <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
                    {prendidas}/{total}
                </span>
            </div>

            {/* El filtro: solo en la variante que lista textos */}
            {mostrarTextos ? (
                <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
                    <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar una descripción…"
                        className="h-8 text-[12.5px]"
                        aria-label="Buscar una descripción"
                    />
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
                        <Checkbox
                            checked={soloApagadas}
                            onCheckedChange={(v) => setSoloApagadas(v === true)}
                        />
                        Solo apagadas
                    </label>
                </div>
            ) : null}

            {MODULOS_CON_AYUDAS.map((modulo) => {
                const cuenta = contarPorTipo(modulo)
                const fijas = contarFijas(modulo)
                const textos = textosDe(modulo)
                const textosVisibles = textos.filter((t) => filtrar(t.clave, t.texto, modulo))
                const expandido = abierto === modulo
                return (
                    <div key={modulo} className="border-b border-border last:border-b-0">
                        <p className="bg-surface-2 px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {NOMBRE_MODULO[modulo] ?? modulo} · {contarAyudas(modulo)} textos
                        </p>

                        {TIPOS_AYUDA.map((tipo) => (
                            <div key={tipo} className="flex items-center gap-2.5 px-4 py-2">
                                <Checkbox
                                    id={`ayuda-${modulo}-${tipo}`}
                                    checked={visible(modulo, tipo)}
                                    onCheckedChange={(v) => cambiar(modulo, tipo, v === true)}
                                />
                                <label
                                    htmlFor={`ayuda-${modulo}-${tipo}`}
                                    className="cursor-pointer text-[12.5px]"
                                >
                                    {NOMBRE_TIPO[tipo]}
                                </label>
                                <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
                                    {cuenta[tipo]}
                                </span>
                            </div>
                        ))}

                        {fijas > 0 ? (
                            <p className="px-4 pb-2.5 text-[11px] text-muted-foreground">
                                {fijas} aviso(s) de confirmación no se ocultan: ahí el texto es el
                                botón.
                            </p>
                        ) : null}

                        {/* ⭐ La V2: una casilla por TEXTO */}
                        {mostrarTextos && textos.length > 0 ? (
                            <button
                                type="button"
                                onClick={() => setAbierto(expandido ? null : modulo)}
                                className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[12px] font-medium text-primary hover:bg-hover-background"
                                aria-expanded={expandido}
                            >
                                <ChevronRight
                                    className={cn('size-3.5 transition-transform', expandido && 'rotate-90')}
                                    aria-hidden="true"
                                />
                                {expandido ? 'Ocultar' : 'Ver'} los {textos.length} textos
                            </button>
                        ) : null}

                        {mostrarTextos && expandido
                            ? textosVisibles.map((t) => {
                                  const categoriaPrendida = visible(modulo, t.tipo)
                                  const id = `ayuda-texto-${t.clave}`
                                  return (
                                      <div
                                          key={t.clave}
                                          className="flex items-start gap-2.5 py-1.5 pl-8 pr-4"
                                      >
                                          <Checkbox
                                              id={id}
                                              checked={textoVisible(modulo, t.clave)}
                                              disabled={!categoriaPrendida}
                                              onCheckedChange={(v) =>
                                                  cambiarTexto(modulo, t.clave, v === true)
                                              }
                                              className="mt-0.5"
                                          />
                                          <label
                                              htmlFor={id}
                                              className={cn(
                                                  'min-w-0 cursor-pointer text-[12px] leading-snug',
                                                  !categoriaPrendida && 'cursor-not-allowed text-muted-foreground'
                                              )}
                                          >
                                              {t.texto}
                                              <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                                                  {NOMBRE_TIPO[t.tipo]} · {t.clave}
                                              </span>
                                          </label>
                                      </div>
                                  )
                              })
                            : null}

                        {mostrarTextos && expandido && textosVisibles.length === 0 ? (
                            <p className="px-4 pb-2.5 pl-8 text-[11.5px] text-muted-foreground">
                                Ningún texto coincide con el filtro.
                            </p>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}
