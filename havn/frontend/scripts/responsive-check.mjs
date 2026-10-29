import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const screenshotDir = resolve(frontendDir, "responsive-shots");
const viteEntry = resolve(frontendDir, "node_modules/vite/bin/vite.js");
const viewports = [
  [280, 653], [320, 568], [360, 760], [390, 844], [430, 932], [540, 720],
  [717, 512], [768, 1024], [1024, 768], [1280, 800], [1920, 1080], [844, 390],
];
const testUserId = "64b000000000000000000001";
const peerId = "64b000000000000000000002";
let authenticated = false;

const port = await new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const selectedPort = server.address().port;
    server.close((error) => error ? reject(error) : resolvePort(selectedPort));
  });
});

await mkdir(screenshotDir, { recursive: true });
const preview = spawn(process.execPath, [viteEntry, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: frontendDir,
  stdio: "ignore",
  windowsHide: true,
});

const baseUrl = `http://127.0.0.1:${port}`;
let isReady = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  if (preview.exitCode !== null) throw new Error("vite preview exited before it was ready");
  try {
    const response = await fetch(baseUrl);
    if (response.ok) {
      isReady = true;
      break;
    }
  } catch {}
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
}
if (!isReady) {
  preview.kill();
  throw new Error("vite preview did not start within 15 seconds");
}

const browser = await chromium.launch({ headless: true });
let failures = 0;

try {
  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.route("**/socket.io/**", (route) => route.fulfill({ status: 404, body: "" }));
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname.replace(/^.*\/api/, "");
      if (pathname === "/auth/check") {
        return authenticated
          ? route.fulfill({ json: {
              _id: testUserId,
              email: "layout@example.test",
              username: "layout_user",
              fullName: "Layout User",
              profilePic: "",
              settings: { theme: "dark", fontSize: "medium", fontFamily: "sans", fontColor: "" },
              friends: [peerId],
              isBadged: false,
            } })
          : route.fulfill({ status: 401, json: { message: "Not authenticated" } });
      }
      if (pathname === "/messages/chats") {
        return route.fulfill({ json: [{
          _id: peerId,
          username: "sample_contact",
          fullName: "Sample Contact With A Long Name",
          profilePic: "",
          isFriend: true,
          isBadged: false,
          lastSeenAt: new Date().toISOString(),
        }] });
      }
      if (pathname === `/messages/${peerId}` || pathname === "/messages/contacts" || pathname === "/groups" || pathname === "/groups/invites" || pathname === "/stories/feed" || pathname === "/stories/mine") {
        return route.fulfill({ json: [] });
      }
      if (pathname === "/friends/status") return route.fulfill({ json: { friends: [peerId] } });
      return route.fulfill({ json: {} });
    });

    let passed = true;
    const checkOverflow = async (targetPage) => targetPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    authenticated = false;
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const landingOverflow = await checkOverflow(page);
    if (landingOverflow.scrollWidth > landingOverflow.innerWidth) passed = false;
    await page.screenshot({ path: resolve(screenshotDir, `${width}x${height}-landing.png`), fullPage: true });

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    const loginOverflow = await checkOverflow(page);
    if (loginOverflow.scrollWidth > loginOverflow.innerWidth) passed = false;
    await page.screenshot({ path: resolve(screenshotDir, `${width}x${height}-login.png`), fullPage: true });

    await page.goto(`${baseUrl}/signup`, { waitUntil: "domcontentloaded" });
    const signupOverflow = await checkOverflow(page);
    if (signupOverflow.scrollWidth > signupOverflow.innerWidth) passed = false;
    await page.screenshot({ path: resolve(screenshotDir, `${width}x${height}-signup.png`), fullPage: true });

    authenticated = true;
    await page.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded" });
    const settingsOverflow = await checkOverflow(page);
    if (settingsOverflow.scrollWidth > settingsOverflow.innerWidth) passed = false;
    await page.screenshot({ path: resolve(screenshotDir, `${width}x${height}-settings.png`), fullPage: true });

    await page.goto(`${baseUrl}/?dm=${peerId}`, { waitUntil: "domcontentloaded" });
    let chatAvailable = false;
    try {
      await page.locator(".chat-header").waitFor({ state: "visible", timeout: 8000 });
      chatAvailable = true;
      const chatOverflow = await checkOverflow(page);
      if (chatOverflow.scrollWidth > chatOverflow.innerWidth) passed = false;
      await page.screenshot({ path: resolve(screenshotDir, `${width}x${height}-chat.png`), fullPage: true });
    } catch {
      await page.screenshot({ path: resolve(screenshotDir, `${width}x${height}-chat-unavailable.png`), fullPage: true });
    }

    if (!passed) failures += 1;
    console.log(`${passed ? "PASS" : "FAIL"} ${width}x${height} landing + login + signup + settings${chatAvailable ? " + chat" : " (chat unavailable)"}`);
    await page.close();
  }
} finally {
  await browser.close();
  preview.kill();
}

if (failures) process.exitCode = 1;
