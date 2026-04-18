/**
 * Resolve @mentions to actual lattices/nodes and fetch their data
 */

import Project from "../models/project.js";
import Link from "../models/link.js";
import LatticeNode from "../models/latticeNode.js";

const MAX_SUMMARY_COUNT = 15;

const buildAccessibleProjectFilter = (userId) => ({
    isActive: true,
    $or: [
        { createdBy: userId },
        { members: userId },
        { isPublic: true }
    ]
});

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function findAccessibleProjectByName(contextName, userId) {
    const safe = escapeRegExp(contextName);
    const accessFilter = buildAccessibleProjectFilter(userId);

    // Exact match first.
    const exact = await Project.findOne({
        ...accessFilter,
        name: { $regex: new RegExp(`^${safe}$`, 'i') },
    })
        .sort({ updatedAt: -1 })
        .lean();

    if (exact) {
        return exact;
    }

    // Then prefix match to support shorthand like @colab -> Colab1.
    return Project.findOne({
        ...accessFilter,
        name: { $regex: new RegExp(`^${safe}`, 'i') },
    })
        .sort({ updatedAt: -1 })
        .lean();
}

/**
 * Find a lattice by name within user's accessible projects
 */
async function findLatticeByName(contextName, userId) {
    if (!contextName || !userId) {
        return null;
    }

    const project = await findAccessibleProjectByName(contextName, userId);

    if (!project) {
        return null;
    }

    return {
        type: 'lattice',
        id: String(project._id),
        name: project.name,
        projectType: project.projectType
    };
}

/**
 * Find a node by name within a lattice
 */
async function findNodeByName(contextName, latticeId) {
    if (!contextName || !latticeId) {
        return null;
    }

    const safe = escapeRegExp(contextName);

    const node = await LatticeNode.findOne({
        title: { $regex: new RegExp(`^${safe}$`, 'i') },
        latticeId
    })
        .sort({ updatedAt: -1 })
        .lean()
        || await LatticeNode.findOne({
            title: { $regex: new RegExp(`^${safe}`, 'i') },
            latticeId
        })
            .sort({ updatedAt: -1 })
            .lean();

    if (!node) {
        return null;
    }

    return {
        type: 'node',
        id: String(node._id),
        name: node.title,
        summary: node.summary,
        tags: node.tags || []
    };
}

async function findNodeByNameAcrossAccessibleLattices(contextName, userId) {
    if (!contextName || !userId) {
        return null;
    }

    const accessibleProjects = await Project.find(buildAccessibleProjectFilter(userId))
        .select("_id")
        .limit(300)
        .lean();

    const latticeIds = accessibleProjects.map((project) => project._id);

    if (!latticeIds.length) {
        return null;
    }

    const safe = escapeRegExp(contextName);

    const node = await LatticeNode.findOne({
        title: { $regex: new RegExp(`^${safe}$`, 'i') },
        latticeId: { $in: latticeIds }
    })
        .sort({ updatedAt: -1 })
        .lean()
        || await LatticeNode.findOne({
            title: { $regex: new RegExp(`^${safe}`, 'i') },
            latticeId: { $in: latticeIds }
        })
            .sort({ updatedAt: -1 })
            .lean();

    if (!node) {
        return null;
    }

    return {
        type: 'node',
        id: String(node._id),
        name: node.title,
        summary: node.summary,
        tags: node.tags || [],
        latticeId: String(node.latticeId)
    };
}

/**
 * Fetch all links for a lattice with their summaries
 */
async function fetchLatticeLinks(projectId, limit = MAX_SUMMARY_COUNT) {
    const links = await Link.find({
        projectId,
        status: { $in: ['active', 'decaying'] }
    })
        .select('title url summary tags description')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    return links.map(link => ({
        title: link.title || link.url,
        url: link.url,
        summary: link.summary || link.description || '(no summary)',
        tags: link.tags || []
    }));
}

/**
 * Fetch node details including related nodes/links
 */
async function fetchNodeDetails(nodeId) {
    const node = await LatticeNode.findById(nodeId)
        .select('title summary tags importanceScore')
        .lean();

    if (!node) {
        return null;
    }

    return {
        title: node.title,
        summary: node.summary,
        tags: node.tags || [],
        importance: node.importanceScore || 1
    };
}

/**
 * Resolve all contexts and fetch their data
 * Returns structured data ready for LLM
 */
export async function resolveContexts(contextNames = [], projectId, userId) {
    if (!Array.isArray(contextNames) || !contextNames.length) {
        return {
            resolvedContexts: [],
            contextData: '',
            warnings: ['No contexts provided']
        };
    }

    const resolvedContexts = [];
    const summaries = [];
    const warnings = [];

    for (const contextName of contextNames) {
        try {
            // Try to find as lattice first
            let lattice = await findLatticeByName(contextName, userId);

            if (lattice) {
                // Fetch lattice links
                const links = await fetchLatticeLinks(lattice.id, MAX_SUMMARY_COUNT);
                resolvedContexts.push(lattice);

                if (links.length === 0) {
                    warnings.push(`Lattice "@${contextName}" is empty`);
                } else {
                    links.forEach((link) => {
                        const summaryText = String(link.summary || '').trim();
                        if (summaryText) {
                            summaries.push({
                                context: contextName,
                                title: link.title || link.url || 'Untitled',
                                summary: summaryText,
                                type: 'link'
                            });
                        }
                    });
                }
            } else {
                // Try to find as node within the current lattice
                if (projectId) {
                    const node = await findNodeByName(contextName, projectId);

                    if (node) {
                        const nodeDetails = await fetchNodeDetails(node.id);

                        if (nodeDetails) {
                            resolvedContexts.push(node);
                            const summaryText = String(nodeDetails.summary || '').trim();
                            if (summaryText) {
                                summaries.push({
                                    context: contextName,
                                    title: nodeDetails.title || contextName,
                                    summary: summaryText,
                                    type: 'node'
                                });
                            }
                        }
                    } else {
                        const node = await findNodeByNameAcrossAccessibleLattices(contextName, userId);

                        if (!node) {
                            warnings.push(`Context "@${contextName}" not found (not a lattice or node)`);
                        } else {
                            const nodeDetails = await fetchNodeDetails(node.id);
                            if (nodeDetails) {
                                resolvedContexts.push(node);
                                const summaryText = String(nodeDetails.summary || '').trim();
                                if (summaryText) {
                                    summaries.push({
                                        context: contextName,
                                        title: nodeDetails.title || contextName,
                                        summary: summaryText,
                                        type: 'node'
                                    });
                                }
                            }
                        }
                    }
                } else {
                    const node = await findNodeByNameAcrossAccessibleLattices(contextName, userId);

                    if (!node) {
                        warnings.push(`Context "@${contextName}" not found`);
                    } else {
                        const nodeDetails = await fetchNodeDetails(node.id);
                        if (nodeDetails) {
                            resolvedContexts.push(node);
                            const summaryText = String(nodeDetails.summary || '').trim();
                            if (summaryText) {
                                summaries.push({
                                    context: contextName,
                                    title: nodeDetails.title || contextName,
                                    summary: summaryText,
                                    type: 'node'
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error resolving context "@${contextName}":`, error);
            warnings.push(`Error resolving "@${contextName}": ${error.message}`);
        }
    }

    const limitedSummaries = summaries.slice(0, MAX_SUMMARY_COUNT);
    const contextData = limitedSummaries
        .map((entry, idx) => `${idx + 1}. [@${entry.context}] ${entry.title} - ${entry.summary}`)
        .join('\n');

    return {
        resolvedContexts,
        summaries: limitedSummaries,
        contextData,
        warnings
    };
}

/**
 * Build system prompt for context-aware AI
 */
export function buildContextSystemPrompt(contextData = '', includeWarnings = true) {
    const basePrompt = [
        'You are a helpful AI assistant for a knowledge management workspace called Lattice.',
        'Answer questions based ONLY on the provided context below.',
        'If the context does not contain the information needed to answer, say so honestly.',
        'Keep responses concise and focused.'
    ];

    if (contextData && contextData.trim()) {
        basePrompt.push(
            '\n--- PROVIDED CONTEXT ---',
            contextData,
            '\n--- END CONTEXT ---\n'
        );
    }

    if (includeWarnings) {
        basePrompt.push(
            '\nIf the context is incomplete or empty, mention that when answering.'
        );
    }

    return basePrompt.join('\n');
}

/**
 * Validate that contexts were actually resolved
 */
export function hasValidContextData(resolvedContexts = []) {
    return Array.isArray(resolvedContexts) && resolvedContexts.length > 0;
}
