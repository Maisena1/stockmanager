import { useState } from "react"
import { ApiError } from "../lib/api"
import {
  COLUMN_FIELDS,
  DEFAULT_COLUMNS,
  EXISTING_OPTIONS,
  MAX_UPLOAD_MB,
  guessColumns,
  previewImport,
  runImport,
  sheetColumnCount,
  sheetHeaders,
  validateFile,
} from "../lib/importar"
import type {
  ColumnField,
  ExistingPolicy,
  ImportConfig,
  ImportReport,
  SheetPreview,
  SkippedRow,
} from "../lib/importar"

const inputClass = "w-full rounded border border-gray-300 px-3 py-2 text-sm"
const previewRowLimit = 10

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`
}

const INITIAL_CONFIG: ImportConfig = {
  supplier: "",
  motorcycleModel: "",
  percentage: 50,
  useExcelPrice: false,
  includeZeroRows: false,
  omitirFilasSinNombre: true,
  minStock: 0,
  defaultQuantity: 1,
  existing: "skip",
  hasHeader: true,
  columns: { ...DEFAULT_COLUMNS },
}

export default function ImportPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<SheetPreview[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState("")
  const [config, setConfig] = useState<ImportConfig>(INITIAL_CONFIG)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ report: ImportReport; skipped: SkippedRow[] } | null>(null)

  const current = sheets.find((s) => s.name === activeSheet) ?? sheets[0]
  const headers = current ? sheetHeaders(current) : []
  const columnTotal = current ? sheetColumnCount(current) : 0

  function reset() {
    setStep(1)
    setFile(null)
    setSheets([])
    setSelectedSheets([])
    setActiveSheet("")
    setConfig(INITIAL_CONFIG)
    setError(null)
    setResult(null)
  }

  async function handleFile(chosen: File) {
    const invalid = validateFile(chosen)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const preview = await previewImport(chosen)
      if (preview.sheets.length === 0) {
        setError("El archivo no tiene hojas con datos")
        return
      }
      setFile(chosen)
      setSheets(preview.sheets)
      setSelectedSheets(preview.sheets.map((s) => s.name))
      setActiveSheet(preview.sheets[0].name)
      // Si la primera fila es un encabezado, se sugiere el mapeo con esa fila
      setConfig((prev) => ({
        ...prev,
        columns: guessColumns(sheetHeaders(preview.sheets[0])),
      }))
      setStep(2)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo leer el archivo")
    } finally {
      setLoading(false)
    }
  }

  const setColumn = (field: ColumnField, value: number | null) =>
    setConfig((prev) => ({ ...prev, columns: { ...prev.columns, [field]: value } }))

  function toggleSheet(name: string) {
    setSelectedSheets((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    )
  }

  async function handleImport() {
    if (!file) return
    if (selectedSheets.length === 0) {
      setError("Elegí al menos una hoja para importar")
      return
    }
    if (config.supplier.trim() === "") {
      setError("El proveedor es obligatorio")
      return
    }
    if (config.useExcelPrice && config.columns.salePrice === null) {
      setError("Si usás el precio de venta del Excel, mapeá la columna de precio de venta")
      return
    }
    if (config.percentage < 0) {
      setError("El porcentaje de ganancia no puede ser negativo")
      return
    }

    setError(null)
    setLoading(true)
    try {
      const response = await runImport(file, config, selectedSheets)
      setResult({ report: response.report, skipped: response.skipped ?? [] })
      setStep(3)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        const body = err.body as { report?: ImportReport } | null
        if (body?.report) {
          setResult({ report: body.report, skipped: [] })
          setStep(3)
        }
      } else {
        setError("No se pudo importar")
      }
    } finally {
      setLoading(false)
    }
  }

  const steps = ["Elegir archivo", "Configuración", "Resultado"]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Importación Excel</h1>
      <p className="mb-4 text-sm text-gray-600">
        Subí un archivo .xlsx con los artículos. Nada se guarda hasta que confirmes la importación.
      </p>

      <ol className="mb-6 flex gap-2 text-sm">
        {steps.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3
          const active = step === number
          const done = step > number
          return (
            <li
              key={label}
              className={
                active
                  ? "rounded bg-blue-600 px-3 py-1.5 font-medium text-white"
                  : done
                    ? "rounded bg-green-100 px-3 py-1.5 text-green-800"
                    : "rounded bg-gray-100 px-3 py-1.5 text-gray-500"
              }
            >
              {done ? "✓ " : ""}
              {label}
            </li>
          )
        })}
      </ol>

      {error && step !== 3 && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {step === 1 && (
        <div className="max-w-xl rounded bg-white p-6">
          <label
            className="flex cursor-pointer flex-col items-center gap-2 rounded border-2 border-dashed border-gray-300 px-6 py-10 text-center hover:border-blue-400"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const dropped = e.dataTransfer.files[0]
              if (dropped) void handleFile(dropped)
            }}
          >
            <span className="text-sm font-medium">
              {loading ? "Leyendo el archivo..." : "Elegí el archivo .xlsx o arrastralo acá"}
            </span>
            <span className="text-xs text-gray-500">
              Formatos .xlsx, hasta {MAX_UPLOAD_MB} MB
            </span>
            <input
              type="file"
              accept=".xlsx"
              disabled={loading}
              onChange={(e) => {
                const chosen = e.target.files?.[0]
                if (chosen) void handleFile(chosen)
              }}
              className="text-sm"
            />
          </label>
        </div>
      )}

      {step === 2 && file && (
        <div className="flex flex-col gap-4">
          <div className="rounded bg-white p-4 text-sm">
            <strong>{file.name}</strong>
            <span className="ml-2 text-gray-500">
              {formatSize(file.size)}
            </span>
          </div>

          <div className="rounded bg-white p-4">
            <h2 className="mb-2 font-semibold">Hojas a importar</h2>
            <div className="flex flex-wrap gap-3">
              {sheets.map((sheet) => (
                <label key={sheet.name} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSheets.includes(sheet.name)}
                    onChange={() => toggleSheet(sheet.name)}
                  />
                  {sheet.name}
                </label>
              ))}
            </div>
          </div>

          {sheets.length > 1 && selectedSheets.length < sheets.length && (
            <p className="rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Solo se importarán las hojas seleccionadas.
            </p>
          )}

          <div className="rounded bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Mapeo de columnas</h2>
              {sheets.length > 1 && (
                <select
                  value={activeSheet}
                  onChange={(e) => setActiveSheet(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  {sheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="mb-3 text-xs text-gray-500">
              Solo el nombre es obligatorio. Lo que dejes en “No usar” se ignora.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {COLUMN_FIELDS.map(({ field, label, required }) => (
                <label key={field} className="text-sm">
                  {label} {required ? "*" : ""}
                  <select
                    value={config.columns[field] === null ? "" : String(config.columns[field])}
                    onChange={(e) =>
                      setColumn(field, e.target.value === "" ? null : Number(e.target.value))
                    }
                    className={inputClass}
                  >
                    {!required && <option value="">No usar</option>}
                    {Array.from({ length: columnTotal }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {headers[i] ?? `Columna ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded bg-white p-4">
            <h2 className="mb-3 font-semibold">Datos de la importación</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Proveedor *
                <input
                  value={config.supplier}
                  onChange={(e) => setConfig((p) => ({ ...p, supplier: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="text-sm">
                Modelo de moto
                <input
                  value={config.motorcycleModel}
                  onChange={(e) => setConfig((p) => ({ ...p, motorcycleModel: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="text-sm">
                % ganancia
                <input
                  value={config.percentage}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, percentage: Number(e.target.value) || 0 }))
                  }
                  inputMode="decimal"
                  className={inputClass}
                />
              </label>
              <label className="text-sm">
                Stock mínimo
                <input
                  value={config.minStock}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, minStock: Number(e.target.value) || 0 }))
                  }
                  inputMode="decimal"
                  className={inputClass}
                />
              </label>
              <label className="text-sm">
                Cantidad si viene vacía
                <input
                  value={config.defaultQuantity}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, defaultQuantity: Number(e.target.value) || 0 }))
                  }
                  inputMode="decimal"
                  className={inputClass}
                />
              </label>
              <label className="text-sm">
                Si el artículo ya existe
                <select
                  value={config.existing}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, existing: e.target.value as ExistingPolicy }))
                  }
                  className={inputClass}
                >
                  {EXISTING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.hasHeader}
                  onChange={(e) => setConfig((p) => ({ ...p, hasHeader: e.target.checked }))}
                />
                La primera fila es un encabezado
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.useExcelPrice}
                  onChange={(e) => setConfig((p) => ({ ...p, useExcelPrice: e.target.checked }))}
                />
                Usar el precio de venta del Excel
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.includeZeroRows}
                  onChange={(e) => setConfig((p) => ({ ...p, includeZeroRows: e.target.checked }))}
                />
                Importar artículos con stock 0
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.omitirFilasSinNombre}
                  onChange={(e) => setConfig((p) => ({ ...p, omitirFilasSinNombre: e.target.checked }))}
                />
                Omitir filas sin nombre (si no, se cancela toda la importación)
              </label>
            </div>
          </div>

          {current && columnTotal > 0 && (
            <div className="rounded bg-white p-4">
              <h2 className="mb-2 font-semibold">
                Vista previa de {current.name} (primeras {previewRowLimit} filas)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b">
                    <tr>
                      {headers.map((header, i) => (
                        <th key={i} className="px-2 py-1 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(config.hasHeader ? current.rows.slice(1) : current.rows)
                      .slice(0, previewRowLimit)
                      .map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b">
                          {headers.map((_, cellIndex) => (
                            <td key={cellIndex} className="px-2 py-1">
                              {String((row as unknown[])?.[cellIndex] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={loading}
              className="rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              Cambiar archivo
            </button>
            <button
              onClick={() => void handleImport()}
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "Importando..." : "Importar artículos"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="flex max-w-3xl flex-col gap-4">
          {error && (
            <div className="rounded bg-red-50 p-4">
              <p className="font-medium text-red-800">{error}</p>
              <p className="mt-1 text-sm text-red-700">
                No se importó ningún artículo: la operación es completa o nada.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Creados", value: result.report.created, tone: "text-green-700" },
              { label: "Actualizados", value: result.report.updated, tone: "text-blue-700" },
              { label: "Omitidos", value: result.report.skipped, tone: "text-gray-700" },
            ].map((stat) => (
              <div key={stat.label} className="rounded bg-white p-4 text-center">
                <p className={`text-3xl font-bold ${stat.tone}`}>{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>

          {result.skipped.length > 0 && (
            <div className="rounded bg-white p-4">
              <h2 className="mb-2 font-semibold">Filas omitidas</h2>
              <ul className="max-h-48 overflow-y-auto text-sm">
                {result.skipped.map((row, i) => (
                  <li key={i} className="border-b py-1">
                    {row.sheet} fila {row.row}: {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.report.errors.length > 0 && (
            <div className="rounded bg-white p-4">
              <h2 className="mb-2 font-semibold">
                Errores por fila ({result.report.errors.length})
              </h2>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="px-2 py-1 font-medium">Hoja</th>
                      <th className="px-2 py-1 font-medium">Fila</th>
                      <th className="px-2 py-1 font-medium">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.report.errors.map((row, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1">{row.sheet}</td>
                        <td className="px-2 py-1">{row.row}</td>
                        <td className="px-2 py-1">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
            >
              Importar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
