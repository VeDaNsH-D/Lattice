import mongoose from "mongoose";

const latticeEdgeSchema = new mongoose.Schema(
    {
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LatticeNode",
            required: true,
            index: true,
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LatticeNode",
            required: true,
            index: true,
        },
        weight: {
            type: Number,
            default: 0,
            min: 0,
            max: 1,
        },
        type: {
            type: String,
            enum: ["semantic", "tag", "behavior"],
            default: "semantic",
        },
        latticeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true,
        },
    },
    { timestamps: true }
);

latticeEdgeSchema.index({ latticeId: 1, from: 1, to: 1, type: 1 }, { unique: true });
latticeEdgeSchema.index({ latticeId: 1, weight: -1 });

export default mongoose.model("LatticeEdge", latticeEdgeSchema);
