import mongoose from "mongoose";

const linkSchema = new mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        url: {
            type: String,
            required: true
        },

        title: String,
        description: String,
        image: String,

        summary: String,      // AI generated
        tags: [String],       // AI or user
        vibe: String,         // optional
        deadline: {
            type: Date,
            default: null
        },
        embedding: {
            type: [Number],
            default: undefined
        },
        embeddingModel: String,
        collisionCheckedAt: Date,

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        clickCount: {
            type: Number,
            default: 0
        },

        lastClickedAt: {
            type: Date,
            default: Date.now
        },

        movedToCompostAt: {
            type: Date,
            default: null
        },

        deletedAt: {
            type: Date,
            default: null
        },

        graveyardReason: {
            type: String,
            enum: ["expired", "deleted"],
            default: null
        },

        status: {
            type: String,
            enum: ["active", "decaying", "dead"],
            default: "active"
        },
        accessType: {
            type: String,
            enum: ["public", "role_based"],
            default: "public"
        },

        allowedRoles: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Role"
            }
        ],

        reactions: [
            {
                emoji: {
                    type: String,
                    required: true,
                    trim: true
                },
                users: [
                    {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User"
                    }
                ]
            }
        ]
    },
    { timestamps: true }
);

linkSchema.path("allowedRoles").validate(function validateAllowedRoles(value) {
    if (this.accessType !== "role_based") {
        return true;
    }

    return Array.isArray(value) && value.length > 0;
}, "allowedRoles must contain at least one role when accessType is role_based");

linkSchema.index({ title: "text", summary: "text", tags: "text" });
linkSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model("Link", linkSchema);