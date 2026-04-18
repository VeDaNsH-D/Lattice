import mongoose from "mongoose";

const inviteSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true
        },
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Role",
            required: true
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "accepted"],
            default: "pending"
        }
    },
    { timestamps: true }
);

inviteSchema.index({ email: 1, projectId: 1 }, { unique: true });

export default mongoose.model("Invite", inviteSchema);