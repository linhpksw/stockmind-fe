import AddIcon from '@mui/icons-material/Add'
import Pagination from '@mui/material/Pagination'
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
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangeEvent, ComponentType, ComponentProps, FormEvent } from 'react'
import { useState } from 'react'
import { createSupplier, listSuppliers } from '../api/suppliers'
import { SectionHeading } from '../components/common/SectionHeading'
import { useSearchStore } from '../stores/search-store'
import type { CreateSupplierRequest } from '../types/suppliers'
import { formatDateTime } from '../utils/formatters'

const PaginationControl = Pagination as ComponentType<ComponentProps<typeof Pagination>>

export const SuppliersPage = () => {
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateSupplierRequest>({
    name: '',
    contact: '',
    leadTimeDays: 0,
  })
  const globalQuery = useSearchStore(state => state.query)
  const queryClient = useQueryClient()
  const pageSize = 10

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', page, globalQuery],
    queryFn: () => listSuppliers({ pageNum: page, pageSize, query: globalQuery }),
  })

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setDialogOpen(false)
      setForm({ name: '', contact: '', leadTimeDays: 0 })
    },
  })

  const totalPages = suppliersQuery.data
    ? Math.ceil(suppliersQuery.data.total / suppliersQuery.data.pageSize)
    : 0

  const handleCreateSupplier = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate(form)
  }

  const handleFormChange =
    (field: keyof CreateSupplierRequest) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({
        ...prev,
        [field]:
          field === 'leadTimeDays' ? Number(event.target.value ?? 0) : (event.target.value ?? ''),
      }))
    }

  const handlePageChange = (_event: ChangeEvent<unknown>, value: number) => {
    setPage(value)
  }

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Supplier directory"
        subtitle="Manage sourcing partners and lead times."
        action={
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setDialogOpen(true)}>
            New supplier
          </Button>
        }
      />
      {suppliersQuery.isError && <Alert severity="error">Failed to load suppliers.</Alert>}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Lead time (days)</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliersQuery.data?.data.map(supplier => (
              <TableRow key={supplier.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={600}>{supplier.name}</Typography>
                    {supplier.deleted && <Chip size="small" label="Inactive" color="warning" />}
                  </Stack>
                </TableCell>
                <TableCell>{supplier.contact || '-'}</TableCell>
                <TableCell>{supplier.leadTimeDays}</TableCell>
                <TableCell>{formatDateTime(supplier.createdAt)}</TableCell>
                <TableCell>{supplier.deleted ? 'Inactive' : 'Active'}</TableCell>
              </TableRow>
            ))}
            {suppliersQuery.data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">No suppliers match the filter.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      {totalPages > 1 && (
        <Box display="flex" justifyContent="flex-end">
          <PaginationControl count={totalPages} page={page} onChange={handlePageChange} />
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleCreateSupplier}>
          <DialogTitle>Add supplier</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Name"
                value={form.name}
                onChange={handleFormChange('name')}
                required
              />
              <TextField
                label="Contact"
                value={form.contact}
                onChange={handleFormChange('contact')}
              />
              <TextField
                label="Lead time (days)"
                type="number"
                value={form.leadTimeDays}
                onChange={handleFormChange('leadTimeDays')}
                required
              />
              {createMutation.isError && (
                <Alert severity="error">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Unable to create supplier.'}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}

export default SuppliersPage
