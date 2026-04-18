import mongoose from "mongoose";

const timelineLinkSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        created_at: {
            type: Date,
            default: Date.now,
        },
        last_viewed_at: {
            type: Date,
            default: null,
        },
    },
    {
        versionKey: false,
    }
);

timelineLinkSchema.index({ url: 1 }, { unique: true });

export default mongoose.models.TimelineLink || mongoose.model("TimelineLink", timelineLinkSchema);
