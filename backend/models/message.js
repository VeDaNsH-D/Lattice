import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room"
        },

        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        text: String,

        type: {
            type: String,
            enum: ["text", "system", "ai"],
            default: "text"
        },
        linkIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Link"
            }
        ],
        meta: {
            collisionType: {
                type: String,
                enum: ["overlap", "conflict", "mixed", "none"],
                default: "none"
            },
            collisionScore: {
                type: Number,
                default: 0
            }
        }
    },
    { timestamps: true }
);

export default mongoose.model("Message", messageSchema);