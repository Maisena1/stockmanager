import {
  addDaysInputDate,
  monthRangeInputDate,
  todayInputDate,
} from "../lib/reports"

const MONTH_OPTIONS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

const PRESETS = [
  { id: "hoy", label: "Hoy" },
  { id: "ayer", label: "Ayer" },
  { id: "ultimos-7", label: "Últimos 7 días" },
  { id: "ultimos-30", label: "Últimos 30 días" },
  { id: "mes-actual", label: "Mes actual" },
  { id: "mes-anterior", label: "Mes anterior" },
  { id: "anio-actual", label: "Año actual" },
  { id: "personalizado", label: "Personalizado" },
] as const

type PresetId = (typeof PRESETS)[number]["id"]

interface PeriodPickerProps {
  preset: string
  from: string
  to: string
  compare: boolean
  onChange: (value: { preset: string; from: string; to: string }) => void
  onCompareChange: (value: boolean) => void
}

function parseInputDate(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function rangeForPreset(preset: PresetId): { from: string; to: string } | null {
  const today = todayInputDate()
  if (preset === "hoy") return { from: today, to: today }
  if (preset === "ayer") {
    const yesterday = addDaysInputDate(today, -1)
    return { from: yesterday, to: yesterday }
  }
  if (preset === "ultimos-7") return { from: addDaysInputDate(today, -6), to: today }
  if (preset === "ultimos-30") return { from: addDaysInputDate(today, -29), to: today }

  const now = new Date()
  if (preset === "mes-actual") {
    return monthRangeInputDate(now.getFullYear(), now.getMonth() + 1)
  }
  if (preset === "mes-anterior") {
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return monthRangeInputDate(previous.getFullYear(), previous.getMonth() + 1)
  }
  if (preset === "anio-actual") {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
  }
  return null
}

export function PeriodPicker({
  preset,
  from,
  to,
  compare,
  onChange,
  onCompareChange,
}: PeriodPickerProps) {
  const fromDate = parseInputDate(from)
  const selectedYear = fromDate?.getFullYear() ?? new Date().getFullYear()
  const selectedMonth = (fromDate?.getMonth() ?? new Date().getMonth()) + 1

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 7 }, (_, index) => currentYear - 5 + index)
  if (!years.includes(selectedYear)) years.push(selectedYear)
  years.sort((a, b) => a - b)

  const selectedPreset = PRESETS.some((item) => item.id === preset)
    ? preset
    : "personalizado"

  function handlePreset(value: string) {
    const next = rangeForPreset(value as PresetId)
    if (!next) {
      onChange({ preset: value, from, to })
      return
    }
    onChange({ preset: value, ...next })
  }

  function handleMonth(year: number, month: number) {
    const range = monthRangeInputDate(year, month)
    onChange({ preset: "personalizado", ...range })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-3">
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Período
        <select
          value={selectedPreset}
          onChange={(event) => handlePreset(event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Desde
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) =>
            onChange({ preset: "personalizado", from: event.target.value, to })
          }
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Hasta
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) =>
            onChange({ preset: "personalizado", from, to: event.target.value })
          }
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Año
        <select
          value={selectedYear}
          onChange={(event) => handleMonth(Number(event.target.value), selectedMonth)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Mes
        <select
          value={selectedMonth}
          onChange={(event) => handleMonth(selectedYear, Number(event.target.value))}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {MONTH_OPTIONS.map((month, index) => (
            <option key={month} value={index + 1}>
              {month}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={compare}
          onChange={(event) => onCompareChange(event.target.checked)}
        />
        Comparar con período anterior
      </label>
    </div>
  )
}
