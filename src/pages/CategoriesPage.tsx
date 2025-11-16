import DownloadIcon from '@mui/icons-material/Download'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangeEvent } from 'react'
import { Fragment, useMemo, useRef, useState } from 'react'
import { fetchCategories, importCategories } from '../api/categories'
import { SectionHeading } from '../components/common/SectionHeading'
import { exportRowsToXlsx, parseFirstSheet } from '../lib/xlsx'
import type { CategoryImportRow, CategoryNode } from '../types/categories'

export const CategoriesPage = () => {
  const EXCLUDED_NAMES = useMemo(
    () => new Set(['giá siêu rẻ', 'giá hội viên', 'ưu đãi hội viên']),
    [],
  )

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()
  const [expandedParents, setExpandedParents] = useState<Record<number, boolean>>({})
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: fetchCategories,
  })

  const importMutation = useMutation({
    mutationFn: importCategories,
    onSuccess: async result => {
      await queryClient.invalidateQueries({ queryKey: ['categories-tree'] })
      setFeedback({
        type: 'success',
        message: `Import complete: ${result.created} created, ${result.updated} updated. ${
          result.skippedInvalid + result.skippedMissingParent
        } skipped.`,
      })
    },
    onError: error => {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to import categories right now.',
      })
    },
  })

  const sortedTree = useMemo(() => {
    const sortNodes = (nodes: CategoryNode[]): CategoryNode[] =>
      [...nodes]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map(node => ({
          ...node,
          children: sortNodes(node.children ?? []),
        }))

    const pruneNodes = (nodes: CategoryNode[]): CategoryNode[] =>
      nodes
        .filter(node => !EXCLUDED_NAMES.has(node.name.toLocaleLowerCase('vi-VN')))
        .map(node => ({
          ...node,
          children: pruneNodes(node.children ?? []),
        }))

    return sortNodes(pruneNodes(categoriesQuery.data ?? []))
  }, [EXCLUDED_NAMES, categoriesQuery.data])

  const parentRows = useMemo(
    () => sortedTree.map((node, index) => ({ node, number: index + 1 })),
    [sortedTree],
  )

  const toggleParent = (categoryId: number) => {
    setExpandedParents(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  const handleExport = () => {
    if (!sortedTree.length) {
      setFeedback({
        type: 'error',
        message: 'No categories available to export just yet.',
      })
      return
    }

    const rows: Record<string, unknown>[] = []
    const flatten = (nodes: CategoryNode[], parent?: CategoryNode) => {
      nodes.forEach(node => {
        rows.push({
          category_id: node.categoryId,
          code: node.code,
          name: node.name,
          parent_category_id: node.parentCategoryId ?? '',
          parent_code: parent?.code ?? '',
        })
        if (node.children?.length) {
          flatten(node.children, node)
        }
      })
    }

    flatten(sortedTree)
    const today = new Date().toISOString().split('T')[0]
    exportRowsToXlsx(rows, `categories-${today}.xlsx`, 'Categories')
    setFeedback({
      type: 'success',
      message: `Exported ${rows.length} row${rows.length === 1 ? '' : 's'} to Excel.`,
    })
  }

  const normalizeString = (value: unknown) => (value == null ? '' : String(value).trim())
  const parseNumeric = (value: unknown) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : undefined
  }

  const buildPayload = (rawRows: Record<string, unknown>[]): CategoryImportRow[] => {
    type NormalizedRow = {
      code: string
      name: string
      categoryId?: number
      parentCategoryId?: number
      parentCode?: string
    }

    const normalizedRows: NormalizedRow[] = []

    rawRows.forEach(row => {
      const code =
        normalizeString(
          row['code'] ?? row['Code'] ?? row['CODE'] ?? row['category_code'] ?? row['Category Code'],
        ) ?? ''
      const name =
        normalizeString(
          row['name'] ?? row['Name'] ?? row['NAME'] ?? row['category_name'] ?? row['Category Name'],
        ) ?? ''
      if (!code || !name) {
        return
      }

      const categoryId =
        parseNumeric(
          row['category_id'] ??
            row['Category Id'] ??
            row['CATEGORY_ID'] ??
            row['categoryId'] ??
            row['CategoryID'],
        ) ?? undefined

      const rawParentId =
        parseNumeric(
          row['parent_category_id'] ??
            row['Parent Category Id'] ??
            row['parent_category'] ??
            row['ParentCategoryId'],
        ) ?? undefined
      const parentCategoryId = rawParentId && rawParentId > 0 ? rawParentId : undefined

      const parentCode = normalizeString(
        row['parent_code'] ?? row['Parent Code'] ?? row['PARENT_CODE'],
      )

      normalizedRows.push({
        code,
        name,
        categoryId: categoryId && categoryId > 0 ? categoryId : undefined,
        parentCategoryId,
        parentCode: parentCode || undefined,
      })
    })

    if (normalizedRows.length === 0) {
      return []
    }

    const codeByCategoryId = new Map<number, string>()
    normalizedRows.forEach(row => {
      if (row.categoryId) {
        codeByCategoryId.set(row.categoryId, row.code)
      }
    })

    return normalizedRows.map(row => {
      const inferredParentCode =
        row.parentCode ??
        (row.parentCategoryId ? codeByCategoryId.get(row.parentCategoryId) : undefined)

      return {
        categoryId: row.categoryId,
        code: row.code,
        name: row.name,
        parentCode: inferredParentCode,
        parentCategoryId: row.parentCategoryId,
      }
    })
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setFeedback(null)

    try {
      const rawRows = await parseFirstSheet(file)
      const payload = buildPayload(rawRows)
      if (payload.length === 0) {
        setFeedback({
          type: 'error',
          message: 'No valid rows detected. Ensure the file contains code and name columns.',
        })
        return
      }
      await importMutation.mutateAsync({ rows: payload })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Something went wrong while reading the file.',
      })
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const renderChildList = (nodes: CategoryNode[], depth = 1) =>
    nodes.map(child => (
      <Box key={child.categoryId} sx={{ pl: depth * 2, py: 0.75 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography fontWeight={600}>{child.name}</Typography>
          <Chip label={child.code} size="small" variant="outlined" />
        </Stack>
        {child.children.length > 0 && <Box>{renderChildList(child.children, depth + 1)}</Box>}
      </Box>
    ))

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Category hierarchy"
        subtitle="Manage parent/child groupings for your assortment in one place."
        action={
          <Stack spacing={1} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-end">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                disabled={sortedTree.length === 0}
              >
                Export (.xlsx)
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? 'Importing…' : 'Import (.xlsx)'}
              </Button>
            </Stack>
          </Stack>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".xlsx,.xls"
        onChange={handleImportFileChange}
      />

      {feedback && (
        <Alert severity={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TableContainer sx={{ flex: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="64px">No.</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Code</TableCell>
                <TableCell align="right">Children</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categoriesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : parentRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Box py={4} textAlign="center">
                      <Typography variant="h6">No categories yet</Typography>
                      <Typography color="text.secondary">
                        Import a spreadsheet or create categories via the API to get started.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                parentRows.map(row => {
                  const hasChildren = row.node.children.length > 0
                  const isExpanded = !!expandedParents[row.node.categoryId]

                  return (
                    <Fragment key={`${row.node.categoryId}-${row.number}`}>
                      <TableRow hover>
                        <TableCell>{row.number}</TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            {hasChildren ? (
                              <IconButton
                                size="small"
                                onClick={() => toggleParent(row.node.categoryId)}
                              >
                                {isExpanded ? (
                                  <KeyboardArrowDown fontSize="small" />
                                ) : (
                                  <KeyboardArrowRight fontSize="small" />
                                )}
                              </IconButton>
                            ) : (
                              <Box width={32} />
                            )}
                            <Box>
                              <Typography fontWeight={600}>{row.node.name}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip label={row.node.code} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          {hasChildren ? (
                            <Button
                              size="small"
                              onClick={() => toggleParent(row.node.categoryId)}
                              endIcon={
                                isExpanded ? (
                                  <KeyboardArrowDown fontSize="small" />
                                ) : (
                                  <KeyboardArrowRight fontSize="small" />
                                )
                              }
                            >
                              {isExpanded ? 'Hide list' : 'Show list'}
                            </Button>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                      {hasChildren && (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ py: 0 }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box px={6} py={2} bgcolor="background.default" borderRadius={1}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Child categories
                                </Typography>
                                {renderChildList(row.node.children)}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  )
}

export default CategoriesPage
