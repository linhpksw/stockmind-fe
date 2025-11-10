import {
  Alert,
  Button,
  Card,
  CardContent,
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
import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { applyMarkdown, getMarkdownRecommendations } from '../api/markdowns'
import { SectionHeading } from '../components/common/SectionHeading'

export const MarkdownsPage = () => {
  const [days, setDays] = useState(3)
  const queryClient = useQueryClient()

  const recommendationsQuery = useQuery({
    queryKey: ['markdowns', days],
    queryFn: () => getMarkdownRecommendations(days),
  })

  const applyMutation = useMutation({
    mutationFn: applyMarkdown,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markdowns'] })
    },
  })

  const handleDaysChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDays(Number(event.target.value))
  }

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Markdown recommendations"
        subtitle="Automated FEFO recommendations for perishable lots."
      />
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="Days to expiry"
              type="number"
              value={days}
              onChange={handleDaysChange}
              InputProps={{ inputProps: { min: 1 } }}
            />
            <Button variant="contained" onClick={() => recommendationsQuery.refetch()}>
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {recommendationsQuery.isError && (
        <Alert severity="error">Failed to load recommendations.</Alert>
      )}

      <Card>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>Lot</TableCell>
                <TableCell>Days to expiry</TableCell>
                <TableCell>Suggested discount</TableCell>
                <TableCell>Floor % of cost</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {recommendationsQuery.data?.map(item => (
                <TableRow key={`${item.productId}-${item.lotId}`}>
                  <TableCell>{item.productId}</TableCell>
                  <TableCell>{item.lotId}</TableCell>
                  <TableCell>{item.daysToExpiry}</TableCell>
                  <TableCell>{(item.suggestedDiscountPct * 100).toFixed(0)}%</TableCell>
                  <TableCell>{(item.floorPctOfCost * 100).toFixed(0)}%</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        applyMutation.mutate({
                          productId: item.productId,
                          lotId: item.lotId,
                          discountPct: item.suggestedDiscountPct,
                          overrideFloor: false,
                        })
                      }
                    >
                      Apply
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {recommendationsQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">No markdowns required today.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {applyMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {applyMutation.error instanceof Error
                ? applyMutation.error.message
                : 'Failed to apply markdown.'}
            </Alert>
          )}
          {applyMutation.isSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Markdown applied. Effective price: {applyMutation.data.effectivePrice}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default MarkdownsPage
