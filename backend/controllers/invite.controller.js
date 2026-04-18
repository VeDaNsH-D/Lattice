import mongoose from "mongoose";
import Invite from "../models/invite.js";
import ProjectMember from "../models/projectMember.js";
import Role from "../models/role.js";
import User from "../models/user.js";
import Project from "../models/project.js";
import { sendInviteEmail } from "../services/email.service.js";

export const inviteUser = async (req, res, next) => {
    try {
        const { email, projectId, roleId } = req.body;
        const requesterId = req.user.userId;

        // 1. VALIDATION: Check required fields
        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Valid projectId is required"
            });
        }

        if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
            return res.status(400).json({
                success: false,
                message: "Valid roleId is required"
            });
        }

        // 2. AUTHORIZATION: Check if user has access to the project
        const project = await Project.findById(projectId).select("_id projectType createdBy members isActive");

        if (!project || !project.isActive) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        const isProjectMember =
            String(project.createdBy) === String(requesterId) ||
            (Array.isArray(project.members) && project.members.some((memberId) => String(memberId) === String(requesterId)));

        if (!isProjectMember) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you are not a project member"
            });
        }

        if (String(project.createdBy) !== String(requesterId)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: only project owner can invite users"
            });
        }

        if (project.projectType !== "collaborative") {
            return res.status(400).json({
                success: false,
                message: "Invites are only available for collaborative projects"
            });
        }

        // 3. VERIFY ROLE EXISTS AND BELONGS TO PROJECT
        const role = await Role.findOne({
            _id: roleId,
            projectId
        });

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Role not found in this project"
            });
        }

        // 4. CHECK DUPLICATES: User already in project
        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            const isInProjectMembers = Array.isArray(project.members)
                && project.members.some((memberId) => String(memberId) === String(existingUser._id));

            const existingMember = await ProjectMember.findOne({
                userId: existingUser._id,
                projectId
            });

            if (isInProjectMembers || existingMember) {
                return res.status(400).json({
                    success: false,
                    message: "User is already a member of this project"
                });
            }
        }

        // 5. CHECK DUPLICATES: Invite already exists
        const existingInvite = await Invite.findOne({
            email: normalizedEmail,
            projectId,
            status: "pending"
        });

        if (existingInvite) {
            return res.status(400).json({
                success: false,
                message: "Invite already exists for this user"
            });
        }

        // 6. CREATE INVITE
        const invite = await Invite.create({
            email: normalizedEmail,
            projectId,
            roleId,
            invitedBy: requesterId
        });

        // Populate for response
        const populatedInvite = await Invite.findById(invite._id)
            .populate("projectId", "name")
            .populate("roleId", "name permissions")
            .populate("invitedBy", "email name");

        // 7. SEND EMAIL (background task - don't wait for response)
        try {
            const inviter = await User.findById(requesterId);
            const hydratedProject = await Project.findById(projectId);
            const roleDetails = await Role.findById(roleId);

            if (inviter && hydratedProject && roleDetails) {
                sendInviteEmail({
                    email: normalizedEmail,
                    inviterName: inviter.name || inviter.email,
                    projectName: hydratedProject.name,
                    roleName: roleDetails.name,
                    inviteId: invite._id.toString()
                }).catch(emailError => {
                    console.error("Failed to send invite email:", emailError.message);
                    // Don't block invite creation if email fails
                });
            }
        } catch (emailError) {
            console.error("Error preparing email data:", emailError.message);
        }

        // 8. RESPONSE
        return res.status(201).json({
            success: true,
            invite: populatedInvite
        });
    } catch (error) {
        return next(error);
    }
};

export const acceptInvite = async (req, res, next) => {
    try {
        const { id: inviteId } = req.params;

        // 1. VALIDATION: Check inviteId
        if (!inviteId || !mongoose.Types.ObjectId.isValid(inviteId)) {
            return res.status(400).json({
                success: false,
                message: "Valid inviteId is required"
            });
        }

        // 2. FIND INVITE
        const invite = await Invite.findById(inviteId);

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: "Invite not found"
            });
        }

        if (invite.status === "accepted") {
            return res.status(400).json({
                success: false,
                message: "Invite already accepted"
            });
        }

        if (invite.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Invite is no longer pending"
            });
        }

        // 3. AUTHORIZATION: Get authenticated user and check email match
        const user = await User.findById(req.user.userId);

        if (!user || user.email !== invite.email) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you can only accept invites sent to your email"
            });
        }

        // 4. CHECK IF USER ALREADY MEMBER
        const existingMember = await ProjectMember.findOne({
            userId: user._id,
            projectId: invite.projectId
        });

        if (!existingMember) {
            await ProjectMember.create({
                userId: user._id,
                projectId: invite.projectId,
                roleId: invite.roleId
            });
        }

        await Project.findByIdAndUpdate(invite.projectId, {
            $addToSet: { members: user._id }
        });

        // 6. UPDATE INVITE STATUS
        invite.status = "accepted";
        await invite.save();

        // 7. RESPONSE
        return res.status(200).json({
            success: true,
            message: "Joined project successfully"
        });
    } catch (error) {
        return next(error);
    }
};

export const rejectInvite = async (req, res, next) => {
    try {
        const { id: inviteId } = req.params;

        // 1. VALIDATION: Check inviteId
        if (!inviteId || !mongoose.Types.ObjectId.isValid(inviteId)) {
            return res.status(400).json({
                success: false,
                message: "Valid inviteId is required"
            });
        }

        // 2. FIND INVITE
        const invite = await Invite.findById(inviteId);

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: "Invite not found"
            });
        }

        if (invite.status === "accepted") {
            return res.status(400).json({
                success: false,
                message: "Invite already accepted"
            });
        }

        if (invite.status === "rejected") {
            return res.status(400).json({
                success: false,
                message: "Invite already rejected"
            });
        }

        // 3. AUTHORIZATION: Only invited user can reject own invite
        const user = await User.findById(req.user.userId);

        if (!user || user.email !== invite.email) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you can only reject invites sent to your email"
            });
        }

        // 4. UPDATE INVITE STATUS
        invite.status = "rejected";
        await invite.save();

        // 5. RESPONSE
        return res.status(200).json({
            success: true,
            message: "Invite rejected successfully"
        });
    } catch (error) {
        return next(error);
    }
};

export const listProjectInvites = async (req, res, next) => {
    try {
        const { projectId } = req.params;

        // 1. VALIDATION: Check projectId
        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Valid projectId is required"
            });
        }

        // 2. AUTHORIZATION: Check if user has access to project
        const project = await Project.findById(projectId).select("_id createdBy members isActive");

        if (!project || !project.isActive) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        const isProjectMember =
            String(project.createdBy) === String(req.user.userId) ||
            (Array.isArray(project.members) && project.members.some((memberId) => String(memberId) === String(req.user.userId)));

        if (!isProjectMember) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you are not a project member"
            });
        }

        if (String(project.createdBy) !== String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: only project owner can view pending invites"
            });
        }

        // 3. FETCH PENDING INVITES
        const invites = await Invite.find({
            projectId,
            status: "pending"
        })
            .populate("roleId", "name permissions")
            .populate("invitedBy", "email name")
            .sort({ createdAt: -1 });

        // 4. RESPONSE
        return res.status(200).json({
            success: true,
            count: invites.length,
            invites
        });
    } catch (error) {
        return next(error);
    }
};
