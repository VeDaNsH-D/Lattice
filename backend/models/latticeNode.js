import mongoose from "mongoose";

const latticeNodeSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        nodeType: {
            type: String,
            enum: ['root', 'hub', 'bookmark'],
            default: 'bookmark',
        },
        sourceType: {
            type: String,
            enum: ['link', 'bookmark', 'manual', 'system'],
            default: 'manual',
        },
        sourceId: {
            type: String,
            default: null,
            trim: true,
        },
        parentHub: {
            type: String,
            default: 'General',
            trim: true,
        },
        summary: {
            type: String,
            default: "",
            trim: true,
        },
        embedding: {
            type: [Number],
            default: [],
        },
        tags: {
            type: [String],
            default: [],
        },
        latticeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true,
        },
        importanceScore: {
            type: Number,
            default: 1,
            min: 0,
        },
        lastAccessed: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

latticeNodeSchema.index({ latticeId: 1, title: 1 });
latticeNodeSchema.index({ latticeId: 1, sourceType: 1, sourceId: 1 });
latticeNodeSchema.index({ latticeId: 1, summary: "text", tags: "text", title: "text" });

export default mongoose.model("LatticeNode", latticeNodeSchema);
