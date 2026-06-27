<script lang="ts">
import { getIconSvg } from "@/constants/icons";
import { type PostMeta, postsApi } from "@/lib/api";

interface Props {
	searchQuery: string;
	refreshKey: number;
	onEdit: (slug: string) => void;
	onNew: () => void;
	onDeleted: () => void;
}

let { searchQuery, refreshKey, onEdit, onNew, onDeleted }: Props = $props();

let posts = $state<PostMeta[]>([]);
let filtered = $state<PostMeta[]>([]);
let loading = $state(true);
let message = $state("");

$effect(() => {
	loadPosts();
});

$effect(() => {
	refreshKey;
	loadPosts();
});

async function loadPosts() {
	loading = true;
	try {
		posts = await postsApi.list();
		filtered = posts;
	} catch (err: unknown) {
		message = err instanceof Error ? err.message : "加载失败";
	} finally {
		loading = false;
	}
}

$effect(() => {
	const q = searchQuery.toLowerCase();
	filtered = posts.filter(
		(p) =>
			p.title.toLowerCase().includes(q) ||
			p.slug.toLowerCase().includes(q) ||
			(p.category || "").toLowerCase().includes(q) ||
			(p.tags || []).some((t) => t.toLowerCase().includes(q)),
	);
});

async function handleDelete(slug: string) {
	if (!confirm(`确定要删除文章 "${slug}" 吗？`)) return;
	try {
		await postsApi.delete(slug);
		message = "文章已删除";
		onDeleted();
		setTimeout(() => (message = ""), 3000);
	} catch (err: unknown) {
		message = err instanceof Error ? err.message : "删除失败";
	}
}

function formatDate(d: string): string {
	if (!d) return "";
	return d.split("T")[0];
}

function getCats(category: string): string[] {
	return (category || "")
		.split(",")
		.map((c) => c.trim())
		.filter(Boolean);
}
</script>

<div class="page">
  <!-- Desktop header -->
  <div class="page-header">
    <div class="page-title-row">
      <h2 class="page-title">文章列表</h2>
      <span class="badge">{posts.length}</span>
    </div>
    <button class="btn-primary" onclick={onNew}>
      <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:add")}</i>
      <span>新建文章</span>
    </button>
  </div>

  {#if message}
    <div class="message message-success">{message}</div>
  {/if}

  {#if loading}
    <div class="empty-state">加载中...</div>
  {:else if filtered.length === 0}
    <div class="empty-state">
      <i class="icon" style="font-size:48px; opacity: 0.3">{@html getIconSvg("material-symbols:article")}</i>
      <p>{posts.length === 0 ? '暂无文章' : '没有匹配的文章'}</p>
    </div>
  {:else}
    <div class="post-list">
      {#each filtered as post (post.slug)}
        <div class="post-card" onclick={() => onEdit(post.slug)} role="button" tabindex="0">
          <div class="post-top">
            <div class="post-title-row">
              <h3 class="post-title">{post.title || post.slug}</h3>
              <div class="post-badges">
                {#if post.draft}
                  <span class="badge-status badge-draft">草稿</span>
                {/if}
                {#if post.pinned}
                  <span class="badge-status badge-pinned">置顶</span>
                {/if}
              </div>
            </div>
            <div class="post-date">{formatDate(post.published)}</div>
          </div>

          {#if post.category || post.tags?.length}
            <div class="post-meta">
              {#if post.category}
                <div class="meta-row">
                  {#each getCats(post.category) as cat}
                    <span class="tag tag-category">{cat}</span>
                  {/each}
                </div>
              {/if}
              {#if post.tags?.length}
                {@const categorySet = new Set(getCats(post.category).map(c => c.toLowerCase()))}
                {@const displayTags = post.tags.filter(t => !categorySet.has(t.toLowerCase())).slice(0, 6)}
                {#if displayTags.length}
                  <div class="meta-row">
                    {#each displayTags as tag}
                      <span class="tag">#{tag}</span>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          {/if}

          <div class="post-actions">
            <button class="action-btn" onclick={(e) => { e.stopPropagation(); onEdit(post.slug); }}>
              <i class="icon" style="font-size:16px">{@html getIconSvg("material-symbols:edit")}</i>
              <span>编辑</span>
            </button>
            <button class="action-btn action-btn-danger" onclick={(e) => { e.stopPropagation(); handleDelete(post.slug); }}>
              <i class="icon" style="font-size:16px">{@html getIconSvg("material-symbols:delete")}</i>
              <span>删除</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Mobile FAB -->
<button class="fab" onclick={onNew}>
  <i class="icon" style="font-size:24px">{@html getIconSvg("material-symbols:add")}</i>
</button>

<style>
  .post-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .post-card {
    padding: 14px 16px;
    background: var(--card-bg);
    border: 1px solid var(--line-divider);
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: border-color 150ms, box-shadow 150ms;
  }
  .post-card:hover {
    border-color: var(--primary);
    box-shadow: var(--shadow-sm);
  }

  .post-top {
    margin-bottom: 8px;
  }

  .post-title-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .post-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--deep-text);
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .post-badges {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .badge-status {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    line-height: 1.4;
  }
  .badge-draft {
    background: var(--btn-regular-bg-active);
    color: var(--btn-content);
  }
  .badge-pinned {
    background: var(--primary);
    color: white;
  }

  .post-date {
    font-size: 12px;
    color: var(--content-meta);
    margin-top: 2px;
  }

  .post-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--content-meta);
    white-space: nowrap;
  }
  .tag-category {
    background: var(--btn-regular-bg);
    color: var(--btn-content);
  }

  .post-actions {
    display: flex;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--line-divider);
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 8px 14px;
    border-radius: var(--radius-xl);
    background: var(--btn-regular-bg);
    color: var(--btn-content);
    font-size: 13px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: background 150ms;
    min-height: 40px;
  }
  .action-btn:hover {
    background: var(--btn-regular-bg-hover);
  }
  .action-btn-danger {
    color: var(--admonitions-color-caution);
    background: transparent;
    border: 1px solid var(--line-divider);
  }
  .action-btn-danger:hover {
    background: var(--btn-card-bg-hover);
  }

  /* Mobile FAB - hidden on desktop */
  .fab {
    display: none;
  }

  @media (max-width: 767px) {
    .page {
      padding: 12px;
      padding-bottom: 80px;
    }

    .page-header {
      margin-bottom: 12px;
    }

    .page-title { font-size: 18px; }

    /* Hide desktop new button on mobile */
    .btn-primary {
      display: none;
    }

    .post-card {
      padding: 12px;
    }

    .post-title {
      font-size: 15px;
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .post-actions {
      gap: 6px;
    }

    .action-btn {
      flex: 1;
      justify-content: center;
      min-height: 44px;
    }

    /* FAB */
    .fab {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-full);
      background: var(--primary);
      color: white;
      border: none;
      box-shadow: var(--shadow-lg);
      cursor: pointer;
      z-index: 50;
      transition: opacity 150ms;
    }
    .fab:hover { opacity: 0.9; }
  }
</style>
