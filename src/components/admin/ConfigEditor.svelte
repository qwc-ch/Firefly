<script lang="ts">
import { friendsConfig } from "@/config/friendsConfig";
import { getIconSvg } from "@/constants/icons";
import { friendsConfigApi, siteConfigApi } from "@/lib/api";

let config = $state<Record<string, unknown>>({});
let friends = $state<Record<string, unknown>[]>([]);
let friendsPage = $state<Record<string, unknown>>({});
let sha = $state("");
let friendsSha = $state("");
let loading = $state(true);
let saving = $state(false);
let message = $state("");
let messageType = $state<"success" | "error">("success");
let openSections = $state<Set<string>>(new Set(["main"]));

$effect(() => {
	loadConfig();
});

async function loadConfig() {
	loading = true;
	try {
		const [siteRes, friendsRes] = await Promise.all([
			siteConfigApi.get(),
			friendsConfigApi.get().catch(() => ({
				friends: friendsConfig.map((f) => ({ ...f })),
				friendsPage: {},
				sha: "",
			})),
		]);
		config = siteRes.config;
		friends = (friendsRes.friends as Record<string, unknown>[])?.length
			? (friendsRes.friends as Record<string, unknown>[])
			: friendsConfig.map((f) => ({ ...f }));
		friendsPage = (friendsRes.friendsPage as Record<string, unknown>) || {};
		sha = siteRes.sha;
		friendsSha = friendsRes.sha;
	} catch (err: unknown) {
		message = err instanceof Error ? err.message : "加载失败";
		messageType = "error";
	} finally {
		loading = false;
	}
}

async function handleSave() {
	saving = true;
	try {
		const { friends: _f, friendsPage: _fp, ...siteConfigData } = config;
		await Promise.all([
			siteConfigApi.save(siteConfigData, sha, "Update site config via admin"),
			friendsConfigApi.save(
				friends as unknown[],
				friendsPage,
				friendsSha,
				"Update friends config via admin",
			),
		]);
		const [siteRes, friendsRes] = await Promise.all([
			siteConfigApi.get(),
			friendsConfigApi.get(),
		]);
		sha = siteRes.sha;
		friendsSha = friendsRes.sha;
		message = "配置已保存并提交到 GitHub";
		messageType = "success";
		setTimeout(() => (message = ""), 3000);
	} catch (err: unknown) {
		message = err instanceof Error ? err.message : "保存失败";
		messageType = "error";
		try {
			const [siteRes, friendsRes] = await Promise.all([
				siteConfigApi.get(),
				friendsConfigApi.get(),
			]);
			sha = siteRes.sha;
			friendsSha = friendsRes.sha;
		} catch {
			// ignore refresh errors
		}
	} finally {
		saving = false;
	}
}

function toggleSection(id: string) {
	if (openSections.has(id)) {
		openSections.delete(id);
	} else {
		openSections.add(id);
	}
	openSections = new Set(openSections);
}

function setNested(path: string, value: unknown) {
	const keys = path.split(".");
	let obj = config;
	for (let i = 0; i < keys.length - 1; i++) {
		obj = obj[keys[i]];
	}
	obj[keys[keys.length - 1]] = value;
	config = { ...config };
}

function getNested(path: string): unknown {
	const keys = path.split(".");
	let obj = config;
	for (const key of keys) {
		obj = obj?.[key];
	}
	return obj;
}
</script>

<div class="page">
  <div class="page-header">
    <h2 class="page-title">站点配置</h2>
    <button class="btn-save" onclick={handleSave} disabled={saving || loading}>
      <i class="icon" style="font-size:16px">{@html getIconSvg("material-symbols:save")}</i>
      <span>{saving ? '保存中...' : '保存到 GitHub'}</span>
    </button>
  </div>

  {#if message}
    <div class="message" class:message-error={messageType === 'error'}>{message}</div>
  {/if}

  {#if loading}
    <div class="empty-state">加载配置中...</div>
  {:else}
    <div class="sections">
      <!-- 主要设置 -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('main')}>
          <span class="section-dot" style="background: var(--primary)"></span>
          <span class="section-title">主要设置</span>
          <i class="icon section-arrow" class:open={openSections.has('main')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('main')}
          <div class="section-body">
            <div class="field">
              <label class="field-label">站点标题</label>
              <input class="field-input" value={config.title || ''} oninput={(e) => setNested('title', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field-label">副标题</label>
              <input class="field-input" value={config.subtitle || ''} oninput={(e) => setNested('subtitle', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field-label">站点 URL</label>
              <input class="field-input" value={config.site_url || ''} oninput={(e) => setNested('site_url', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field-label">站点描述</label>
              <textarea class="field-input field-textarea" rows="2" oninput={(e) => setNested('description', (e.target as HTMLTextAreaElement).value)}>{config.description || ''}</textarea>
            </div>
            <div class="field">
              <label class="field-label">站点语言</label>
              <select class="field-input" onchange={(e) => setNested('lang', (e.target as HTMLSelectElement).value)}>
                {#each ['zh_CN', 'zh_TW', 'en', 'ja', 'ru'] as lang}
                  <option value={lang} selected={config.lang === lang}>{lang}</option>
                {/each}
              </select>
            </div>
            <div class="field">
              <label class="field-label">时区</label>
              <input class="field-input" value={config.timezone || ''} oninput={(e) => setNested('timezone', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field-label">站点开始日期</label>
              <input class="field-input" type="date" value={config.siteStartDate || ''} oninput={(e) => setNested('siteStartDate', (e.target as HTMLInputElement).value)} />
            </div>
          </div>
        {/if}
      </div>

      <!-- 主题色 -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('theme')}>
          <span class="section-dot" style="background: oklch(0.70 0.14 {config.themeColor?.hue || 330})"></span>
          <span class="section-title">主题色</span>
          <i class="icon section-arrow" class:open={openSections.has('theme')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('theme')}
          <div class="section-body">
            <div class="field">
              <label class="field-label">色相值 (0-360)</label>
              <div class="field-row">
                <input class="field-input" type="range" min="0" max="360" value={config.themeColor?.hue || 330} oninput={(e) => setNested('themeColor.hue', Number((e.target as HTMLInputElement).value))} />
                <span class="field-value">{config.themeColor?.hue || 330}</span>
              </div>
            </div>
            <div class="field">
              <label class="field-label">默认模式</label>
              <div class="field-row">
                {#each ['light', 'dark', 'system'] as mode}
                  <label class="radio-label">
                    <input type="radio" name="defaultMode" value={mode} checked={config.themeColor?.defaultMode === mode} onchange={() => setNested('themeColor.defaultMode', mode)} />
                    <span>{mode === 'light' ? '亮色' : mode === 'dark' ? '暗色' : '跟随系统'}</span>
                  </label>
                {/each}
              </div>
            </div>
            <div class="field">
              <label class="field-label">固定主题色（隐藏选择器）</label>
              <label class="toggle">
                <input type="checkbox" checked={config.themeColor?.fixed || false} onchange={(e) => setNested('themeColor.fixed', (e.target as HTMLInputElement).checked)} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        {/if}
      </div>

      <!-- 导航栏 -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('navbar')}>
          <span class="section-dot" style="background: var(--btn-content)"></span>
          <span class="section-title">导航栏</span>
          <i class="icon section-arrow" class:open={openSections.has('navbar')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('navbar')}
          <div class="section-body">
            <div class="field">
              <label class="field-label">导航栏标题</label>
              <input class="field-input" value={config.navbar?.title || ''} oninput={(e) => setNested('navbar.title', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field-label">菜单对齐</label>
              <div class="field-row">
                {#each ['left', 'center'] as align}
                  <label class="radio-label">
                    <input type="radio" name="menuAlign" value={align} checked={config.navbar?.menuAlign === align} onchange={() => setNested('navbar.menuAlign', align)} />
                    <span>{align === 'left' ? '左对齐' : '居中'}</span>
                  </label>
                {/each}
              </div>
            </div>
            <div class="field">
              <label class="field-label">固定导航栏</label>
              <label class="toggle">
                <input type="checkbox" checked={config.navbar?.stickyNavbar ?? true} onchange={(e) => setNested('navbar.stickyNavbar', (e.target as HTMLInputElement).checked)} />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="field">
              <label class="field-label">全宽导航栏</label>
              <label class="toggle">
                <input type="checkbox" checked={config.navbar?.widthFull || false} onchange={(e) => setNested('navbar.widthFull', (e.target as HTMLInputElement).checked)} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        {/if}
      </div>

      <!-- 卡片样式 -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('card')}>
          <span class="section-dot" style="background: var(--admonitions-color-note)"></span>
          <span class="section-title">卡片样式</span>
          <i class="icon section-arrow" class:open={openSections.has('card')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('card')}
          <div class="section-body">
            <div class="field">
              <label class="field-label">卡片边框</label>
              <label class="toggle">
                <input type="checkbox" checked={config.card?.border ?? true} onchange={(e) => setNested('card.border', (e.target as HTMLInputElement).checked)} />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="field">
              <label class="field-label">跟随主题色</label>
              <label class="toggle">
                <input type="checkbox" checked={config.card?.followTheme ?? true} onchange={(e) => setNested('card.followTheme', (e.target as HTMLInputElement).checked)} />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="field">
              <label class="field-label">页面宽度 (rem)</label>
              <input class="field-input" type="number" value={config.pageWidth || 100} oninput={(e) => setNested('pageWidth', Number((e.target as HTMLInputElement).value))} />
            </div>
          </div>
        {/if}
      </div>

      <!-- 页面开关 -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('pages')}>
          <span class="section-dot" style="background: var(--admonitions-color-tip)"></span>
          <span class="section-title">页面开关</span>
          <i class="icon section-arrow" class:open={openSections.has('pages')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('pages')}
          <div class="section-body">
            {#each [
              ['friends', '友链'],
              ['sponsor', '打赏'],
              ['guestbook', '留言板'],
              ['bangumi', '番组计划'],
              ['gallery', '相册'],
              ['anime', '追番'],
            ] as [key, label]}
              <div class="field field-row-between">
                <label class="field-label">{label}</label>
                <label class="toggle">
                  <input type="checkbox" checked={config.pages?.[key] ?? true} onchange={(e) => setNested(`pages.${key}`, (e.target as HTMLInputElement).checked)} />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 分页 -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('pagination')}>
          <span class="section-dot" style="background: var(--admonitions-color-warning)"></span>
          <span class="section-title">分页</span>
          <i class="icon section-arrow" class:open={openSections.has('pagination')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('pagination')}
          <div class="section-body">
            <div class="field">
              <label class="field-label">每页文章数</label>
              <input class="field-input" type="number" min="1" max="50" value={config.pagination?.postsPerPage || 10} oninput={(e) => setNested('pagination.postsPerPage', Number((e.target as HTMLInputElement).value))} />
            </div>
          </div>
        {/if}
      </div>

      <!-- Bangumi -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('bangumi')}>
          <span class="section-dot" style="background: var(--admonitions-color-important)"></span>
          <span class="section-title">番组计划</span>
          <i class="icon section-arrow" class:open={openSections.has('bangumi')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('bangumi')}
          <div class="section-body">
            <div class="field">
              <label class="field-label">用户 ID</label>
              <input class="field-input" value={config.bangumi?.userId || ''} oninput={(e) => setNested('bangumi.userId', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field-label">数据模式</label>
              <div class="field-row">
                {#each ['static', 'dynamic'] as mode}
                  <label class="radio-label">
                    <input type="radio" name="bangumiMode" value={mode} checked={config.bangumi?.mode === mode} onchange={() => setNested('bangumi.mode', mode)} />
                    <span>{mode === 'static' ? '构建时' : '实时获取'}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Bilibili 追番 -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('anime')}>
          <span class="section-dot" style="background: var(--admonitions-color-caution)"></span>
          <span class="section-title">Bilibili 追番</span>
          <i class="icon section-arrow" class:open={openSections.has('anime')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('anime')}
          <div class="section-body">
            <div class="field">
              <label class="field-label">Bilibili UID</label>
              <input class="field-input" value={config.anime?.bilibili?.uid || ''} oninput={(e) => setNested('anime.bilibili.uid', (e.target as HTMLInputElement).value)} />
            </div>
          </div>
        {/if}
      </div>

      <!-- ========== 友链管理 ========== -->
      <div class="section">
        <button class="section-header" onclick={() => toggleSection('friends')}>
          <span class="section-dot" style="background: var(--primary)"></span>
          <span class="section-title">友链管理</span>
			<span class="friend-count">{friends.length} 个友链</span>
          <i class="icon section-arrow" class:open={openSections.has('friends')} style="font-size:18px">{@html getIconSvg("material-symbols:chevron-right")}</i>
        </button>
        {#if openSections.has('friends')}
          <div class="section-body">
            {#each friends as friend, i (friend.title as string || '')}
              <div class="friend-card" class:friend-disabled={!friend.enabled}>
                <div class="friend-card-header">
                  <img class="friend-avatar" src={String(friend.imgurl || '')} alt={String(friend.title || '')} />
                  <div class="friend-info">
                    <span class="friend-title">{String(friend.title || '')}</span>
                    <span class="friend-desc">{String(friend.desc || '')}</span>
                  </div>
                    <label class="toggle" ontouchstart={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!friend.enabled} onchange={(e) => {
                      friends[i] = { ...friends[i], enabled: (e.target as HTMLInputElement).checked };
                      friends = friends;
                    }} />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="friend-card-body">
	<div class="friend-field-row">
					<label class="friend-field" style="flex:1; min-width:0">
						<span>标题</span>
						<input class="friend-input" value={String(friend.title || '')} oninput={(e) => { friends[i] = { ...friends[i], title: (e.target as HTMLInputElement).value }; friends = friends; }} />
					</label>
					<label class="friend-field" style="flex:0 0 auto">
						<span>权重</span>
						<input class="friend-input friend-input-sm" type="number" value={Number(friend.weight ?? 10)} oninput={(e) => { friends[i] = { ...friends[i], weight: Number((e.target as HTMLInputElement).value) }; friends = friends; }} />
					</label>
				</div>
                  <label class="friend-field">
                    <span>头像 URL</span>
                    <input class="friend-input" value={String(friend.imgurl || '')} oninput={(e) => { friends[i] = { ...friends[i], imgurl: (e.target as HTMLInputElement).value }; friends = friends; }} />
                  </label>
                  <label class="friend-field">
                    <span>站点 URL</span>
                    <input class="friend-input" value={String(friend.siteurl || '')} oninput={(e) => { friends[i] = { ...friends[i], siteurl: (e.target as HTMLInputElement).value }; friends = friends; }} />
                  </label>
                  <label class="friend-field">
                    <span>RSS 订阅</span>
                    <input class="friend-input" value={String(friend.rss || '')} oninput={(e) => { friends[i] = { ...friends[i], rss: (e.target as HTMLInputElement).value }; friends = friends; }} />
                  </label>
                  <label class="friend-field">
                    <span>描述</span>
                    <input class="friend-input" value={String(friend.desc || '')} oninput={(e) => { friends[i] = { ...friends[i], desc: (e.target as HTMLInputElement).value }; friends = friends; }} />
                  </label>
                  <label class="friend-field">
                    <span>标签（逗号分隔）</span>
                    <input class="friend-input" value={((friend.tags as string[]) || []).join(', ')} oninput={(e) => { friends[i] = { ...friends[i], tags: (e.target as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean) }; friends = friends; }} />
                  </label>
                  <div class="friend-actions">
                    <button class="friend-btn friend-btn-danger" onclick={() => {
                      friends.splice(i, 1);
                      friends = friends;
                    }}>删除</button>
                  </div>
                </div>
              </div>
            {/each}

            <div class="friend-add-area">
              <button class="btn-add-friend" onclick={() => {
                friends = [...friends, { title: '', imgurl: '', desc: '', siteurl: '', rss: '', tags: [], weight: 10, enabled: true }];
              }}>
                <i class="icon" style="font-size:16px">{@html getIconSvg("material-symbols:add")}</i>
                <span>添加友链</span>
              </button>
            </div>

            <div class="friend-page-config">
              <div class="friend-page-title">友链页面配置</div>
              <label class="friend-field">
                <span>页面标题（留空使用默认）</span>
                <input class="friend-input" value={String(friendsPage.title || '')} oninput={(e) => { friendsPage = { ...friendsPage, title: (e.target as HTMLInputElement).value }; }} />
              </label>
              <label class="friend-field">
                <span>页面描述（留空使用默认）</span>
                <input class="friend-input" value={String(friendsPage.description || '')} oninput={(e) => { friendsPage = { ...friendsPage, description: (e.target as HTMLInputElement).value }; }} />
              </label>
              <div class="friend-check-row">
                <label class="toggle">
                  <input type="checkbox" checked={friendsPage.showCustomContent ?? true} onchange={(e) => { friendsPage = { ...friendsPage, showCustomContent: (e.target as HTMLInputElement).checked }; }} />
                  <span class="toggle-slider"></span>
                </label>
                <span class="friend-check-label">显示自定义内容</span>
              </div>
              <div class="friend-check-row">
                <label class="toggle">
                  <input type="checkbox" checked={friendsPage.showComment ?? true} onchange={(e) => { friendsPage = { ...friendsPage, showComment: (e.target as HTMLInputElement).checked }; }} />
                  <span class="toggle-slider"></span>
                </label>
                <span class="friend-check-label">显示评论区</span>
              </div>
              <div class="friend-check-row">
                <label class="toggle">
                  <input type="checkbox" checked={friendsPage.randomizeSort ?? false} onchange={(e) => { friendsPage = { ...friendsPage, randomizeSort: (e.target as HTMLInputElement).checked }; }} />
                  <span class="toggle-slider"></span>
                </label>
                <span class="friend-check-label">随机排序（忽略权重）</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 780px; margin: 0 auto; }

  .btn-save {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--primary);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-xl);
    cursor: pointer;
  }
  .btn-save:hover { opacity: 0.9; }
  .btn-save:disabled { opacity: 0.5; }

  .sections { display: flex; flex-direction: column; gap: 8px; }

  .section {
    background: var(--card-bg);
    border: 1px solid var(--line-divider);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 14px 16px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }
  .section-header:hover { background: var(--btn-plain-bg-hover); }

  .section-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .section-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--deep-text);
  }

  .section-arrow {
    color: var(--content-meta);
    transition: transform 200ms;
  }
  .section-arrow.open { transform: rotate(90deg); }

  .section-body {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 13px; font-weight: 600; color: var(--deep-text); }

  .field-input {
    padding: 9px 14px;
    border: 1px solid var(--line-divider);
    border-radius: var(--radius-xl);
    background: var(--muted);
    color: var(--deep-text);
    font-size: 14px;
    outline: none;
  }
  .field-input:focus { border-color: var(--primary); }

  .field-textarea { resize: vertical; min-height: 60px; font-family: inherit; }

  .field-row { display: flex; align-items: center; gap: 12px; }
  .field-row-between { flex-direction: row; justify-content: space-between; align-items: center; }
  .field-value { font-size: 14px; font-weight: 600; color: var(--btn-content); min-width: 36px; text-align: center; }

  .radio-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--deep-text);
    cursor: pointer;
  }
  .radio-label input[type="radio"] { accent-color: var(--primary); }

  /* Toggle switch */
  .toggle {
    position: relative;
    display: inline-block;
    width: 42px;
    height: 24px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--line-divider);
    border-radius: var(--radius-full);
    transition: background 200ms;
  }
  .toggle-slider::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: var(--radius-full);
    transition: transform 200ms;
  }
  .toggle input:checked + .toggle-slider { background: var(--primary); }
  .toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

  /* Friend links */
  .friend-count {
    font-size: 12px;
    color: var(--content-meta);
    margin-right: 8px;
  }

  .friend-card {
    background: var(--muted);
    border: 1px solid var(--line-divider);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .friend-card.friend-disabled {
    opacity: 0.5;
  }

  .friend-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line-divider);
  }

  .friend-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    object-fit: cover;
    flex-shrink: 0;
  }

  .friend-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .friend-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--deep-text);
  }
  .friend-desc {
    font-size: 12px;
    color: var(--content-meta);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .friend-card-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .friend-field-row {
    display: flex;
    gap: 10px;
  }
  .friend-field-row .friend-field {
    flex: 1;
  }

  .friend-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--content-meta);
    font-weight: 500;
  }

  .friend-input {
    padding: 7px 10px;
    border: 1px solid var(--line-divider);
    border-radius: var(--radius-lg);
    background: var(--card-bg);
    color: var(--deep-text);
    font-size: 13px;
    outline: none;
  }
  .friend-input:focus {
    border-color: var(--primary);
  }
  .friend-input-sm {
    width: 4.5rem;
  }
  .friend-input-sm::-webkit-inner-spin-button,
  .friend-input-sm::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .friend-input-sm[type="number"] {
    -moz-appearance: textfield;
  }

  .friend-actions {
    display: flex;
    justify-content: flex-end;
  }

  .friend-btn {
    padding: 5px 12px;
    border: none;
    border-radius: var(--radius-lg);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: transparent;
    color: var(--content-meta);
  }
  .friend-btn:hover {
    background: var(--btn-plain-bg-hover);
  }
  .friend-btn-danger {
    color: var(--admonitions-color-caution);
  }
  .friend-btn-danger:hover {
    background: var(--admonitions-color-caution);
    color: white;
  }

  .friend-add-area {
    display: flex;
    justify-content: center;
    padding: 8px 0;
  }

  .btn-add-friend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    border: 1px dashed var(--line-divider);
    border-radius: var(--radius-xl);
    background: transparent;
    color: var(--content-meta);
    font-size: 13px;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }
  .btn-add-friend:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  .friend-page-config {
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--line-divider);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .friend-page-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--deep-text);
  }
  .friend-check-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .friend-check-label {
    font-size: 13px;
    color: var(--deep-text);
  }

</style>
