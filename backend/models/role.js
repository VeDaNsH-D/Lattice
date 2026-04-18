import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true
        },
        permissions: {
            type: String,
            enum: ["full_access", "restricted_access", "view_only"],
            required: true,
            default: "view_only"
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

roleSchema.index({ projectId: 1, name: 1 }, { unique: true });

export default mongoose.model("Role", roleSchema);
