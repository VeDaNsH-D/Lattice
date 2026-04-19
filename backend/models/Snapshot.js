import mongoose from "mongoose";

const snapshotSchema = new mongoose.Schema(
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
        summary: {
            type: String,
            required: true,
        },
        page_summary: {
            type: String,
            default: "",
        },
        context_summary: {
            type: String,
            default: "",
        },
        summary_engine: {
            type: String,
            enum: ["overtime", "ingestion", "legacy"],
            default: "overtime",
        },
        change_level: {
            type: String,
            enum: ["none", "minor", "major"],
            required: true,
        },
        change_source: {
            type: String,
            enum: ["page", "world", "both"],
            default: "page",
        },
    },
    {
        versionKey: false,
    }
);

snapshotSchema.index({ link_id: 1, timestamp: -1 });

export default mongoose.models.TimelineSnapshot || mongoose.model("TimelineSnapshot", snapshotSchema);
