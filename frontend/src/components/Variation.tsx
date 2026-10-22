interface VariationProps {
  current: number
  previous?: number | null
}

function formatPercent(value: number): string {
  const abs = Math.abs(value)
  return `${abs.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`
}

export function Variation({ current, previous }: VariationProps) {
  if (previous === undefined || previous === null) {
    return null
  }

  if (previous === 0) {
    if (current === 0) {
      return <span className="text-xs text-gray-500">Sin cambios</span>
    }
    return (
      <span className="text-xs font-medium text-green-700">
        ↑ nuevo ({current.toLocaleString("es-AR")})
      </span>
    )
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(delta * 10) / 10

  if (rounded === 0) {
    return <span className="text-xs text-gray-500">Sin cambios</span>
  }

  const positive = rounded > 0
  return (
    <span
      className={`text-xs font-medium ${positive ? "text-green-700" : "text-red-700"}`}
      title={`Anterior: ${previous.toLocaleString("es-AR")}`}
    >
      {positive ? "↑" : "↓"} {formatPercent(rounded)}
    </span>
  )
}
