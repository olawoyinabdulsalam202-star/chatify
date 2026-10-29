import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const screenshotDir = resolve(frontendDir, "responsive-shots");
const viteEntry = resolve(frontendDir, "node_modules/vite/bin/vite.js");
const viewports = [[360, 640], [390, 844], [412, 915]];
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
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
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
    const errors = [];
    const checkOverflow = async (targetPage) => targetPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    authenticated = true;
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const profileHeader = page.locator(".profile-header");
    const chatListRow = page.locator(".chat-list-row").first();
    try {
      await profileHeader.waitFor({ state: "visible", timeout: 10000 });
      await chatListRow.waitFor({ state: "visible", timeout: 10000 });
    } catch {
      passed = false;
      errors.push("mocked chat layout did not load");
    }

    const overflow = await checkOverflow(page);
    if (overflow.scrollWidth > overflow.innerWidth) {
      passed = false;
      errors.push(`document width ${overflow.scrollWidth}px exceeds viewport ${overflow.innerWidth}px`);
    }

    const profileAvailable = await profileHeader.isVisible().catch(() => false);
    const rowAvailable = await chatListRow.isVisible().catch(() => false);
    if (profileAvailable) {
    const profileCheck = await profileHeader.evaluate((header) => {
      const name = header.querySelector("h3");
      const nameText = header.querySelector("h3 > span");
      const status = header.querySelector(".profile-secondary");
      const nameWidth = nameText?.getBoundingClientRect().width || 0;
      const statusStyle = status ? getComputedStyle(status) : null;
      const statusWraps = status && statusStyle.whiteSpace !== "nowrap"
        && status.getBoundingClientRect().height > parseFloat(statusStyle.lineHeight || "0") * 1.5;
      const textWrapsOneCharacterPerLine = [
        ...header.querySelectorAll("h3, .profile-secondary"),
        ...document.querySelectorAll(".chat-list-row h4, .chat-list-row p"),
      ].some((element) => {
        const text = element.textContent.trim();
        if (text.length < 4) return false;
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length >= text.length - 1;
      });
      return { nameWidth, statusWraps, textWrapsOneCharacterPerLine };
    });
    if (profileCheck.nameWidth < 60) {
      passed = false;
      errors.push(`profile name width is ${Math.round(profileCheck.nameWidth)}px`);
    }
    if (profileCheck.statusWraps) {
      passed = false;
      errors.push("profile status wraps vertically");
    }
    if (profileCheck.textWrapsOneCharacterPerLine) {
      passed = false;
      errors.push("text wraps one character per line");
    }

    await profileHeader.screenshot({ path: resolve(screenshotDir, `${width}x${height}-profile.png`) });
    } else {
      await page.screenshot({ path: resolve(screenshotDir, `${width}x${height}-profile-unavailable.png`) });
    }
    if (rowAvailable) {
      const listPane = page.locator("div.overflow-y-auto").first();
      await listPane.screenshot({ path: resolve(screenshotDir, `${width}x${height}-chat-list.png`) });
      await page.addStyleTag({ content: ":root { --safe-area-bottom: 24px; }" });
      await chatListRow.click();
      const inputBar = page.locator(".chat-input-bar").first();
      await inputBar.waitFor({ state: "visible", timeout: 10000 });
      const mobileMetrics = await page.evaluate(() => ({
        inputBottom: document.querySelector(".chat-input-bar")?.getBoundingClientRect().bottom,
        innerHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
      }));
      if (mobileMetrics.inputBottom > mobileMetrics.innerHeight) {
        passed = false;
        errors.push(`input bottom ${Math.round(mobileMetrics.inputBottom)}px exceeds viewport ${mobileMetrics.innerHeight}px`);
      }
      if (mobileMetrics.documentHeight > mobileMetrics.innerHeight) {
        passed = false;
        errors.push(`document height ${mobileMetrics.documentHeight}px exceeds viewport ${mobileMetrics.innerHeight}px`);
      }
    } else {
      await page.screenshot({ path: resolve(screenshotDir, `${width}x${height}-chat-list-unavailable.png`) });
    }

    if (!passed) failures += 1;
    console.log(`${passed ? "PASS" : "FAIL"} ${width}x${height}${errors.length ? `: ${errors.join("; ")}` : ""}`);
    await page.close();
  }
} finally {
  await browser.close();
  preview.kill();
}

if (failures) process.exitCode = 1;
