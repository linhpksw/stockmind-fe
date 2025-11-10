import { Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface SectionHeadingProps {
  title: string
  action?: ReactNode
  subtitle?: string
}

export const SectionHeading = ({ title, action, subtitle }: SectionHeadingProps) => (
  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap">
    <Stack spacing={0.5}>
      <Typography variant="h6">{title}</Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Stack>
    {action}
  </Stack>
)
