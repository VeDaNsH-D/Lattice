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
        telegramId: {
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
        linkedinUrl: {
            type: String,
            trim: true,
            default: ""
        },
        githubUrl: {
            type: String,
            trim: true,
            default: ""
        },
        websiteUrl: {
            type: String,
            trim: true,
            default: ""
        },
        xUrl: {
            type: String,
            trim: true,
            default: ""
        },
        linkDecayStartDays: {
            type: Number,
            default: 14,
            min: 1,
            max: 365
        },
        linkGraveyardDays: {
            type: Number,
            default: 30,
            min: 2,
            max: 730
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