import { Card, CardContent, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: ReactNode
  helperText?: string
  accent?: 'primary' | 'secondary' | 'error'
}

export const StatCard = ({ label, value, helperText, accent = 'primary' }: StatCardProps) => (
  <Card sx={{ height: '100%', borderTop: 4, borderColor: `${accent}.main` }}>
    <CardContent>
      <Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4">{value}</Typography>
        {helperText && (
          <Typography variant="body2" color="text.secondary">
            {helperText}
          </Typography>
        )}
      </Stack>
    </CardContent>
  </Card>
)
