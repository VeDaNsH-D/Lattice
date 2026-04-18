/**
 * AI Query Routes
 */

import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { 
    askLattice, 
    validateQuery, 
    getContexts 
} from '../controllers/ai.controller.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /ai/query
 * Process a context-aware AI query
 */
router.post('/query', askLattice);

/**
 * POST /ai/validate-query
 * Validate query syntax without processing
 */
router.post('/validate-query', validateQuery);

/**
 * GET /ai/context-suggestions
 * Get available contexts for autocomplete
 */
router.get('/context-suggestions', getContexts);

export default router;
