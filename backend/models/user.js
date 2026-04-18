import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },
        avatarUrl: {
            type: String,
            trim: true
        },
        bio: {
            type: String,
            trim: true,
            default: ""
        },
        password: {
            type: String,
            required: function requiredPassword() {
                return !this.googleId;
            },
            select: false
        }
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);