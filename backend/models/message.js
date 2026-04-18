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
            enum: ["text", "system"],
            default: "text"
        }
    },
    { timestamps: true }
);

export default mongoose.model("Message", messageSchema);