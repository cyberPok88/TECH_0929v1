'use client'

// CatalogoMiniCrud.tsx — mini-CRUD reutilizable del hub (Guía 1.0)
// Extraído del patrón de Impuestos (P3): configuración → listado + crear/editar/desactivar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Power } from 'lucide-react'

import { DataTable, ConfirmDialog, crearColumnaAcciones, TableSkeleton, useSeleccionTabla } from '@/components/data-table'
import type { ColumnDefExtension } from '@/types/table'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import type { CatalogoCampo, CatalogoConfig, SolicitudNueva } from './catalogos-config'
import { exportarCsvCatalogo } from './exportar-csv'
import { leerCache, guardarCache } from './cache-catalogos'

type Fila = Record<string, unknown> & { id: string }
type Columna = ColumnDef<Fila> & ColumnDefExtension<Fila>

interface ModalState { abierto: boolean; modo: 'crear' | 'editar'; registro?: Fila }
interface ToggleState { id: string; activo: boolean }

interface Props {
  config: CatalogoConfig
  /** Pestaña visible (para exportar solo el tab activo). */
  activo?: boolean
  /** Orden de la Toolbar "Nuevo" dirigida a esta pestaña. */
  solicitudNuevo?: SolicitudNueva
  /** Contador de la Toolbar "Exportar CSV" (solo actúa si `activo`). */
  señalExportar?: number
}

export function CatalogoMiniCrud({ config, activo = false, solicitudNuevo, señalExportar = 0 }: Props) {
  // Caché de sesión: si ya cargamos este catálogo, lo mostramos al instante.
  const [filas, setFilas] = useState<Fila[]>(() => (leerCache(config.clave) as Fila[]) ?? [])
  const [estado, setEstado] = useState<'idle' | 'loading' | 'error'>(
    () => (leerCache(config.clave) ? 'idle' : 'loading'),
  )
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<ModalState>({ abierto: false, modo: 'crear' })
  const [toggle, setToggle] = useState<ToggleState | null>(null)

  const exportUltima = useRef(0)
  const nuevoUltima = useRef(0)

  // Recarga forzada (retry / tras escribir): ignora la caché y refresca en red.
  const cargar = useCallback(async () => {
    setEstado('loading')
    try {
      const res = await config.listar()
      if (res?.success) {
        guardarCache(config.clave, res.data as Fila[])
        setFilas(res.data as Fila[])
        setEstado('idle')
      } else {
        setEstado('error')
      }
    } catch {
      setEstado('error')
    }
  }, [config])

  useEffect(() => {
    // Si ya está en caché de sesión, no consultamos la red al montar.
    if (leerCache(config.clave)) return
    let activo = true
    const inicial = async () => {
      try {
        const res = await config.listar()
        if (!activo) return
        if (res?.success) {
          guardarCache(config.clave, res.data as Fila[])
          setFilas(res.data as Fila[])
          setEstado('idle')
        } else {
          setEstado('error')
        }
      } catch {
        if (activo) setEstado('error')
      }
    }
    void inicial()
    return () => { activo = false }
  }, [config])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((f) =>
      config.buscarEn.some((k) => {
        const v = f[k]
        return typeof v === 'string' && v.toLowerCase().includes(q)
      }),
    )
  }, [filas, busqueda, config])

  const alExito = useCallback(() => {
    setModal((m) => ({ ...m, abierto: false }))
    void cargar()
  }, [cargar])

  const { seleccion, onSeleccionChange } = useSeleccionTabla(visibles, (f) => f.id)

  // Exportar CSV del listado visible (solo del tab activo, una vez por señal)
  const visiblesRef = useRef(visibles)
  useEffect(() => { visiblesRef.current = visibles }, [visibles])
  useEffect(() => {
    if (!activo || señalExportar <= 0 || señalExportar === exportUltima.current) return
    exportUltima.current = señalExportar
    exportarCsvCatalogo(
      visiblesRef.current as Record<string, unknown>[],
      config.columnas.map((c) => ({ key: c.key, etiqueta: c.label })),
      config.clave,
    )
  }, [señalExportar, activo, config])

  // Toolbar "Nuevo" → abrir el modal de crear de ESTA pestaña (una vez por orden)
  useEffect(() => {
    if (!solicitudNuevo || solicitudNuevo.tab !== config.clave) return
    if (solicitudNuevo.seq === nuevoUltima.current) return
    nuevoUltima.current = solicitudNuevo.seq
    setModal({ abierto: true, modo: 'crear' })
  }, [solicitudNuevo, config])

  const ejecutarToggle = useCallback(async () => {
    if (!toggle) return { error: null as string | null }
    const res = await config.acciones.toggle?.(toggle.id, !toggle.activo)
    if (!res?.success) return { error: res?.error ?? 'No se pudo cambiar el estado' }
    setToggle(null)
    void cargar()
    return { error: null as string | null }
  }, [toggle, config, cargar])

  const columnas = useMemo<Columna[]>(() => {
    const accionesCol = crearColumnaAcciones<Fila>({
      acciones: [
        {
          icon: Pencil,
          label: 'Editar',
          onClick: (fila) => setModal({ abierto: true, modo: 'editar', registro: fila }),
        },
        {
          icon: Power,
          label: 'Cambiar estado',
          onClick: (fila) => setToggle({ id: fila.id, activo: Boolean(fila[config.campoActivo]) }),
        },
      ],
    })
    const base: Columna[] = config.columnas.map((c) => ({
      accessorKey: c.key,
      header: c.label,
      label: c.label,
      align: c.align === 'derecha' ? 'derecha' : c.align === 'centro' ? 'centro' : undefined,
      render: c.render ? (v: unknown) => c.render!(v) : undefined,
    }))
    return [...base, accionesCol]
  }, [config])

  if (estado === 'loading' && filas.length === 0) return <TableSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          className="h-9 max-w-xs"
          placeholder={`Buscar ${config.tituloSingular}`}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Button onClick={() => setModal({ abierto: true, modo: 'crear' })}>
          <Plus className="size-4" /> Nuevo {config.tituloSingular}
        </Button>
      </div>

      <DataTable
        columns={columnas}
        data={visibles}
        rowKey={(f) => f.id}
        estado={estado}
        emptyMessage={`Sin ${config.tituloPlural}`}
        onRetry={cargar}
        enableRowSelection
        rowSelection={seleccion}
        onRowSelectionChange={onSeleccionChange}
      />

      {modal.abierto && (
        <CatalogoModal
          key={`${modal.modo}-${modal.registro?.id ?? 'nuevo'}`}
          config={config}
          estado={modal}
          onClose={() => setModal((m) => ({ ...m, abierto: false }))}
          onExito={alExito}
        />
      )}

      <ConfirmDialog
        open={toggle !== null}
        onOpenChange={(v) => { if (!v) setToggle(null) }}
        titulo={toggle?.activo ? 'Desactivar' : 'Activar'}
        descripcion={`¿Confirmas el cambio de estado de este ${config.tituloSingular}?`}
        onConfirm={ejecutarToggle}
      />
    </div>
  )
}

interface CatalogoModalProps {
  config: CatalogoConfig
  estado: ModalState
  onClose: () => void
  onExito: () => void
}

function CatalogoModal({ config, estado, onClose, onExito }: CatalogoModalProps) {
  const registro = estado.registro
  const inicial = useMemo<Record<string, unknown>>(() => {
    if (estado.modo === 'editar' && registro) return config.formDesdeRegistro(registro)
    const base: Record<string, unknown> = {}
    for (const campo of config.campos) base[campo.name] = campo.tipo === 'switch' ? true : ''
    return base
  }, [config, estado.modo, registro])

  const [valores, setValores] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const setValor = (name: string, value: unknown) => setValores((v) => ({ ...v, [name]: value }))

  const guardar = async () => {
    setError(null)
    for (const campo of config.campos) {
      if (campo.soloCrear && estado.modo !== 'crear') continue
      const val = valores[campo.name]
      if (campo.tipo !== 'switch' && (val === '' || val === undefined || val === null)) {
        setError(`El campo «${campo.label}» es obligatorio`)
        return
      }
    }
    const payload: Record<string, unknown> = {}
    for (const campo of config.campos) {
      if (campo.soloCrear && estado.modo !== 'crear') continue
      const raw = valores[campo.name]
      payload[campo.name] = campo.tipo === 'number' ? Number(raw) : campo.tipo === 'text' ? String(raw).trim() : raw
    }
    setOcupado(true)
    const res = estado.modo === 'crear'
      ? await config.acciones.crear?.(payload)
      : await config.acciones.editar?.(registro!.id, payload)
    setOcupado(false)
    if (!res?.success) { setError(res?.error ?? 'Error al guardar'); return }
    toast.success(estado.modo === 'crear' ? 'Registro creado' : 'Registro actualizado')
    onExito()
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {estado.modo === 'crear' ? `Nuevo ${config.tituloSingular}` : `Editar ${config.tituloSingular}`}
          </DialogTitle>
          <DialogDescription>Captura los datos del {config.tituloSingular}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {config.campos.map((campo) => (
            <CampoControl
              key={campo.name}
              campo={campo}
              value={valores[campo.name]}
              deshabilitado={ocupado || (campo.soloCrear === true && estado.modo === 'editar')}
              onChange={(v) => setValor(campo.name, v)}
            />
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={ocupado}>Cancelar</Button>
          <Button onClick={guardar} disabled={ocupado}>
            {estado.modo === 'crear' ? 'Crear' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CampoControlProps {
  campo: CatalogoCampo
  value: unknown
  deshabilitado: boolean
  onChange: (value: unknown) => void
}

function CampoControl({ campo, value, deshabilitado, onChange }: CampoControlProps) {
  if (campo.tipo === 'switch') {
    return (
      <label className="flex items-center justify-between rounded border p-3 text-sm">
        {campo.label}
        <Switch checked={Boolean(value)} onCheckedChange={onChange} disabled={deshabilitado} />
      </label>
    )
  }
  if (campo.tipo === 'select') {
    return (
      <div className="grid gap-1.5">
        <Label>{campo.label}</Label>
        <Select value={String(value ?? '')} onValueChange={onChange} disabled={deshabilitado}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(campo.opciones ?? []).map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    )
  }
  return (
    <div className="grid gap-1.5">
      <Label>{campo.label}</Label>
      <Input
        type={campo.tipo === 'number' ? 'number' : 'text'}
        value={String(value ?? '')}
        placeholder={campo.placeholder}
        disabled={deshabilitado}
        onChange={(e) => onChange(campo.tipo === 'number' ? e.target.value : e.target.value)}
      />
    </div>
  )
}
