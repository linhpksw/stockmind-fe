import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import {
  Avatar,
  Box,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { ChangeEvent, MouseEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth-store'
import { useSearchStore } from '../../stores/search-store'

interface TopBarProps {
  onOpenSidebar: () => void
}

export const TopBar = ({ onOpenSidebar }: TopBarProps) => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const query = useSearchStore(state => state.query)
  const setQuery = useSearchStore(state => state.setQuery)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  const handleAvatarClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const initials = user?.fullName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      px={2}
      py={1.5}
      bgcolor="background.paper"
      borderBottom="1px solid"
      borderColor="divider"
    >
      <IconButton edge="start" sx={{ display: { md: 'none' } }} onClick={onOpenSidebar}>
        <MenuIcon />
      </IconButton>
      <TextField
        value={query}
        onChange={handleSearchChange}
        size="small"
        placeholder="Search anything (products, suppliers, lots...)"
        sx={{ flexGrow: 1, maxWidth: 600, backgroundColor: 'grey.50' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      <Stack direction="row" spacing={1} alignItems="center">
        <Box textAlign="right" display={{ xs: 'none', sm: 'block' }}>
          <Typography variant="subtitle2">{user?.fullName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.roles?.join(', ') || 'User'}
          </Typography>
        </Box>
        <IconButton onClick={handleAvatarClick}>
          <Avatar sx={{ width: 36, height: 36 }}>{initials || 'SM'}</Avatar>
        </IconButton>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem disabled>{user?.email ?? user?.username}</MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Stack>
    </Stack>
  )
}
