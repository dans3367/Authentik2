import { Router } from 'express';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { getHighlightStats } from '../services/statsService';

export const statsRoutes = Router();

// GET /api/stats/highlights — dashboard highlight metrics
statsRoutes.get('/highlights', authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const stats = await getHighlightStats(req.user.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Get highlight stats error:', error);
    res.status(500).json({ message: 'Failed to get highlight statistics' });
  }
});
