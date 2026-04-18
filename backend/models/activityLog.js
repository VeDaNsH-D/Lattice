import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true,
        },
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                "link_added",
                "link_deleted",
                "link_restored",
                "comment_added",
                "comment_resolved",
                "bookmarks_imported",
                "project_created",
                "role_created",
                "collaborator_invited",
                "collaborator_added",
                "reaction_updated",
                "collaborator_joined_room",
                "collaborator_sent_chat",
                "forked_by_you",
            ],
            required: true,
            index: true,
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

activityLogSchema.index({ projectId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);
