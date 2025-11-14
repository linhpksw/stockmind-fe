import DownloadIcon from '@mui/icons-material/Download'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { listMarginProfiles, importMarginProfiles, updateMarginProfile } from '../api/margins'
import { SectionHeading } from '../components/common/SectionHeading'
import { exportRowsToXlsx, parseFirstSheet } from '../lib/xlsx'
import type {
  MarginProfile,
  MarginProfileImportRow,
  UpdateMarginProfileRequest,
} from '../types/margins'

const PRICE_SENSITIVITY_COLORS: Record<
  string,
  'error' | 'warning' | 'success' | 'info' | 'default'
> = {
  high: 'error',
  medium: 'warning',
  low: 'success',
}

const getPriceSensitivityColor = (
  value: string,
): 'error' | 'warning' | 'success' | 'info' | 'default' => {
  const normalized = value.trim().toLowerCase()
  if (normalized.includes('high')) {
    return PRICE_SENSITIVITY_COLORS.high
  }
  if (normalized.includes('medium')) {
    return PRICE_SENSITIVITY_COLORS.medium
  }
  if (normalized.includes('low')) {
    return PRICE_SENSITIVITY_COLORS.low
  }
  return 'info'
}

const marginProfileColor = (value: string) => {
  const palette = ['#1e88e5', '#7b1fa2', '#00897b', '#f4511e', '#6d4c41']
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return '#546e7a'
  }
  const hash = normalized.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const MarginsPage = () => {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MarginProfile | null>(null)
  const [editForm, setEditForm] = useState<UpdateMarginProfileRequest>({
    minMarginPct: 0,
    targetMarginPct: 0,
    maxMarginPct: 0,
  })
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()

  const marginProfilesQuery = useQuery({
    queryKey: ['margin-profiles'],
    queryFn: listMarginProfiles,
  })

  const profiles = useMemo<MarginProfile[]>(
    () => marginProfilesQuery.data ?? [],
    [marginProfilesQuery.data],
  )
  const totalProfiles = profiles.length
  const paginatedProfiles = useMemo(() => {
    const start = page * rowsPerPage
    return profiles.slice(start, start + rowsPerPage)
  }, [profiles, page, rowsPerPage])

  useEffect(() => {
    if (page * rowsPerPage >= Math.max(totalProfiles, 1) && page !== 0) {
      setPage(0)
    }
  }, [page, rowsPerPage, totalProfiles])

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateMarginProfileRequest }) =>
      updateMarginProfile(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['margin-profiles'] })
      setDialogOpen(false)
      setEditTarget(null)
    },
  })

  const openEditDialog = (profile: MarginProfile) => {
    setEditTarget(profile)
    setEditForm({
      minMarginPct: profile.minMarginPct,
      targetMarginPct: profile.targetMarginPct,
      maxMarginPct: profile.maxMarginPct,
    })
    setDialogOpen(true)
  }

  const handleEditChange =
    (field: keyof UpdateMarginProfileRequest) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value)
      setEditForm(prev => ({ ...prev, [field]: Number.isFinite(value) ? value : prev[field] }))
    }

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editTarget) {
      return
    }
    updateMutation.mutate({ id: editTarget.id, payload: editForm })
  }

  const resetImportInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleExport = () => {
    if (profiles.length === 0) {
      setImportFeedback({ type: 'error', message: 'No margin profiles to export yet.' })
      return
    }
    const rows = profiles.map(profile => ({
      parent_category_id: profile.parentCategoryId,
      parent_category_name: profile.parentCategoryName,
      margin_profile: profile.marginProfile,
      price_sensitivity: profile.priceSensitivity,
      min_margin_pct: profile.minMarginPct,
      target_margin_pct: profile.targetMarginPct,
      max_margin_pct: profile.maxMarginPct,
      notes: profile.notes ?? '',
    }))
    const today = new Date().toISOString().split('T')[0]
    exportRowsToXlsx(rows, `margin-profiles-${today}.xlsx`, 'MarginProfiles')
    setImportFeedback({
      type: 'success',
      message: `Exported ${rows.length} margin profile${rows.length === 1 ? '' : 's'} to Excel.`,
    })
  }

  const importMutation = useMutation({
    mutationFn: (rows: MarginProfileImportRow[]) => importMarginProfiles(rows),
    onSuccess: async result => {
      await queryClient.invalidateQueries({ queryKey: ['margin-profiles'] })
      const messages: string[] = []
      if (result.created > 0) {
        messages.push(`Created ${result.created} row${result.created === 1 ? '' : 's'}.`)
      }
      if (result.updated > 0) {
        messages.push(`Updated ${result.updated} row${result.updated === 1 ? '' : 's'}.`)
      }
      if (result.skippedInvalid > 0 || result.skippedMissingCategory > 0) {
        messages.push(
          `${result.skippedInvalid + result.skippedMissingCategory} row${
            result.skippedInvalid + result.skippedMissingCategory === 1 ? '' : 's'
          } skipped.`,
        )
      }
      setImportFeedback({
        type: result.skippedInvalid + result.skippedMissingCategory > 0 ? 'error' : 'success',
        message: messages.join(' ') || 'Import completed.',
      })
    },
    onError: error => {
      setImportFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import margin profiles.',
      })
    },
  })

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const sheetRows = await parseFirstSheet(file)
      if (sheetRows.length === 0) {
        throw new Error('No rows detected in the spreadsheet.')
      }

      const normalizeString = (value: unknown): string => {
        if (value == null) {
          return ''
        }
        return String(value).trim()
      }
      const parseNumber = (value: unknown): number | undefined => {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : undefined
      }

      const importRows: MarginProfileImportRow[] = []
      sheetRows.forEach(row => {
        const parentCategoryId = parseNumber(
          row['parent_category_id'] ?? row['Parent Category Id'] ?? row['parentCategoryId'],
        )
        const parentCategoryName = normalizeString(
          row['parent_category_name'] ?? row['Parent Category Name'] ?? row['parentCategoryName'],
        )
        const marginProfile = normalizeString(row['margin_profile'] ?? row['Margin Profile'])
        const priceSensitivity = normalizeString(
          row['price_sensitivity'] ?? row['Price Sensitivity'] ?? row['priceSensitivity'],
        )
        const minMarginPct = parseNumber(
          row['min_margin_pct'] ?? row['Min Margin Pct'] ?? row['minMarginPct'],
        )
        const targetMarginPct = parseNumber(
          row['target_margin_pct'] ?? row['Target Margin Pct'] ?? row['targetMarginPct'],
        )
        const maxMarginPct = parseNumber(
          row['max_margin_pct'] ?? row['Max Margin Pct'] ?? row['maxMarginPct'],
        )
        const notes = normalizeString(row['notes'] ?? row['Notes'])

        if (
          !marginProfile ||
          !priceSensitivity ||
          minMarginPct == null ||
          targetMarginPct == null ||
          maxMarginPct == null
        ) {
          return
        }

        importRows.push({
          parentCategoryId:
            parentCategoryId && parentCategoryId > 0 ? Math.trunc(parentCategoryId) : undefined,
          parentCategoryName: parentCategoryName || undefined,
          marginProfile,
          priceSensitivity,
          minMarginPct,
          targetMarginPct,
          maxMarginPct,
          notes: notes || undefined,
        })
      })

      if (importRows.length === 0) {
        throw new Error('No valid rows found. Ensure required columns exist.')
      }

      await importMutation.mutateAsync(importRows)
    } catch (error) {
      setImportFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to import the spreadsheet.',
      })
    } finally {
      resetImportInput()
    }
  }

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Margin profiles"
        subtitle="Control pricing guardrails per parent category."
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              disabled={profiles.length === 0}
              onClick={handleExport}
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
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".xlsx,.xls"
        onChange={handleImportFileChange}
      />

      {importFeedback && (
        <Alert
          severity={importFeedback.type}
          onClose={() => setImportFeedback(null)}
          sx={{ maxWidth: 720 }}
        >
          {importFeedback.message}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="60px">No.</TableCell>
              <TableCell>Parent category</TableCell>
              <TableCell>Margin profile</TableCell>
              <TableCell>Price sensitivity</TableCell>
              <TableCell align="right">Min %</TableCell>
              <TableCell align="right">Target %</TableCell>
              <TableCell align="right">Max %</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {marginProfilesQuery.isLoading ? (
              Array.from({ length: rowsPerPage }).map((_, index) => (
                <TableRow key={`margin-skeleton-${index}`}>
                  <TableCell colSpan={8}>
                    <Box py={2}>
                      <TextField
                        disabled
                        fullWidth
                        variant="outlined"
                        size="small"
                        placeholder="Loading…"
                      />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Box py={5} textAlign="center">
                    <Typography variant="h6">No margin profiles configured yet.</Typography>
                    <Typography color="text.secondary">
                      Import data from Excel or configure categories first.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedProfiles.map((profile, index) => (
                <TableRow key={profile.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{page * rowsPerPage + index + 1}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{profile.parentCategoryName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={profile.notes || 'No notes available'} arrow>
                      <Chip
                        label={profile.marginProfile}
                        size="small"
                        sx={{
                          bgcolor: marginProfileColor(profile.marginProfile),
                          color: '#fff',
                          textTransform: 'none',
                        }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={profile.priceSensitivity}
                      size="small"
                      color={getPriceSensitivityColor(profile.priceSensitivity)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {numberFormatter.format(profile.minMarginPct)}%
                  </TableCell>
                  <TableCell align="right">
                    {numberFormatter.format(profile.targetMarginPct)}%
                  </TableCell>
                  <TableCell align="right">
                    {numberFormatter.format(profile.maxMarginPct)}%
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditOutlinedIcon fontSize="small" />}
                      onClick={() => openEditDialog(profile)}
                    >
                      Edit targets
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalProfiles}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>

      <Dialog
        open={dialogOpen && !!editTarget}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={handleEditSubmit}>
          <DialogTitle>Adjust margin guardrails</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Min margin (%)"
                type="number"
                value={editForm.minMarginPct}
                onChange={handleEditChange('minMarginPct')}
                inputProps={{ step: 0.1, min: 0 }}
                required
              />
              <TextField
                label="Target margin (%)"
                type="number"
                value={editForm.targetMarginPct}
                onChange={handleEditChange('targetMarginPct')}
                inputProps={{ step: 0.1, min: 0 }}
                required
              />
              <TextField
                label="Max margin (%)"
                type="number"
                value={editForm.maxMarginPct}
                onChange={handleEditChange('maxMarginPct')}
                inputProps={{ step: 0.1, min: 0 }}
                required
              />
              {updateMutation.isError && (
                <Alert severity="error">
                  {updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : 'Unable to update margin profile.'}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}

export default MarginsPage
