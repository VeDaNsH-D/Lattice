window.addEventListener("message", (event) => {
    if (event.source !== window) {
        return;
    }

    if (event.data?.type !== "GET_BOOKMARKS") {
        return;
    }

    chrome.runtime.sendMessage({ type: "GET_BOOKMARKS_TREE" }, (response) => {
        const runtimeError = chrome.runtime.lastError;

        if (runtimeError) {
            window.postMessage(
                {
                    type: "BOOKMARKS_ERROR",
                    error: runtimeError.message || "Extension bridge error",
                },
                "*"
            );
            return;
        }

        if (!response?.ok) {
            window.postMessage(
                {
                    type: "BOOKMARKS_ERROR",
                    error: response?.error || "Unable to fetch bookmarks",
                },
                "*"
            );
            return;
        }

        window.postMessage(
            {
                type: "BOOKMARKS_DATA",
                tree: Array.isArray(response.tree) ? response.tree : [],
            },
            "*"
        );
    });
});
