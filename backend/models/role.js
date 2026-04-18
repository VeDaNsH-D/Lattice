import mongoose from "mongoose";
import { PERMISSIONS } from "../constants/permissions.js";

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
            enum: PERMISSIONS,
            required: true
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
