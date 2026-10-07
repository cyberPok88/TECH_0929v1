'use client'

// EsquemaAtributosEditor.tsx — editor del JSONB esquema_atributos (Guía 1.0 · P6)
// ⭐ 05 Oct 2026 — se exponen las TRES banderas que hasta ahora SOLO existían por SQL
// (`en_entrada`, `valor_default`, `derivado_de`). El «camino» de un atributo
// (recepción → revisión → automático → derivado) se declara en UN lugar y deja de
// divergir del dato: el caso vivo fue el `bus` (DDR) de RAM — la decisión lo ponía en
// recepción, la BD lo tenía en revisión, y era imposible corregirlo desde la UI.
//
// Excluyentes (reflejan lo que YA hacen los consumidores, no una regla nueva):
//   · `valor_default` ⇒ NO se pregunta: apaga `en_entrada` y `derivado_de`
//     (`PartidasEntradaGrid` excluye `!a.valor_default`; `WizardRevision` lo aplica solo).
//   · `derivado_de`   ⇒ se CALCULA del atributo base: apaga `en_entrada`
//     (el grid lo pinta read-only y `aplicarDerivados()` lo resuelve).
import type { AtributoEsquema } from '@/types/catalogos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface Props {
  value: AtributoEsquema[]
  onChange: (v: AtributoEsquema[]) => void
}

export function EsquemaAtributosEditor({ value, onChange }: Props) {
  const actualizar = (i: number, patch: Partial<AtributoEsquema>) =>
    onChange(value.map((a, idx) => (idx === i ? { ...a, ...patch } : a)))

  return (
    <div className="space-y-3">
      {value.map((at, i) => {
        const automatico = Boolean(at.valor_default)
        const derivado = at.derivado_de
        // Fuentes posibles del derivado: los OTROS atributos `select` CON opciones — el
        // mapa se enumera recorriendo esas opciones (derivar de texto libre no tiene mapa).
        const fuentes = value.filter(
          (o, idx) => idx !== i && o.tipo === 'select' && (o.opciones ?? []).length > 0
        )
        const fuente = derivado ? fuentes.find((f) => f.clave === derivado.clave) : undefined
        const fuenteInvalida = Boolean(derivado) && !fuente
        const noSePregunta = automatico || Boolean(derivado)

        return (
          <div key={i} className="rounded border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="clave (kebab)" value={at.clave} onChange={(e) => actualizar(i, { clave: e.target.value })} />
              <Input placeholder="Etiqueta" value={at.etiqueta} onChange={(e) => actualizar(i, { etiqueta: e.target.value })} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <select
                className="h-9 rounded border bg-surface px-2 text-sm"
                value={at.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as AtributoEsquema['tipo']
                  // ⭐ 06 Oct 2026 — `multi` también lleva OPCIONES (el catálogo del conjunto).
                  actualizar(i, {
                    tipo,
                    opciones: tipo === 'select' || tipo === 'multi' ? at.opciones ?? [] : undefined,
                  })
                }}
              >
                <option value="text">Texto</option>
                <option value="number">Número</option>
                <option value="select">Select</option>
                <option value="multi">Conjunto (varios)</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                Requerido
                <Switch checked={at.requerido} onCheckedChange={(r) => actualizar(i, { requerido: r })} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                Identidad (huella)
                <Switch checked={at.en_huella ?? false} onCheckedChange={(r) => actualizar(i, { en_huella: r })} />
              </label>
              <label
                className={`flex items-center gap-2 text-sm ${noSePregunta ? 'text-muted-foreground' : ''}`}
                title={automatico ? 'Tiene valor automático: no se pregunta' : derivado ? 'Se calcula del atributo base: no se pregunta' : 'Se captura en RECEPCIÓN (entrada soft)'}
              >
                Recepción
                <Switch
                  checked={(at.en_entrada ?? false) && !noSePregunta}
                  disabled={noSePregunta}
                  onCheckedChange={(r) => actualizar(i, { en_entrada: r })}
                />
              </label>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                Quitar
              </Button>
            </div>
            {(at.tipo === 'select' || at.tipo === 'multi') && (
              <Input
                className="mt-2"
                placeholder={
                  at.tipo === 'multi'
                    ? 'Opciones del conjunto, separadas por comas (ej. AM4, AM5)'
                    : 'Opciones separadas por comas'
                }
                value={(at.opciones ?? []).join(', ')}
                onChange={(e) => actualizar(i, { opciones: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            )}

            {/* ── Automático: no se pregunta (caso vivo: HDD `rpm` = 7200) ── */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                className="h-8 max-w-64"
                placeholder="Valor automático (ej. 7200) — vacío = se pregunta"
                value={at.valor_default ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  actualizar(
                    i,
                    v
                      ? { valor_default: v, en_entrada: false, derivado_de: undefined }
                      : { valor_default: undefined }
                  )
                }}
              />
              {automatico && (
                <span className="text-xs text-muted-foreground">
                  Automático: no se pregunta en recepción ni en revisión.
                </span>
              )}
            </div>

            {/* ── Derivado: se calcula de otro atributo (caso vivo: HDD `form_factor` ← `tipo`) ── */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Derivado de</span>
              <select
                className="h-8 rounded border bg-surface px-2 text-xs"
                value={derivado?.clave ?? ''}
                disabled={automatico}
                onChange={(e) => {
                  const clave = e.target.value
                  if (!clave) return actualizar(i, { derivado_de: undefined })
                  actualizar(i, {
                    // Al cambiar de fuente el mapa viejo no aplica: se rearma vacío.
                    derivado_de: { clave, mapa: derivado?.clave === clave ? (derivado?.mapa ?? {}) : {} },
                    en_entrada: false,
                  })
                }}
              >
                <option value="">— no se deriva —</option>
                {fuentes.map((f) => (
                  <option key={f.clave} value={f.clave}>{f.etiqueta || f.clave}</option>
                ))}
              </select>
              {fuentes.length === 0 && !automatico && (
                <span className="text-xs text-muted-foreground">
                  Hace falta otro atributo «Select» con opciones para poder derivar.
                </span>
              )}
            </div>

            {derivado && fuente && (
              <div className="mt-2 rounded border border-dashed p-2">
                <p className="mb-1 text-xs text-muted-foreground">
                  Valor resultante por cada opción de «{fuente.etiqueta || fuente.clave}» (vacío = queda vacío)
                </p>
                <div className="grid gap-1">
                  {(fuente.opciones ?? []).map((op) => (
                    <div key={op} className="flex items-center gap-2">
                      <span className="w-44 shrink-0 text-xs">{op}</span>
                      <Input
                        className="h-8"
                        placeholder="valor resultante"
                        value={derivado.mapa?.[op] ?? ''}
                        onChange={(e) =>
                          actualizar(i, {
                            derivado_de: { clave: derivado.clave, mapa: { ...(derivado.mapa ?? {}), [op]: e.target.value } },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fuenteInvalida && (
              <p className="mt-2 text-xs text-destructive">
                El atributo base «{derivado?.clave}» ya no existe o dejó de ser un «Select» con opciones: la
                derivación no se aplicará.{' '}
                <button type="button" className="underline" onClick={() => actualizar(i, { derivado_de: undefined })}>
                  Quitar la derivación
                </button>
              </p>
            )}
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...value, { clave: '', etiqueta: '', tipo: 'text', requerido: false, en_huella: false }])}
      >
        + Agregar atributo
      </Button>
    </div>
  )
}
