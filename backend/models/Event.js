import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
    {
        link_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "TimelineLink",
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        type: {
            type: String,
            enum: ["minor", "major"],
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        source: {
            type: String,
            enum: ["page", "world", "both"],
            default: "page",
        },
    },
    {
        versionKey: false,
    }
);

eventSchema.index({ link_id: 1, timestamp: -1 });

export default mongoose.models.TimelineEvent || mongoose.model("TimelineEvent", eventSchema);
