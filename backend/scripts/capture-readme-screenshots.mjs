import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const FRONTEND_URL = process.env.FRONTEND_URL_FOR_SHOTS || "http://127.0.0.1:5173";
const API_BASE = process.env.API_BASE_FOR_SHOTS || "http://127.0.0.1:8000/api";
const SCREENSHOT_DIR = path.resolve(process.cwd(), "../docs/screenshots");

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const waitForRender = async (page, delay = 1200) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(delay);
};

const saveShot = async (page, fileName) => {
  const target = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: target, fullPage: true });
  return target;
};

const registerUser = async () => {
  const nonce = Date.now();
  const email = `readme.user.${nonce}@example.com`;
  const password = "Passw0rd!23";

  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "README Demo User",
      email,
      password,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.token) {
    throw new Error(payload?.message || `Failed to register demo user (${response.status}).`);
  }

  return payload.token;
};

const createCollaborativeProject = async (token) => {
  const response = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "README Showcase Project",
      projectType: "collaborative",
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.project?.id) {
    throw new Error(payload?.message || `Failed to create demo project (${response.status}).`);
  }

  return payload.project.id;
};

const run = async () => {
  await ensureDir(SCREENSHOT_DIR);

  const browser = await chromium.launch({ headless: true });

  try {
    const publicContext = await browser.newContext({ viewport: { width: 1600, height: 980 } });
    const publicPage = await publicContext.newPage();

    await publicPage.goto(`${FRONTEND_URL}/`, { waitUntil: "domcontentloaded" });
    await waitForRender(publicPage, 1600);
    await saveShot(publicPage, "landing-page.png");

    await publicPage.goto(`${FRONTEND_URL}/login`, { waitUntil: "domcontentloaded" });
    await waitForRender(publicPage, 1200);
    await saveShot(publicPage, "auth-login.png");

    await publicContext.close();

    const token = await registerUser();
    const projectId = await createCollaborativeProject(token);

    const appContext = await browser.newContext({ viewport: { width: 1600, height: 980 } });
    await appContext.addInitScript((authToken) => {
      window.localStorage.setItem("token", authToken);
    }, token);

    const appPage = await appContext.newPage();

    await appPage.goto(`${FRONTEND_URL}/lattice`, { waitUntil: "domcontentloaded" });
    await waitForRender(appPage, 1800);
    await saveShot(appPage, "dashboard-home.png");

    await appPage.goto(`${FRONTEND_URL}/lattice/project/${projectId}`, { waitUntil: "domcontentloaded" });
    await waitForRender(appPage, 2000);
    await saveShot(appPage, "project-workspace.png");

    await appContext.close();

    console.log("README screenshots generated successfully.");
    console.log(`Output directory: ${SCREENSHOT_DIR}`);
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
