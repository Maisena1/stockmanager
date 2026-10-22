import type { CellObject } from "xlsx"

export type ExportCellFormat = "text" | "money" | "integer" | "percent" | "date"

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | Date | null | undefined
  format?: ExportCellFormat
  width?: number
}

interface ExportReportOptions<T> {
  title: string
  sheetName: string
  periodLabel: string
  filters: string[]
  columns: Array<ExportColumn<T>>
  rows: T[]
  filename: string
}

function formatForCell(cell: CellObject, format: ExportCellFormat | undefined) {
  if (format === "money") cell.z = '"$"#,##0.00'
  if (format === "integer") cell.z = "#,##0"
  if (format === "percent") cell.z = '0.0"%"'
  if (format === "date") cell.z = "dd/mm/yyyy"
}

function safeSheetName(value: string): string {
  return value.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Reporte"
}

/**
 * Genera el XLSX en el cliente (RF-78). La primera parte de la hoja lleva el
 * título y los filtros aplicados, y debajo va la tabla con formato real de
 * moneda, fecha y porcentaje (no texto plano).
 *
 * `xlsx` se carga con import() dinámico para que no engorde el bundle inicial.
 */
export async function exportReportXlsx<T>(
  options: ExportReportOptions<T>,
): Promise<void> {
  const XLSX = await import("xlsx")
  const headerRows: Array<Array<string | number | Date>> = [
    [options.title],
    ["Período", options.periodLabel],
    ...options.filters.map((filter) => ["Filtro", filter] as Array<string | number | Date>),
    [],
  ]

  const columnHeaders = options.columns.map((column) => column.header)
  const dataRows = options.rows.map((row) =>
    options.columns.map((column) => {
      const value = column.value(row)
      return value === undefined || value === null ? "" : value
    }),
  )

  const sheet = XLSX.utils.aoa_to_sheet(
    [...headerRows, columnHeaders, ...dataRows],
    { cellDates: true },
  )

  const dataStart = headerRows.length + 1
  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < options.columns.length; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({
        r: dataStart + rowIndex,
        c: columnIndex,
      })
      const cell = sheet[address] as CellObject | undefined
      if (!cell) continue
      formatForCell(cell, options.columns[columnIndex].format)
    }
  }

  sheet["!cols"] = options.columns.map((column) => ({
    wch: column.width ?? Math.max(12, column.header.length + 2),
  }))
  sheet["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: Math.max(0, options.columns.length - 1) },
    },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(options.sheetName))
  XLSX.writeFile(workbook, options.filename, { compression: true })
}
