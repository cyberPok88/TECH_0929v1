'use client'

// EsquemaAtributosEditor.tsx — editor del JSONB esquema_atributos (Guía 1.0 · P6)
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
      {value.map((at, i) => (
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
                actualizar(i, { tipo, opciones: tipo === 'select' ? at.opciones ?? [] : undefined })
              }}
            >
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="select">Select</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              Requerido
              <Switch checked={at.requerido} onCheckedChange={(r) => actualizar(i, { requerido: r })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              Identidad (huella)
              <Switch checked={at.en_huella ?? false} onCheckedChange={(r) => actualizar(i, { en_huella: r })} />
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
              Quitar
            </Button>
          </div>
          {at.tipo === 'select' && (
            <Input
              className="mt-2"
              placeholder="Opciones separadas por comas"
              value={(at.opciones ?? []).join(', ')}
              onChange={(e) => actualizar(i, { opciones: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          )}
        </div>
      ))}
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
