import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export const NotFoundPage = () => {
  const navigate = useNavigate()
  return (
    <Box textAlign="center" py={10}>
      <Typography variant="h3" gutterBottom>
        404
      </Typography>
      <Typography color="text.secondary" mb={4}>
        The page you are looking for does not exist.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/app')}>
        Go home
      </Button>
    </Box>
  )
}

export default NotFoundPage
