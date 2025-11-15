import MenuIcon from '@mui/icons-material/Menu'
import { Box, IconButton, Stack } from '@mui/material'

interface TopBarProps {
  onOpenSidebar: () => void
}

export const TopBar = ({ onOpenSidebar }: TopBarProps) => {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0}
      px={0}
      py={0}
      bgcolor="background.paper"
      borderBottom="1px solid"
      borderColor="divider"
      sx={{ minHeight: 48 }}
    >
      <IconButton edge="start" sx={{ display: { md: 'none' } }} onClick={onOpenSidebar}>
        <MenuIcon />
      </IconButton>
      <Box sx={{ flexGrow: 1 }} />
    </Stack>
  )
}
