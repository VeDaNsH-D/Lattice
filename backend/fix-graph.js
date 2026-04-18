import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import LatticeNode from './models/latticeNode.js';
import LatticeEdge from './models/latticeEdge.js';
import Link from './models/link.js';
import { buildGraphNode } from './services/graph.service.js';
import { generateAIContent } from './services/ai.service.js';

function createDetEmb(text) {
    const dimensions = 64;
    const normalized = text ? text.trim().toLowerCase() : "";
    const vector = new Array(dimensions).fill(0);
    if (normalized) {
        for (let i = 0; i < normalized.length; i++) {
            const code = normalized.charCodeAt(i);
            const bucket = i % dimensions;
            vector[bucket] += Math.sin(code * (i + 1)) + Math.cos(code + i);
        }
    }
    const sumSquare = vector.reduce((sum, val) => sum + (val * val), 0);
    const norm = sumSquare > 0 ? Math.sqrt(sumSquare) : 1;
    return vector.map(val => val / norm);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  
  await LatticeNode.deleteMany({});
  await LatticeEdge.deleteMany({});
  console.log('Cleaned DB');
  
  const links = await Link.find({});
  let i = 0;
  for (const link of links) {
    if (!link.projectId) continue;
    
    // Assign Hub and Embeddings via robust extraction
    if (!link.parentHub) {
       console.log(`Generating AI Hub for: ${link.title || link.url}`);
       try {
           const aiRes = await generateAIContent(link.title, link.description, link.url);
           link.parentHub = aiRes.parentHub || "General";
           if (!link.tags || link.tags.length === 0) link.tags = aiRes.tags;
       } catch (err) {
           link.parentHub = "General";
       }
       await sleep(1200); // Dodge Groq rate limits
    }
    
    if (!link.embedding || link.embedding.length === 0) {
      link.embedding = createDetEmb(link.title || link.url);
    }
    await link.save().catch(e => {});
    
    try {
      await buildGraphNode({
        _id: link._id,
        title: link.title || link.url,
        summary: link.summary || link.description || "",
        tags: link.tags || [],
        embedding: link.embedding,
        latticeId: link.projectId,
        parentHub: link.parentHub || "General"
      });
    } catch(err) {}
    
    i++;
    if (i % 5 === 0) {
      console.log(`Processed ${i} / ${links.length} links...`);
    }
  }
  
  const finalNodes = await LatticeNode.countDocuments();
  const finalEdges = await LatticeEdge.countDocuments();
  console.log(`Fixed! Nodes: ${finalNodes}, Edges: ${finalEdges}`);
  process.exit(0);
}
fix();
