import dotenv from "dotenv";
import mongoose from "mongoose";
import Link from "../models/link.js";
import { resolveVibe } from "../utils/vibe.js";

dotenv.config();

async function run() {
    if (!process.env.MONGO_URI) {
        console.error("MONGO_URI is missing. Aborting vibe backfill.");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const links = await Link.find({}, {
        _id: 1,
        vibe: 1,
        title: 1,
        description: 1,
        url: 1,
        tags: 1,
        parentHub: 1
    }).lean();
    let updatedCount = 0;
    let alreadyValidCount = 0;

    const ops = links.map((link) => {
        const currentVibe = typeof link.vibe === "string" ? link.vibe.trim().toLowerCase() : "";
        const normalizedVibe = resolveVibe(currentVibe, {
            title: link.title,
            description: link.description,
            url: link.url,
            tags: link.tags,
            parentHub: link.parentHub
        });

        if (currentVibe === normalizedVibe) {
            alreadyValidCount += 1;
            return null;
        }

        updatedCount += 1;
        return {
            updateOne: {
                filter: { _id: link._id },
                update: { $set: { vibe: normalizedVibe } }
            }
        };
    }).filter(Boolean);

    if (ops.length > 0) {
        await Link.bulkWrite(ops, { ordered: false });
    }

    console.log(`Backfill complete. Total links: ${links.length}`);
    console.log(`Updated links: ${updatedCount}`);
    console.log(`Already valid links: ${alreadyValidCount}`);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(async (error) => {
    console.error("Vibe backfill failed:", error.message);
    try {
        await mongoose.disconnect();
    } catch {
        // no-op
    }
    process.exit(1);
});
