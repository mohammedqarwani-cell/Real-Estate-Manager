import * as XLSX from 'xlsx'

export function exportToExcel(
  rows: Record<string, string | number | null | undefined>[],
  filename: string,
  sheetName = 'البيانات'
) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  if (rows.length > 0) {
    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }))
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
