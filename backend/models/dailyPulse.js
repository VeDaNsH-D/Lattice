import mongoose from "mongoose";

const dailyPulseSchema = new mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true
        },
        runDate: {
            type: Date,
            required: true,
            index: true
        },
        sourceLinkIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Link"
            }
        ],
        script: {
            type: String,
            required: true
        },
        audioPath: {
            type: String,
            required: true
        },
        audioUrl: {
            type: String,
            required: true
        },
        durationSec: Number,
        status: {
            type: String,
            enum: ["ready", "failed"],
            default: "ready"
        },
        errorMessage: String
    },
    { timestamps: true }
);

dailyPulseSchema.index({ projectId: 1, runDate: 1 }, { unique: true });

export default mongoose.model("DailyPulse", dailyPulseSchema);
