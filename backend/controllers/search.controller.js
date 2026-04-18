import mongoose from "mongoose";
import Link from "../models/link.js";
import ProjectMember from "../models/projectMember.js";

export const searchLinks = async (req, res, next) => {
    try {
        const { q, projectId } = req.query;
        const query = typeof q === "string" ? q.trim() : "";

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "q is required"
            });
        }

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Valid projectId is required"
            });
        }

        const member = await ProjectMember.findOne({
            userId: req.user.userId,
            projectId
        });

        if (!member) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you are not a project member"
            });
        }

        const accessFilter = {
            $or: [
                { accessType: "public" },
                {
                    accessType: "role_based",
                    allowedRoles: member.roleId
                }
            ]
        };

        const results = await Link.find(
            {
                projectId,
                ...accessFilter,
                $text: { $search: query }
            },
            {
                score: { $meta: "textScore" }
            }
        )
            .limit(50)
            .populate("createdBy", "name")
            .populate("allowedRoles", "name");

        const rankedResults = results
            .map((link) => {
                const textScore = typeof link.score === "number" ? link.score : 0;
                const clickBoost = (link.clickCount || 0) * 0.3;

                const createdAt = link.createdAt ? new Date(link.createdAt) : null;
                const daysOld = createdAt && !Number.isNaN(createdAt.getTime())
                    ? (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
                    : Number.POSITIVE_INFINITY;
                const recencyBoost = Number.isFinite(daysOld)
                    ? Math.max(0, 10 - daysOld)
                    : 0;

                let statusBoost = 0;
                if (link.status === "active") {
                    statusBoost = 5;
                } else if (link.status === "decaying") {
                    statusBoost = 2;
                } else if (link.status === "dead") {
                    statusBoost = -5;
                }

                const finalScore = textScore + clickBoost + recencyBoost + statusBoost;

                return {
                    ...link.toObject(),
                    finalScore
                };
            })
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, 20);

        return res.status(200).json({
            success: true,
            results: rankedResults
        });
    } catch (error) {
        return next(error);
    }
};
