import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
    {
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: "targetType"
        },

        targetType: {
            type: String,
            required: true,
            enum: ["Link", "Project"]
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        text: {
            type: String
        },

        gifUrl: {
            type: String
        },

        resolved: {
            type: Boolean,
            default: false,
            index: true
        },

        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        resolvedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);