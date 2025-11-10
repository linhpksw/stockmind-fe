import { Alert, Button, Card, CardContent, Stack, TextField } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { recordWaste } from '../api/waste'
import { SectionHeading } from '../components/common/SectionHeading'

export const WastePage = () => {
  const mutation = useMutation({ mutationFn: recordWaste })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    mutation.mutate({
      productId: String(formData.get('productId')),
      lotId: String(formData.get('lotId')),
      qty: Number(formData.get('qty')),
      reason: String(formData.get('reason')),
    })
    event.currentTarget.reset()
  }

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Waste & shrinkage"
        subtitle="Record disposals for audit and traceability."
      />
      <Card>
        <CardContent>
          <Stack spacing={2} component="form" onSubmit={handleSubmit}>
            <TextField name="productId" label="Product ID" required />
            <TextField name="lotId" label="Lot ID" required />
            <TextField name="qty" label="Quantity" type="number" required />
            <TextField name="reason" label="Reason" required />
            {mutation.isError && <Alert severity="error">Failed to record waste.</Alert>}
            {mutation.isSuccess && <Alert severity="success">Waste recorded successfully.</Alert>}
            <Button type="submit" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Record waste'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

export default WastePage
