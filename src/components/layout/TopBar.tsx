import MenuIcon from '@mui/icons-material/Menu'
import { IconButton, Stack } from '@mui/material'

interface TopBarProps {
  onOpenSidebar: () => void
}

export const TopBar = ({ onOpenSidebar }: TopBarProps) => {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0}
      px={1}
      py={1}
      sx={{
        display: { xs: 'flex', md: 'none' },
        backgroundColor: 'transparent',
      }}
    >
      <IconButton edge="start" onClick={onOpenSidebar}>
        <MenuIcon />
      </IconButton>
    </Stack>
  )
}
