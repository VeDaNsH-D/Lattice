import Link from "../models/link.js";
import ProjectMember from "../models/projectMember.js";

const getProjectId = (req) => {
    return req.params.projectId || req.body.projectId || req.query.projectId;
};

const getLinkId = (req) => {
    return req.params.linkId || req.params.id || req.body.linkId || req.query.linkId;
};

export const requireProjectMember = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const projectId = getProjectId(req);

        if (!userId || !projectId) {
            return res.status(400).json({
                success: false,
                message: "userId and projectId are required"
            });
        }

        const projectMember = await ProjectMember.findOne({ userId, projectId }).populate("roleId");

        if (!projectMember) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: user is not a project member"
            });
        }

        req.projectMember = projectMember;
        return next();
    } catch (error) {
        return next(error);
    }
};

export const requireLinkAccess = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const projectId = getProjectId(req);
        const linkId = getLinkId(req);

        if (!userId || !projectId || !linkId) {
            return res.status(400).json({
                success: false,
                message: "userId, projectId, and linkId are required"
            });
        }

        const [projectMember, link] = await Promise.all([
            ProjectMember.findOne({ userId, projectId }).populate("roleId"),
            Link.findOne({ _id: linkId, projectId })
        ]);

        if (!projectMember) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: user is not a project member"
            });
        }

        if (!link) {
            return res.status(404).json({
                success: false,
                message: "Link not found"
            });
        }

        if (link.accessType === "public") {
            req.projectMember = projectMember;
            req.link = link;
            return next();
        }

        const userRoleId = String(projectMember.roleId?._id || projectMember.roleId);
        const hasRoleAccess = link.allowedRoles.some((roleId) => String(roleId) === userRoleId);

        if (!hasRoleAccess) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: role does not have access to this link"
            });
        }

        req.projectMember = projectMember;
        req.link = link;
        return next();
    } catch (error) {
        return next(error);
    }
};

export const requirePermission = (...allowedPermissions) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.userId;
            const projectId = getProjectId(req);

            if (!userId || !projectId) {
                return res.status(400).json({
                    success: false,
                    message: "userId and projectId are required"
                });
            }

            const projectMember = await ProjectMember.findOne({ userId, projectId }).populate("roleId");

            if (!projectMember) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: user is not a project member"
                });
            }

            const permission = projectMember.roleId?.permissions;

            if (!allowedPermissions.includes(permission)) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: insufficient role permissions"
                });
            }

            req.projectMember = projectMember;
            return next();
        } catch (error) {
            return next(error);
        }
    };
};
