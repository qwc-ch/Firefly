const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const UID = process.env.BILIBILI_UID || "3546591015209640";
const FILTER_KEYWORDS = (process.env.FILTER_KEYWORDS || "投票,抽奖")
  .split(",").map(k => k.trim()).filter(Boolean);
const MAX_PAGES = Math.min(Number(process.env.MAX_PAGES) || 5, 50);
const DYNAMIC_DIR = "src/content/dynamic";
const CACHE_PATH = path.join(__dirname, ".bilibili_cache.json");

function randomBuvid3() {
  const s = () => Math.floor(Math.random() * 16).toString(16);
  return Array.from({ length: 8 }, s).join("") + "-"
    + Array.from({ length: 4 }, s).join("") + "-"
    + Array.from({ length: 4 }, s).join("") + "-"
    + Array.from({ length: 4 }, s).join("") + "-"
    + Array.from({ length: 12 }, s).join("");
}

const API_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "Accept-Encoding": "gzip, deflate",
  "Referer": `https://space.bilibili.com/${UID}/dynamic`,
  "Cookie": `buvid3=${randomBuvid3()}`,
};

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

async function fetchPage(offset) {
  const params = new URLSearchParams({ host_mid: UID });
  if (offset) params.set("offset", offset);

  const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?${params}`;
  const resp = await fetch(url, { headers: API_HEADERS });

  if (!resp.ok) {
    console.error(`  HTTP ${resp.status}`);
    return null;
  }

  const json = await resp.json();
  if (json.code !== 0) {
    console.error(`  API error: ${json.code} ${json.message || ""}`);
    return null;
  }

  return json.data;
}

async function fetchDynamics() {
  const allItems = [];
  const seen = new Set();
  let offset = "";
  let pageRetries = 0;

  for (let i = 0; i < MAX_PAGES; i++) {
    console.log(`\n\uD83D\uDCC4 请求第 ${i + 1} 页${offset ? ` (offset: ${offset.slice(0, 10)}...)` : ""}`);

    try {
      const data = await fetchPage(offset);
      if (!data || !data.items || data.items.length === 0) {
        console.log("  无数据，停止");
        break;
      }

      let newCount = 0;
      for (const item of data.items) {
        if (!seen.has(item.id_str)) {
          seen.add(item.id_str);
          allItems.push(item);
          newCount++;
        }
      }
      console.log(`  返回 ${data.items.length} 条，新增 ${newCount} 条`);

      offset = data.offset || "";
      if (!offset || !data.has_more) {
        console.log("  无更多页");
        break;
      }
      pageRetries = 0;
    } catch (err) {
      console.error(`  请求失败: ${err.message}`);
      pageRetries++;
      if (pageRetries >= 3) break;
      await new Promise(r => setTimeout(r, 2000));
    }
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
