import mongoose from 'mongoose';
import LatticeNode from './Backend/models/latticeNode.js';
import LatticeEdge from './Backend/models/latticeEdge.js';
import Link from './Backend/models/link.js';
import dotenv from 'dotenv';
dotenv.config({ path: './Backend/.env' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const links = await Link.find({});
  const nodes = await LatticeNode.find({});
  const edges = await LatticeEdge.find({});
  console.log(`Total Links: ${links.length}`);
  console.log(`Total Nodes: ${nodes.length}`);
  console.log(`Total Edges: ${edges.length}`);
  for (const node of nodes) {
    console.log(`Node: ${node.title} | Project: ${node.latticeId} | Embedding: ${node.embedding?.length > 0}`);
  }
  process.exit(0);
}
check();
