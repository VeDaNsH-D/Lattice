const PROJECTS_API_URL = "http://localhost:8000/api/projects";
const ROLES_API_URL = "http://localhost:8000/api/roles";
const SAVE_API_URL = "http://localhost:8000/api/bookmarks/import";
const AUTH_STORAGE_KEY = "authToken";
const AUTH_KEYS = ["token", "latticeToken"];
const BOOKMARK_SIGNAL_KEY = "bookmarkSaveSignal";

const pageTitleEl = document.getElementById("pageTitle");
const pageUrlEl = document.getElementById("pageUrl");
const projectSelectEl = document.getElementById("projectSelect");
const accessSectionEl = document.getElementById("accessSection");
const accessTypeSelectEl = document.getElementById("accessTypeSelect");
const rolesSectionEl = document.getElementById("rolesSection");
const rolesContainerEl = document.getElementById("rolesContainer");
const rolesEmptyTextEl = document.getElementById("rolesEmptyText");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

let currentPage = { url: "", title: "" };
let projects = [];
let authToken = "";
let selectedRoleIds = [];
const roleCacheByProject = new Map();

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b00020" : "#0a7a33";
}

function getCurrentTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      const tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        reject(new Error("Unable to detect current tab."));
        return;
      }

      resolve({
        tabId: tab.id,
        url: tab.url,
        title: tab.title || tab.url,
      });
    });
  });
}

function readTokenFromExtensionStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH_STORAGE_KEY], (items) => {
      resolve(items?.[AUTH_STORAGE_KEY] || "");
    });
  });
}

function saveTokenToExtensionStorage(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [AUTH_STORAGE_KEY]: token }, () => resolve());
  });
}

function getTokenFromPage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: (keys) => {
          try {
            for (const key of keys) {
              const value = window.localStorage.getItem(key);
              if (value) {
                return value;
              }
            }
          } catch (error) {
            return "";
          }

          return "";
        },
        args: [AUTH_KEYS],
      },
      (results) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }

        const token = results?.[0]?.result || "";
        resolve(token);
      }
    );
  });
}

function isLocalFrontendUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url || "");
}

async function resolveAuthToken(tab) {
  const cachedToken = await readTokenFromExtensionStorage();
  if (cachedToken) {
    return cachedToken;
  }

  if (isLocalFrontendUrl(tab.url)) {
    const pageToken = await getTokenFromPage(tab.tabId).catch(() => "");
    if (pageToken) {
      await saveTokenToExtensionStorage(pageToken);
      return pageToken;
    }
  }

  const fallbackToken = await getTokenFromAnyLocalAppTab();
  if (fallbackToken) {
    await saveTokenToExtensionStorage(fallbackToken);
    return fallbackToken;
  }

  throw new Error("No login token found. Keep your app logged in on localhost and reopen popup.");
}

async function getTokenFromAnyLocalAppTab() {
  const tabs = await new Promise((resolve) => {
    chrome.tabs.query({}, (allTabs) => resolve(allTabs || []));
  });

  const appTabs = tabs.filter((candidate) => isLocalFrontendUrl(candidate.url) && Number.isInteger(candidate.id));
  for (const candidate of appTabs) {
    const token = await getTokenFromPage(candidate.id).catch(() => "");
    if (token) {
      return token;
    }
  }

  return "";
}

function normalizeProjects(payload) {
  const personal = Array.isArray(payload?.personalProjects) ? payload.personalProjects : [];
  const collaborative = Array.isArray(payload?.collaborativeProjects) ? payload.collaborativeProjects : [];

  const toProjectOption = (item, fallbackType) => ({
    id: item?.id || item?._id || "",
    name: item?.name || "Untitled Project",
    type: item?.projectType || item?.type || fallbackType,
  });

  return [
    ...personal.map((item) => toProjectOption(item, "personal")),
    ...collaborative.map((item) => toProjectOption(item, "collaborative")),
  ].filter((item) => item.id);
}

function populateProjectSelect(list) {
  projectSelectEl.innerHTML = "";

  if (!list.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No projects available";
    projectSelectEl.appendChild(option);
    projectSelectEl.disabled = true;
    accessSectionEl.style.display = "none";
    rolesSectionEl.style.display = "none";
    return;
  }

  projectSelectEl.disabled = false;
  list.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    projectSelectEl.appendChild(option);
  });

  void updateAccessControls();
}

function getSelectedProject() {
  const selectedProjectId = projectSelectEl.value;
  return projects.find((item) => item.id === selectedProjectId) || null;
}

async function fetchRoles(projectId) {
  if (roleCacheByProject.has(projectId)) {
    return roleCacheByProject.get(projectId);
  }

  const response = await fetch(`${ROLES_API_URL}?projectId=${encodeURIComponent(projectId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || `Roles request failed with status ${response.status}`);
  }

  const roles = Array.isArray(payload?.roles) ? payload.roles : [];
  roleCacheByProject.set(projectId, roles);
  return roles;
}

function renderRoleOptions(roles) {
  rolesContainerEl.innerHTML = "";

  if (!roles.length) {
    rolesContainerEl.style.display = "none";
    rolesEmptyTextEl.style.display = "block";
    return;
  }

  rolesContainerEl.style.display = "block";
  rolesEmptyTextEl.style.display = "none";

  roles.forEach((role) => {
    const roleId = role?.id || role?._id;
    if (!roleId) {
      return;
    }

    const label = document.createElement("label");
    label.className = "role-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = roleId;
    checkbox.checked = selectedRoleIds.includes(roleId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedRoleIds = Array.from(new Set([...selectedRoleIds, roleId]));
      } else {
        selectedRoleIds = selectedRoleIds.filter((id) => id !== roleId);
      }
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${role.name || "Unnamed role"}`));
    rolesContainerEl.appendChild(label);
  });
}

async function updateAccessControls() {
  const selectedProject = getSelectedProject();
  const isCollaborative = selectedProject?.type === "collaborative";

  if (!isCollaborative) {
    accessSectionEl.style.display = "none";
    rolesSectionEl.style.display = "none";
    selectedRoleIds = [];
    return;
  }

  accessSectionEl.style.display = "block";

  if (accessTypeSelectEl.value !== "role_based") {
    rolesSectionEl.style.display = "none";
    selectedRoleIds = [];
    return;
  }

  rolesSectionEl.style.display = "block";

  try {
    const roles = await fetchRoles(selectedProject.id);
    const roleIdSet = new Set(roles.map((role) => role?.id || role?._id).filter(Boolean));
    selectedRoleIds = selectedRoleIds.filter((id) => roleIdSet.has(id));
    renderRoleOptions(roles);
  } catch (error) {
    rolesContainerEl.style.display = "none";
    rolesEmptyTextEl.style.display = "block";
    rolesEmptyTextEl.textContent = error.message || "Unable to load roles.";
  }
}

function resetRoleEmptyText() {
  rolesEmptyTextEl.textContent = "No roles available for this project.";
}

function clearRoleStateOnProjectChange() {
  selectedRoleIds = [];
  resetRoleEmptyText();
}

async function fetchProjects() {
  const response = await fetch(PROJECTS_API_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  const payload = await response.json().catch(() => null);
  console.log("Projects API response:", { status: response.status, payload });

  if (!response.ok) {
    throw new Error(payload?.message || `Projects request failed with status ${response.status}`);
  }

  projects = normalizeProjects(payload);
  populateProjectSelect(projects);
}

async function saveCurrentBookmark() {
  saveBtn.disabled = true;
  setStatus("Saving bookmark...");

  try {
    const selectedProjectId = projectSelectEl.value;
    if (!selectedProjectId) {
      throw new Error("Please select a project.");
    }

    const selectedProject = getSelectedProject();
    const isCollaborative = selectedProject?.type === "collaborative";
    const accessType = isCollaborative ? accessTypeSelectEl.value : "public";

    if (accessType === "role_based" && selectedRoleIds.length === 0) {
      throw new Error("Select at least one role for role-based access.");
    }

    const body = {
      projectId: selectedProjectId,
      bookmarks: [
        {
          url: currentPage.url,
          title: currentPage.title,
        },
      ],
      ...(isCollaborative ? {
        accessType,
        allowedRoles: accessType === "role_based" ? selectedRoleIds : [],
      } : {}),
    };

    const response = await fetch(SAVE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);

    console.log("Save bookmark API response:", {
      status: response.status,
      ok: response.ok,
      payload,
    });

    if (!response.ok) {
      const message = payload?.message || `Request failed with status ${response.status}`;
      setStatus(`Save failed: ${message}`, true);
      return;
    }

    await notifyAppTabsBookmarkSaved(selectedProjectId);
    setStatus("Bookmark saved successfully.");
    setTimeout(() => window.close(), 700);
  } catch (error) {
    console.error("Save bookmark failed:", error);
    setStatus(`Network or runtime error: ${error.message}`, true);
  } finally {
    saveBtn.disabled = false;
  }
}

async function notifyAppTabsBookmarkSaved(projectId) {
  const tabs = await new Promise((resolve) => {
    chrome.tabs.query({}, (allTabs) => resolve(allTabs || []));
  });

  const appTabs = tabs.filter((tab) => isLocalFrontendUrl(tab.url) && Number.isInteger(tab.id));
  if (!appTabs.length) {
    return;
  }

  const signal = {
    projectId,
    ts: Date.now(),
  };

  const runScript = (tabId) =>
    new Promise((resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: (key, detail) => {
            try {
              window.localStorage.setItem(key, JSON.stringify(detail));
              window.dispatchEvent(new CustomEvent("bookmark:saved", { detail }));
              return true;
            } catch (error) {
              return false;
            }
          },
          args: [BOOKMARK_SIGNAL_KEY, signal],
        },
        () => {
          resolve();
        }
      );
    });

  await Promise.all(appTabs.map((tab) => runScript(tab.id)));
}

async function initializePopup() {
  setStatus("Loading...");

  try {
    currentPage = await getCurrentTab();
    pageTitleEl.textContent = currentPage.title;
    pageUrlEl.textContent = currentPage.url;

    authToken = await resolveAuthToken(currentPage);

    await fetchProjects();
    setStatus("Ready");
  } catch (error) {
    console.error("Popup initialization failed:", error);
    setStatus(error.message || "Failed to initialize extension.", true);
  }
}

projectSelectEl.addEventListener("change", async () => {
  clearRoleStateOnProjectChange();
  await updateAccessControls();
});
accessTypeSelectEl.addEventListener("change", async () => {
  clearRoleStateOnProjectChange();
  await updateAccessControls();
});
saveBtn.addEventListener("click", saveCurrentBookmark);

initializePopup();
