import type { jsPDF } from "jspdf"
import type { RowInput } from "jspdf-autotable"

export interface PdfKpi {
  label: string
  value: string
  current?: number
  previous?: number | null
}

export interface PdfChart {
  title: string
  items: Array<{ label: string; value: number }>
}

export interface PdfColumn {
  header: string
  /** Peso relativo dentro de la tabla. */
  width?: number
  align?: "left" | "right"
}

export type PdfTableRow =
  | { kind: "data"; cells: string[] }
  | { kind: "group"; label: string }

export interface PdfTableSection {
  title?: string
  columns: PdfColumn[]
  rows: PdfTableRow[]
  emptyText?: string
}

export interface PdfTruncatedInfo {
  shown: number
  total: number
}

export interface PdfReportOptions {
  filename: string
  kpis?: PdfKpi[]
  chart?: PdfChart
  sections: PdfTableSection[]
  truncated?: PdfTruncatedInfo
}

export type PdfReportContent = Omit<PdfReportOptions, "filename">

const PAGE_MARGIN_X = 10
const CONTENT_TOP = 18
const BOTTOM_MARGIN = 12
const USABLE_WIDTH = 297 - PAGE_MARGIN_X * 2

function cleanText(value: string): string {
  return value
    .replace(/[—–]/g, "-")
    .replace(/[·•]/g, "-")
    .replace(/…/g, "...")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n/g, " ")
    .trim()
}

function formatNumber(value: number): string {
  return value.toLocaleString("es-AR")
}

function formatPercent(value: number): string {
  return `${Math.abs(value).toLocaleString("es-AR", {
    maximumFractionDigits: 1,
  })}%`
}

function variationOf(
  current: number | undefined,
  previous: number | null | undefined,
): { text: string; positive: boolean | null } | null {
  if (current === undefined || previous === undefined || previous === null) {
    return null
  }
  if (previous === 0) {
    if (current === 0) return { text: "Sin cambios", positive: null }
    return { text: `+ nuevo (${formatNumber(current)})`, positive: true }
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(delta * 10) / 10
  if (rounded === 0) return { text: "Sin cambios", positive: null }
  return {
    text: `${rounded > 0 ? "+" : "-"}${formatPercent(rounded)}`,
    positive: rounded > 0,
  }
}

function fitText(doc: jsPDF, value: string, maxWidth: number): string {
  let text = cleanText(value)
  if (doc.getTextWidth(text) <= maxWidth) return text
  while (text.length > 1 && doc.getTextWidth(`${text}...`) > maxWidth) {
    text = text.slice(0, -1)
  }
  return `${text.trimEnd()}...`
}

function pageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth()
}

function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight()
}

function drawHeader(doc: jsPDF, drawnPages: Set<number>): void {
  const currentPage = doc.getCurrentPageInfo().pageNumber
  if (drawnPages.has(currentPage)) return
  drawnPages.add(currentPage)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10.5)
  doc.setTextColor(17, 24, 39)
  doc.text("StockManager", PAGE_MARGIN_X, 11)
  doc.setFont("helvetica", "normal")
}

function drawWatermark(doc: jsPDF): void {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(64)
  doc.setTextColor(232, 236, 245)
  doc.text("StockManager", pageWidth(doc) / 2, pageHeight(doc) / 2 + 18, {
    align: "center",
    angle: 22,
  })
  doc.setTextColor(31, 41, 55)
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  needed: number,
  drawnPages: Set<number>,
): number {
  if (y + needed <= pageHeight(doc) - BOTTOM_MARGIN) return y
  doc.addPage()
  drawHeader(doc, drawnPages)
  return CONTENT_TOP
}

function drawKpis(
  doc: jsPDF,
  kpis: PdfKpi[],
  startY: number,
  drawnPages: Set<number>,
): number {
  const gap = 3
  const cardWidth = (USABLE_WIDTH - gap * (kpis.length - 1)) / kpis.length
  const cardHeight = 23
  let y = ensureSpace(doc, startY, cardHeight, drawnPages)

  kpis.forEach((kpi, index) => {
    const x = PAGE_MARGIN_X + index * (cardWidth + gap)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "FD")

    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.2)
    doc.setTextColor(107, 114, 128)
    doc.text(fitText(doc, kpi.label.toUpperCase(), cardWidth - 6), x + 3, y + 5)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(11.5)
    doc.setTextColor(17, 24, 39)
    doc.text(fitText(doc, kpi.value, cardWidth - 6), x + 3, y + 13)

    const variation = variationOf(kpi.current, kpi.previous)
    if (variation) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(6.4)
      if (variation.positive === true) doc.setTextColor(21, 128, 61)
      else if (variation.positive === false) doc.setTextColor(185, 28, 28)
      else doc.setTextColor(107, 114, 128)
      doc.text(fitText(doc, variation.text, cardWidth - 6), x + 3, y + 18.5)
    }
  })

  doc.setTextColor(31, 41, 55)
  return y + cardHeight + 6
}

function drawChart(
  doc: jsPDF,
  chart: PdfChart,
  startY: number,
  drawnPages: Set<number>,
): number {
  if (chart.items.length === 0) return startY

  const rowHeight = 6.1
  const blockHeight = 10 + chart.items.length * rowHeight
  let y = ensureSpace(doc, startY, blockHeight, drawnPages)
  const maxValue = Math.max(...chart.items.map((item) => item.value), 0)
  if (maxValue <= 0) return y

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(31, 41, 55)
  doc.text(cleanText(chart.title), PAGE_MARGIN_X, y + 4)
  y += 7

  const labelWidth = 66
  const valueWidth = 18
  const barWidth = USABLE_WIDTH - labelWidth - valueWidth - 6

  for (const item of chart.items) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.2)
    doc.setTextColor(55, 65, 81)
    doc.text(fitText(doc, item.label, labelWidth - 2), PAGE_MARGIN_X, y + 3)

    const barX = PAGE_MARGIN_X + labelWidth
    doc.setFillColor(243, 244, 246)
    doc.roundedRect(barX, y, barWidth, 3.8, 0.8, 0.8, "F")

    const width = Math.max(2, (item.value / maxValue) * barWidth)
    doc.setFillColor(59, 130, 246)
    doc.roundedRect(barX, y, width, 3.8, 0.8, 0.8, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(31, 41, 55)
    doc.text(formatNumber(item.value), PAGE_MARGIN_X + USABLE_WIDTH, y + 3, {
      align: "right",
    })
    y += rowHeight
  }

  doc.setTextColor(31, 41, 55)
  return y + 3
}

function drawTruncatedNote(
  doc: jsPDF,
  truncated: PdfTruncatedInfo,
  startY: number,
  drawnPages: Set<number>,
): number {
  const message = `Detalle limitado a ${formatNumber(
    truncated.shown,
  )} filas de ${formatNumber(
    truncated.total,
  )}. El resumen corresponde al período completo; el XLSX conserva el detalle.`
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.4)
  const lines = doc.splitTextToSize(message, USABLE_WIDTH - 6) as string[]
  const height = lines.length * 4 + 4
  const y = ensureSpace(doc, startY, height, drawnPages)

  doc.setFillColor(254, 249, 195)
  doc.setDrawColor(253, 230, 138)
  doc.roundedRect(PAGE_MARGIN_X, y, USABLE_WIDTH, height, 1.2, 1.2, "FD")
  doc.setTextColor(113, 63, 18)
  doc.text(lines, PAGE_MARGIN_X + 3, y + 4.5)
  doc.setTextColor(31, 41, 55)
  return y + height + 4
}

type AutoTableFn = typeof import("jspdf-autotable").default

function drawSection(
  doc: jsPDF,
  section: PdfTableSection,
  startY: number,
  drawnPages: Set<number>,
  autoTable: AutoTableFn,
): number {
  let y = startY

  if (section.rows.length === 0) {
    if (section.title) {
      y = ensureSpace(doc, y, 18, drawnPages)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(31, 41, 55)
      doc.text(cleanText(section.title), PAGE_MARGIN_X, y + 4)
      y += 7
    }

    y = ensureSpace(doc, y, 12, drawnPages)
    const message = section.emptyText ?? "Sin datos para el período seleccionado."
    doc.setFillColor(249, 250, 251)
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(PAGE_MARGIN_X, y, USABLE_WIDTH, 10, 1.2, 1.2, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(75, 85, 99)
    doc.text(cleanText(message), PAGE_MARGIN_X + 3, y + 6)
    return y + 14
  }

  if (section.title) {
    y = ensureSpace(doc, y, 20, drawnPages)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(31, 41, 55)
    doc.text(cleanText(section.title), PAGE_MARGIN_X, y + 4)
    y += 6
  }

  y = ensureSpace(doc, y, 22, drawnPages)

  const totalWeight = section.columns.reduce(
    (sum, column) => sum + (column.width ?? 10),
    0,
  )
  const columnStyles: Record<
    number,
    { cellWidth: number; halign: "left" | "right" }
  > = {}
  section.columns.forEach((column, index) => {
    columnStyles[index] = {
      cellWidth: ((column.width ?? 10) / totalWeight) * USABLE_WIDTH,
      halign: column.align ?? "left",
    }
  })

  const body: RowInput[] = section.rows.map((row) =>
    row.kind === "group"
      ? [
          {
            content: cleanText(row.label),
            colSpan: section.columns.length,
            styles: {
              fillColor: [243, 244, 246],
              textColor: [75, 85, 99],
              fontStyle: "bold",
              fontSize: 6.8,
              halign: "left",
            },
          },
        ]
      : row.cells.map(cleanText),
  )

  autoTable(doc, {
    startY: y,
    head: [section.columns.map((column) => cleanText(column.header))],
    body,
    margin: {
      top: CONTENT_TOP,
      right: PAGE_MARGIN_X,
      bottom: BOTTOM_MARGIN,
      left: PAGE_MARGIN_X,
    },
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: { top: 1.1, right: 1.4, bottom: 1.1, left: 1.4 },
      overflow: "linebreak",
      textColor: [31, 41, 55],
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [55, 65, 81],
      fontStyle: "bold",
      fontSize: 7.2,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawPage: () => drawHeader(doc, drawnPages),
  })

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y
  return finalY + 8
}

/**
 * Genera y descarga el PDF del reporte activo (RF-78).
 *
 * Se construye desde los datos, no desde el DOM, para no depender del diálogo
 * de impresión ni del encabezado del navegador. jsPDF y autotable se cargan
 * con import() dinámico: sólo se descargan al usar el botón de PDF.
 */
export async function exportReportPdf(options: PdfReportOptions): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: false,
  })

  doc.setProperties({
    title: "StockManager",
    subject: "Reporte",
    creator: "StockManager",
  })

  const drawnPages = new Set<number>()
  drawWatermark(doc)
  drawHeader(doc, drawnPages)

  let y = CONTENT_TOP + 3
  if (options.kpis && options.kpis.length > 0) {
    y = drawKpis(doc, options.kpis, y, drawnPages)
  }
  if (options.chart) {
    y = drawChart(doc, options.chart, y, drawnPages)
  }
  if (options.truncated) {
    y = drawTruncatedNote(doc, options.truncated, y, drawnPages)
  }

  for (const section of options.sections) {
    y = drawSection(doc, section, y, drawnPages, autoTable)
  }

  doc.save(options.filename)
}
