const API_URL = "http://localhost:8000/api/bookmarks/import";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWUzNTZjMjA1YzllYjc3ZTI3NDFkZGQiLCJpYXQiOjE3NzY1MjI0NDAsImV4cCI6MTc3NzEyNzI0MH0.IEfFXSWzkkk9AdeG2mqolZNsy7q0U6fKSbTMs9eNbpY";
const PROJECT_ID = "69e3899841eb238c6dcafa67";

const importBtn = document.getElementById("importBtn");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b00020" : "#0a7a33";
}

function getBookmarkTree() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(tree || []);
    });
  });
}

async function importAllBookmarks() {
  importBtn.disabled = true;
  setStatus("Loading bookmarks...");

  try {
    const tree = await getBookmarkTree();

    setStatus("Sending to backend...");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        tree
      })
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      payload = null;
    }

    console.log("Import API response:", {
      status: response.status,
      ok: response.ok,
      payload,
    });

    if (!response.ok) {
      const message = payload?.message || `Request failed with status ${response.status}`;
      setStatus(`Import failed: ${message}`, true);
      return;
    }

    if (!payload) {
      setStatus("Import failed: empty response from server", true);
      return;
    }

    const imported = Number.isFinite(payload.imported) ? payload.imported : "?";
    setStatus(`Imported: ${imported}`);
  } catch (error) {
    console.error("Bookmark import failed:", error);
    setStatus(`Network or runtime error: ${error.message}`, true);
  } finally {
    importBtn.disabled = false;
  }
}

importBtn.addEventListener("click", importAllBookmarks);
