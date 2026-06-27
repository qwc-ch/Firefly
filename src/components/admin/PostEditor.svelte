<script lang="ts">
import { getIconSvg } from "@/constants/icons";
import { getImageUrl, imagesApi, type PostContent, postsApi } from "@/lib/api";

interface Props {
	slug: string | null;
	onBack: () => void;
	onSaved: () => void;
}

let { slug, onBack, onSaved }: Props = $props();

let title = $state("");
let postSlug = $state("");
let description = $state("");
let image = $state("");
let tags = $state("");
let category = $state("");
let author = $state("Admin");
let published = $state(new Date().toISOString().split("T")[0]);
let updated = $state(new Date().toISOString().split("T")[0]);
let draft = $state(false);
let comment = $state(true);
let pinned = $state(false);
let content = $state("");
let loading = $state(false);
let saving = $state(false);
let message = $state("");
let messageType = $state<"success" | "error">("success");

let fileInput: HTMLInputElement;
let previewUrl = $state("");

$effect(() => {
	if (slug) {
		loadPost(slug);
	} else {
		postSlug = "";
		title = "";
		description = "";
		image = "";
		tags = "";
		category = "";
		author = "Admin";
		published = new Date().toISOString().split("T")[0];
		updated = new Date().toISOString().split("T")[0];
		draft = false;
		comment = true;
		pinned = false;
		content = "";
		previewUrl = "";
	}
});

async function loadPost(s: string) {
	loading = true;
	try {
		const post: PostContent = await postsApi.get(s);
		postSlug = post.slug;
		title = post.title || "";
		description = post.description || "";
		image = post.image || "";
		tags = (post.tags || []).join(", ");
		category = post.category || "";
		author = post.author || "Admin";
		published = post.published ? post.published.split("T")[0] : "";
		updated = post.updated ? post.updated.split("T")[0] : "";
		draft = post.draft ?? false;
		comment = post.comment ?? true;
		pinned = post.pinned ?? false;
		content = post.content || "";
		previewUrl = image ? getImageUrl(image) : "";
	} catch (err: unknown) {
		showMessage(err instanceof Error ? err.message : "加载失败", "error");
	} finally {
		loading = false;
	}
}

function showMessage(msg: string, type: "success" | "error") {
	message = msg;
	messageType = type;
	setTimeout(() => (message = ""), 3000);
}

async function handleSave() {
	if (!postSlug.trim()) {
		showMessage("请输入 Slug", "error");
		return;
	}
	if (!title.trim()) {
		showMessage("请输入标题", "error");
		return;
	}

	saving = true;
	try {
		const frontmatter: Record<string, unknown> = {
			title: title.trim(),
			published,
			draft,
			description: description.trim(),
			image: image.trim(),
			tags: tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
			category: category.trim(),
			lang: "",
			pinned,
			author: author.trim(),
			comment,
		};

		if (updated) frontmatter.updated = updated;

		if (slug) {
			await postsApi.update(slug, { frontmatter, content });
			showMessage("文章已更新", "success");
		} else {
			await postsApi.create({ slug: postSlug.trim(), frontmatter, content });
			showMessage("文章已创建", "success");
			setTimeout(() => onSaved(), 1000);
		}
	} catch (err: unknown) {
		showMessage(err instanceof Error ? err.message : "保存失败", "error");
	} finally {
		saving = false;
	}
}

async function handleDelete() {
	if (!slug) return;
	if (!confirm("确定要删除这篇文章吗？")) return;

	try {
		await postsApi.delete(slug);
		showMessage("文章已删除", "success");
		setTimeout(() => onSaved(), 1000);
	} catch (err: unknown) {
		showMessage(err instanceof Error ? err.message : "删除失败", "error");
	}
}

async function handleImageUpload(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;

	try {
		const result = await imagesApi.upload(file);
		image = result.key;
		previewUrl = getImageUrl(result.key);
		showMessage("图片已上传", "success");
	} catch (err: unknown) {
		showMessage(err instanceof Error ? err.message : "上传失败", "error");
	}
}

function handleImageRemove() {
	image = "";
	previewUrl = "";
	if (fileInput) fileInput.value = "";
}
</script>

<div class="page">
  {#if message}
    <div class="message" class:message-error={messageType === 'error'}>{message}</div>
  {/if}

  {#if loading}
    <div class="empty-state">加载中...</div>
  {:else}
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label" for="editor-slug">Slug (URL路径)</label>
        <input
          id="editor-slug"
          type="text"
          bind:value={postSlug}
          disabled={!!slug}
          class="form-input"
          placeholder="my-post-slug"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="editor-title">标题</label>
        <input
          id="editor-title"
          type="text"
          bind:value={title}
          class="form-input"
          placeholder="文章标题"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="editor-desc">描述</label>
        <textarea
          id="editor-desc"
          bind:value={description}
          class="form-input form-textarea"
          rows="2"
          placeholder="文章简短描述"
        ></textarea>
      </div>

      <div class="form-group">
        <label class="form-label" for="editor-image">封面图</label>
        <div class="image-row">
          <label class="btn-secondary">
            <i class="icon" style="font-size:16px">{@html getIconSvg("material-symbols:upload")}</i>
            <span>选择文件</span>
            <input
              id="editor-image"
              type="file"
              accept="image/*"
              class="hidden"
              bind:this={fileInput}
              onchange={handleImageUpload}
            />
          </label>
          {#if image}
            <span class="image-name">{image}</span>
            <button onclick={handleImageRemove} class="btn-text-danger">移除</button>
          {:else}
            <span class="image-placeholder">未选择任何文件</span>
          {/if}
        </div>
        {#if previewUrl}
          <img src={previewUrl} alt="封面预览" class="image-preview" />
        {/if}
      </div>

      <div class="form-group">
        <label class="form-label" for="editor-tags">标签 (逗号分隔)</label>
        <input
          id="editor-tags"
          type="text"
          bind:value={tags}
          class="form-input"
          placeholder="如: 教程, Astro"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="editor-category">分类</label>
        <input
          id="editor-category"
          type="text"
          bind:value={category}
          class="form-input"
          placeholder="如: 技术"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="editor-author">作者</label>
        <input
          id="editor-author"
          type="text"
          bind:value={author}
          class="form-input"
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="editor-published">发布日期</label>
          <input
            id="editor-published"
            type="date"
            bind:value={published}
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="editor-updated">更新日期</label>
          <input
            id="editor-updated"
            type="date"
            bind:value={updated}
            class="form-input"
          />
        </div>
      </div>

      <div class="form-check-row">
        <input type="checkbox" bind:checked={draft} id="editor-draft" class="form-checkbox" />
        <label for="editor-draft" class="form-check-label">草稿</label>

        <input type="checkbox" bind:checked={pinned} id="editor-pinned" class="form-checkbox" />
        <label for="editor-pinned" class="form-check-label">置顶</label>

        <input type="checkbox" bind:checked={comment} id="editor-comment" class="form-checkbox" />
        <label for="editor-comment" class="form-check-label">评论</label>
      </div>

      <div class="form-group">
        <label class="form-label" for="editor-content">内容 (Markdown)</label>
        <textarea
          id="editor-content"
          bind:value={content}
          class="form-input form-textarea form-code"
          rows="20"
          placeholder="在此输入 Markdown 内容..."
        ></textarea>
      </div>

      <div class="form-actions">
        <button onclick={handleSave} disabled={saving} class="btn-primary">
          <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:save")}</i>
          <span>{saving ? '保存中...' : (slug ? '更新文章' : '发布文章')}</span>
        </button>
        <button onclick={onBack} class="btn-secondary">
          <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:arrow-back")}</i>
          <span>返回列表</span>
        </button>
        {#if slug}
          <button onclick={handleDelete} class="btn-danger">
            <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:delete")}</i>
            <span>删除文章</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 780px;
    margin: 0 auto;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    line-height: 1.6;
  }

  .image-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .image-name {
    font-size: 13px;
    color: var(--content-meta);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .image-placeholder {
    font-size: 13px;
    color: var(--content-meta);
    opacity: 0.5;
  }

  .image-preview {
    margin-top: 10px;
    width: 160px;
    height: 112px;
    object-fit: cover;
    border-radius: var(--radius-xl);
    border: 1px solid var(--line-divider);
  }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 20px;
    background: transparent;
    color: var(--admonitions-color-caution);
    font-weight: 500;
    font-size: 13px;
    border: none;
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: background 150ms;
    margin-left: auto;
  }
  .btn-danger:hover {
    background: var(--btn-card-bg-hover);
  }

  .btn-text-danger {
    background: none;
    border: none;
    color: var(--admonitions-color-caution);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
  }

</style>
