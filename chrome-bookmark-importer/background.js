chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "GET_BOOKMARKS_TREE") {
        return false;
    }

    chrome.bookmarks.getTree((tree) => {
        const runtimeError = chrome.runtime.lastError;

        if (runtimeError) {
            sendResponse({
                ok: false,
                error: runtimeError.message || "Failed to read bookmarks",
            });
            return;
        }

        sendResponse({
            ok: true,
            tree: Array.isArray(tree) ? tree : [],
        });
    });

    return true;
});
