import express from 'express';
import { param, query } from 'express-validator';

import { getProjectPodcastController } from '../controllers/pulse.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ ok: true, route: 'pulse' });
});

router.get(
    '/projects/:projectId/podcast',
    authMiddleware,
    [
        param('projectId').isMongoId().withMessage('Valid projectId is required'),
        query('hours').optional().isInt({ min: 1, max: 72 }).withMessage('hours must be between 1 and 72'),
    ],
    validateRequest,
    getProjectPodcastController
);

export default router;
