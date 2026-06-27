<script lang="ts">
import { getIconSvg } from "@/constants/icons";
import { getImageUrl, type ImageItem, imagesApi } from "@/lib/api";

let images = $state<ImageItem[]>([]);
let loading = $state(true);
let uploading = $state(false);
let message = $state("");
let messageType = $state<"success" | "error">("success");

$effect(() => {
	loadImages();
});

async function loadImages() {
	loading = true;
	try {
		images = await imagesApi.list();
	} catch (err: unknown) {
		message = err instanceof Error ? err.message : "加载失败";
		messageType = "error";
	} finally {
		loading = false;
	}
}

async function handleUpload(e: Event) {
	const input = e.target as HTMLInputElement;
	const files = input.files;
	if (!files?.length) return;

	uploading = true;
	let successCount = 0;
	let failCount = 0;

	for (const file of Array.from(files)) {
		try {
			await imagesApi.upload(file);
			successCount++;
		} catch {
			failCount++;
		}
	}

	uploading = false;
	message =
		failCount > 0
			? `上传完成: ${successCount} 成功, ${failCount} 失败`
			: `成功上传 ${successCount} 张图片`;
	messageType = failCount > 0 ? "error" : "success";
	input.value = "";
	await loadImages();
	setTimeout(() => (message = ""), 3000);
}

async function handleDelete(key: string) {
	if (!confirm(`确定要删除图片 "${key}" 吗？`)) return;
	try {
		await imagesApi.delete(key);
		message = "图片已删除";
		messageType = "success";
		await loadImages();
		setTimeout(() => (message = ""), 3000);
	} catch (err: unknown) {
		message = err instanceof Error ? err.message : "删除失败";
		messageType = "error";
	}
}

function copyUrl(key: string) {
	const url = getImageUrl(key);
	navigator.clipboard.writeText(url);
	message = "链接已复制";
	messageType = "success";
	setTimeout(() => (message = ""), 2000);
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<div class="page">
  <div class="page-header">
    <div class="page-title-row">
      <h2 class="page-title">图片管理</h2>
      <span class="badge">{images.length}</span>
    </div>
    <label class="btn-primary">
      {#if uploading}
        <i class="icon" style="font-size:16px">{@html getIconSvg("svg-spinners:bars-rotate-fade")}</i>
      {:else}
        <i class="icon" style="font-size:16px">{@html getIconSvg("material-symbols:upload")}</i>
      {/if}
      <span>{uploading ? '上传中...' : '上传图片'}</span>
      <input
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        onchange={handleUpload}
        disabled={uploading}
      />
    </label>
  </div>

  {#if message}
    <div class="message" class:message-error={messageType === 'error'}>{message}</div>
  {/if}

  {#if loading}
    <div class="empty-state">加载中...</div>
  {:else if images.length === 0}
    <div class="empty-state">
      <i class="icon" style="font-size:48px; opacity: 0.3">{@html getIconSvg("material-symbols:image")}</i>
      <p>暂无图片，点击上方按钮上传</p>
    </div>
  {:else}
    <div class="image-grid">
      {#each images as img (img.key)}
        <div class="image-card">
          <div class="image-thumb">
            <img
              src={getImageUrl(img.key)}
              alt={img.key}
              loading="lazy"
            />
            <div class="image-overlay">
              <button class="overlay-btn" onclick={() => copyUrl(img.key)} title="复制链接">
                <i class="icon" style="font-size:16px">{@html getIconSvg("material-symbols:content-copy")}</i>
              </button>
              <button class="overlay-btn overlay-btn-danger" onclick={() => handleDelete(img.key)} title="删除">
                <i class="icon" style="font-size:16px">{@html getIconSvg("material-symbols:delete")}</i>
              </button>
            </div>
          </div>
          <div class="image-info">
            <p class="image-name" title={img.key}>{img.key.split('/').pop()}</p>
            <p class="image-size">{formatSize(img.size)}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
  }

  .image-card {
    background: var(--card-bg);
    border: 1px solid var(--line-divider);
    border-radius: var(--radius-xl);
    overflow: hidden;
    transition: border-color 150ms, box-shadow 150ms;
  }
  .image-card:hover {
    border-color: var(--primary);
    box-shadow: var(--shadow-sm);
  }

  .image-thumb {
    position: relative;
    aspect-ratio: 1;
    background: var(--muted);
  }
  .image-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .image-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 150ms;
  }
  .image-card:hover .image-overlay {
    opacity: 1;
  }

  .overlay-btn {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.9);
    color: var(--deep-text);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: background 150ms;
  }
  .overlay-btn:hover {
    background: var(--primary);
    color: white;
  }
  .overlay-btn-danger:hover {
    background: var(--admonitions-color-caution);
    color: white;
  }

  .image-info {
    padding: 10px 12px;
  }

  .image-name {
    font-size: 12px;
    color: var(--content-meta);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
  }

  .image-size {
    font-size: 11px;
    color: var(--content-meta);
    opacity: 0.6;
    margin: 2px 0 0;
  }

  @media (max-width: 767px) {
    .page { padding: 16px; }
    .image-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
  }
</style>
