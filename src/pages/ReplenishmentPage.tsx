import {
  Alert,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { getReplenishmentSuggestions } from '../api/replenishment'
import { SectionHeading } from '../components/common/SectionHeading'

export const ReplenishmentPage = () => {
  const query = useQuery({
    queryKey: ['replenishment'],
    queryFn: getReplenishmentSuggestions,
  })

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Replenishment planner"
        subtitle="ROP-based guidance derived from recent sales."
      />
      {query.isError && <Alert severity="error">Unable to load suggestions.</Alert>}
      <Card>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">On hand</TableCell>
                <TableCell align="right">On order</TableCell>
                <TableCell align="right">Avg daily</TableCell>
                <TableCell align="right">Safety stock</TableCell>
                <TableCell align="right">ROP</TableCell>
                <TableCell align="right">Suggested qty</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.data?.map(item => (
                <TableRow key={item.productId}>
                  <TableCell>{item.productId}</TableCell>
                  <TableCell align="right">{item.onHand}</TableCell>
                  <TableCell align="right">{item.onOrder}</TableCell>
                  <TableCell align="right">{item.avgDaily.toFixed(2)}</TableCell>
                  <TableCell align="right">{item.safetyStock.toFixed(2)}</TableCell>
                  <TableCell align="right">{item.rop.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    {item.suggestedQty > 0 ? item.suggestedQty.toFixed(2) : '0'}
                  </TableCell>
                </TableRow>
              ))}
              {query.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary">No replenishment actions today.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  )
}

export default ReplenishmentPage
