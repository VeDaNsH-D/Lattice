import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        projectType: {
            type: String,
            enum: ["personal", "collaborative"],
            default: "personal",
            required: true
        },
        isPublic: {
            type: Boolean,
            default: false,
            index: true
        },
        parentProjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
            index: true
        },
        rootProjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
            index: true
        },
        lineageDepth: {
            type: Number,
            default: 0,
            min: 0
        },
        remixCount: {
            type: Number,
            default: 0,
            min: 0
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isPublic: {
            type: Boolean,
            default: false
        },
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        roles: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Role"
            }
        ],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        }
    },
    { timestamps: true }
);

export default mongoose.model("Project", projectSchema);