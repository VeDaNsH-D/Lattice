import express from "express";
import { body, param } from "express-validator";
import { validateRequest } from "../middlewares/validate.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import Project from "../models/project.js";
import LatticeNode from "../models/latticeNode.js";
import {
    cleanupEdges,
    decayNodes,
    getGraphSnapshot,
    getRelatedNodes,
    queryLattice,
} from "../services/graph.service.js";

const router = express.Router();

const canAccessProject = async (userId, projectId) => {
    return Project.exists({
        _id: projectId,
        isActive: true,
        $or: [{ createdBy: userId }, { members: userId }],
    });
};

const ensureLatticeAccess = async (req, res, next) => {
    const projectId = req.params.id;
    const allowed = await canAccessProject(req.user.userId, projectId);

    if (!allowed) {
        return res.status(403).json({
            success: false,
            message: "Forbidden: you are not a member of this project",
        });
    }

    return next();
};

const ensureNodeAccess = async (req, res, next) => {
    const node = await LatticeNode.findById(req.params.id).select("latticeId").lean();

    if (!node) {
        return res.status(404).json({
            success: false,
            message: "Node not found",
        });
    }

    const allowed = await canAccessProject(req.user.userId, node.latticeId);
    if (!allowed) {
        return res.status(403).json({
            success: false,
            message: "Forbidden: you are not a member of this project",
        });
    }

    return next();
};

router.get(
    "/lattice/:id/graph",
    authMiddleware,
    [param("id").isMongoId().withMessage("valid lattice id is required")],
    validateRequest,
    ensureLatticeAccess,
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
    authMiddleware,
    [param("id").isMongoId().withMessage("valid node id is required")],
    validateRequest,
    ensureNodeAccess,
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
    authMiddleware,
    [
        param("id").isMongoId().withMessage("valid lattice id is required"),
        body("question").trim().notEmpty().withMessage("question is required"),
    ],
    validateRequest,
    ensureLatticeAccess,
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
