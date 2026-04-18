import mongoose from "mongoose";

const projectMemberSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
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
        }
    },
    { timestamps: true }
);

projectMemberSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export default mongoose.model("ProjectMember", projectMemberSchema);
