import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
    {
        // 🔥 flexible reference
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
        }
    },
    { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);