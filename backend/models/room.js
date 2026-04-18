import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project"
        },

        name: String, // optional (e.g. "Team Call")
        kind: {
            type: String,
            enum: ["general", "debate"],
            default: "general"
        },

        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        meta: {
            linkIds: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Link"
                }
            ],
            collisionType: {
                type: String,
                enum: ["overlap", "conflict", "mixed", "none"],
                default: "none"
            },
            collisionScore: {
                type: Number,
                default: 0
            },
            openedBy: {
                type: String,
                enum: ["ai", "user"],
                default: "user"
            }
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

export default mongoose.model("Room", roomSchema);