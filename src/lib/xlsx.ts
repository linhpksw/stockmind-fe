import { read, utils, writeFileXLSX } from 'xlsx'

export const parseFirstSheet = async (file: File): Promise<Record<string, unknown>[]> => {
  const buffer = await file.arrayBuffer()
  const workbook = read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    return []
  }

  const worksheet = workbook.Sheets[sheetName]
  return utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
}

export const exportRowsToXlsx = (
  rows: Record<string, unknown>[],
  fileName: string,
  sheetName = 'Suppliers',
) => {
  const data = rows.length > 0 ? rows : [{ note: 'No rows available' }]
  const worksheet = utils.json_to_sheet(data)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, sheetName)
  writeFileXLSX(workbook, fileName)
}
