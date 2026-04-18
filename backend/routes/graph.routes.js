import express from "express";
import { body, param } from "express-validator";
import { validateRequest } from "../middlewares/validate.middleware.js";
import {
    cleanupEdges,
    decayNodes,
    getGraphSnapshot,
    getRelatedNodes,
    queryLattice,
} from "../services/graph.service.js";

const router = express.Router();

router.get(
    "/lattice/:id/graph",
    [param("id").isMongoId().withMessage("valid lattice id is required")],
    validateRequest,
    async (req, res, next) => {
        try {
            const graph = await getGraphSnapshot(req.params.id);

            return res.status(200).json({
                success: true,
                graph,
            });
        } catch (error) {
            return next(error);
        }
    }
);

router.get(
    "/node/:id/related",
    [param("id").isMongoId().withMessage("valid node id is required")],
    validateRequest,
    async (req, res, next) => {
        try {
            const related = await getRelatedNodes(req.params.id);

            if (!related) {
                return res.status(404).json({
                    success: false,
                    message: "Node not found",
                });
            }

            return res.status(200).json({
                success: true,
                related,
            });
        } catch (error) {
            return next(error);
        }
    }
);

router.post(
    "/lattice/:id/query",
    [
        param("id").isMongoId().withMessage("valid lattice id is required"),
        body("question").trim().notEmpty().withMessage("question is required"),
    ],
    validateRequest,
    async (req, res, next) => {
        try {
            const { question } = req.body;
            const result = await queryLattice(question, req.params.id);

            return res.status(200).json({
                success: true,
                ...result,
            });
        } catch (error) {
            return next(error);
        }
    }
);

router.post(
    "/graph/maintenance/decay",
    async (req, res, next) => {
        try {
            const result = await decayNodes();

            return res.status(200).json({
                success: true,
                ...result,
            });
        } catch (error) {
            return next(error);
        }
    }
);

router.post(
    "/graph/maintenance/cleanup",
    async (req, res, next) => {
        try {
            const result = await cleanupEdges();

            return res.status(200).json({
                success: true,
                ...result,
            });
        } catch (error) {
            return next(error);
        }
    }
);

export default router;
