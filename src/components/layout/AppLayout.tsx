import { Box, Container } from '@mui/material'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SIDEBAR_WIDTH } from '../../constants/layout'
import { SidebarNav } from './SidebarNav'
import { TopBar } from './TopBar'

export const AppLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <SidebarNav mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { md: `${SIDEBAR_WIDTH}px` },
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <TopBar onOpenSidebar={() => setMobileOpen(true)} />
        <Container maxWidth={false} sx={{ flexGrow: 1, py: 4 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}
