const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");

const UID = process.env.BILIBILI_UID || "3546591015209640";
const FILTER_KEYWORDS = (process.env.FILTER_KEYWORDS || "投票,抽奖")
  .split(",").map(k => k.trim()).filter(Boolean);
const MAX_PAGES = Math.min(Number(process.env.MAX_PAGES) || 5, 50);
const DYNAMIC_DIR = "src/content/dynamic";
const CACHE_PATH = path.join(__dirname, ".bilibili_cache.json");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
  return result;
}

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")); }
  catch { return { ids: [], lastSync: null }; }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8");
}

function formatTime(ts) {
  const d = new Date(ts * 1000);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return {
    file: `${Y}-${M}-${D}-${h}${m}${s}.md`,
    front: `${Y}-${M}-${D} ${h}:${m}:${s}`,
  };
}

function shouldFilter(item) {
  if (item.type === "DYNAMIC_TYPE_FORWARD") {
    console.log(`  \u23ed 转发动态: ${item.id_str}`);
    return true;
  }
  const desc = item.modules?.module_dynamic?.desc?.text || "";
  const opus = item.modules?.module_dynamic?.major?.opus?.summary?.text || "";
  const fullText = (desc + " " + opus).toLowerCase();
  for (const kw of FILTER_KEYWORDS) {
    if (fullText.includes(kw.toLowerCase())) {
      console.log(`  \u23ed 关键词"${kw}"命中: ${item.id_str}`);
      return true;
    }
  }
  return false;
}

function parseItem(item) {
  const id = item.id_str;
  const ts = item.modules?.module_author?.pub_ts;
  if (!id || !ts) return null;
  const { file, front } = formatTime(ts);
  const mod = item.modules?.module_dynamic;
  if (!mod) return null;
  let text = "";
  const images = [];
  const major = mod.major;
  if (major?.type === "MAJOR_TYPE_OPUS" && major?.opus) {
    text = major.opus.summary?.text || "";
    if (major.opus.pics) {
      for (const pic of major.opus.pics) {
        if (pic.url) images.push(pic.url);
      }
    }
  } else if (major?.type === "MAJOR_TYPE_DRAW" && major?.draw) {
    text = mod.desc?.text || "";
    for (const drawItem of major.draw.items) {
      if (drawItem.src) images.push(drawItem.src);
    }
  } else {
    text = mod.desc?.text || "";
  }
  text = text.trim();
  if (!text && images.length === 0) return null;
  const body = [text];
  images.forEach((url, i) => body.push(`![图片${i + 1}](${url})`));
  return { id, file, front, body: body.join("\n") };
}

async function fetchDynamics() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "zh-CN",
  });
  const page = await ctx.newPage();

  const allItems = [];
  const seenIds = new Set();
  let offset = "";

  try {
    console.log(`\n\uD83C\uDF10 访问 B站空间: https://space.bilibili.com/${UID}/dynamic`);
    await page.goto(`https://space.bilibili.com/${UID}/dynamic`, {
      waitUntil: "load",
      timeout: 30000,
    });
    await page.waitForTimeout(4000);

    for (let i = 0; i < MAX_PAGES; i++) {
      console.log(`\n\uD83D\uDCC4 请求第 ${i + 1} 页${offset ? ` (offset: ${offset.slice(0, 10)}...)` : ""}`);

      const apidata = await page.evaluate(async ({ uid, off }) => {
        const params = new URLSearchParams({ host_mid: uid });
        if (off) params.set("offset", off);
        const resp = await fetch(
          "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?" + params,
          { credentials: "include", headers: { Accept: "application/json, text/plain, */*" } }
        );
        return await resp.json();
      }, { uid: UID, off: offset });

      if (apidata.code !== 0) {
        console.log(`  API 错误: ${apidata.code} ${apidata.message || ""}`);
        break;
      }
      if (!apidata.data?.items || apidata.data.items.length === 0) {
        console.log("  无数据");
        break;
      }

      let newCount = 0;
      for (const item of apidata.data.items) {
        if (!seenIds.has(item.id_str)) {
          seenIds.add(item.id_str);
          allItems.push(item);
          newCount++;
        }
      }
      console.log(`  返回 ${apidata.data.items.length} 条，新增 ${newCount} 条`);

      offset = apidata.data.offset || "";
      if (!offset || !apidata.data.has_more) {
        console.log("  无更多页");
        break;
      }
      await page.waitForTimeout(1500);
    }
  } catch (err) {
    console.error("浏览器异常:", err.message);
  } finally {
    await browser.close();
  }

  return allItems;
}

async function main() {
  const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();
  const dynamicDir = path.join(repoRoot, DYNAMIC_DIR);
  if (!fs.existsSync(dynamicDir)) fs.mkdirSync(dynamicDir, { recursive: true });

  const cache = loadCache();
  const knownIds = new Set(cache.ids);
  console.log(`\uD83D\uDCE6 本地缓存: ${knownIds.size} 条已知动态`);
  console.log(`\uD83D\uDD0D 过滤关键词: ${FILTER_KEYWORDS.length ? FILTER_KEYWORDS.join(", ") : "(无)"}`);

  const items = await fetchDynamics();
  console.log(`\n\uD83D\uDCCA 去重后共 ${items.length} 条动态`);

  const newFiles = [];
  let filtered = 0, skipped = 0;

  for (const item of items) {
    if (knownIds.has(item.id_str)) { skipped++; continue; }
    if (shouldFilter(item)) { filtered++; continue; }
    const parsed = parseItem(item);
    if (!parsed) continue;

    const filePath = path.join(dynamicDir, parsed.file);
    let finalPath = filePath;

    if (fs.existsSync(filePath)) {
      const altName = parsed.file.replace(".md", `-${parsed.id.slice(-6)}.md`);
      finalPath = path.join(dynamicDir, altName);
      if (fs.existsSync(finalPath)) { skipped++; continue; }
    }

    fs.writeFileSync(finalPath, `---\npublished: ${parsed.front}\n---\n\n${parsed.body}\n`, "utf8");
    newFiles.push(finalPath);
    knownIds.add(parsed.id);
    console.log(`  \u2705 ${path.basename(finalPath)}`);
  }

  console.log(`\n\uD83D\uDCCB 新增 ${newFiles.length}, 过滤 ${filtered}, 已存在 ${skipped}`);

  cache.ids = [...knownIds];
  cache.lastSync = new Date().toISOString();
  saveCache(cache);

  if (newFiles.length === 0) {
    console.log("\u2139\uFE0F 没有新动态");
    return;
  }

  const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot })
    .stdout.toString().trim() || "master";

  run("git", ["config", "user.name", "github-actions[bot]"], { cwd: repoRoot });
  run("git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"], { cwd: repoRoot });
  for (const f of newFiles) run("git", ["add", f], { cwd: repoRoot });
  run("git", ["add", CACHE_PATH], { cwd: repoRoot });

  if (spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: repoRoot }).status === 0) {
    console.log("\u2139\uFE0F 无变更");
    return;
  }

  run("git", ["commit", "-m", `\uD83D\uDCE5 同步B站动态 (${newFiles.length}条)`], { cwd: repoRoot });
  run("git", ["pull", "--rebase", "--autostash", "origin", branch], { cwd: repoRoot });
  run("git", ["push", "origin", `HEAD:${branch}`], { cwd: repoRoot });
  console.log(`\uD83D\uDE80 成功推送 ${newFiles.length} 条新动态`);
}

main().catch((err) => {
  console.error("\n\u274C 异常:", err);
  process.exit(1);
});
