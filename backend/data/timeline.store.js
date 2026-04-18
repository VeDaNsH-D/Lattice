// In-memory storage for the standalone timeline engine.

const now = new Date().toISOString();

const mockLink = {
    id: "1",
    url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
    title: "Test Link",
    created_at: now,
    last_viewed_at: null,
};

export const timelineStore = {
    links: [mockLink],
    snapshots: [],
    events: [],
};

export function getMockLink() {
    return timelineStore.links[0];
}
