<script lang="ts">
import hljs from "highlight.js";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import "highlight.js/styles/github-dark.css";
import { getIconSvg } from "@/constants/icons";
import { getImageUrl, type PostContent, postsApi } from "@/lib/api";

marked.use(
	markedHighlight({
		langPrefix: "hljs language-",
		highlight(code: string, lang: string) {
			if (lang && hljs.getLanguage(lang)) {
				return hljs.highlight(code, { language: lang }).value;
			}
			return hljs.highlightAuto(code).value;
		},
	}),
);

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
let draft = $state(true);
let comment = $state(true);
let pinned = $state(false);
let lang = $state("");
let licenseName = $state("");
let licenseUrl = $state("");
let sourceLink = $state("");
let password = $state("");
let passwordHint = $state("");
let content = $state("");
let loading = $state(false);
let saving = $state(false);
let message = $state("");
let messageType = $state<"success" | "error">("success");
let viewMode = $state<"edit" | "preview" | "split">("split");
let uploadProgress = $state<number | null>(null);
let isUploading = $state(false);
let slugManuallyEdited = $state(false);
let advancedOpen = $state(false);

let textareaRef: HTMLTextAreaElement;
let fileInputRef: HTMLInputElement;
let dropZoneRef: HTMLDivElement;

let isEditing = $derived(!!slug);

const previewHtml = $derived.by(() => {
	if (!content.trim())
		return '<p style="color:var(--content-meta);opacity:0.6">预览区域</p>';
	try {
		return marked.parse(content, { breaks: true });
	} catch {
		return `<pre>${content}</pre>`;
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
		draft = post.draft ?? true;
		comment = post.comment ?? true;
		pinned = post.pinned ?? false;
		lang = post.lang || "";
		licenseName = post.licenseName || "";
		licenseUrl = post.licenseUrl || "";
		sourceLink = post.sourceLink || "";
		password = post.password || "";
		passwordHint = post.passwordHint || "";
		content = post.content || "";
	} catch (err: unknown) {
		showMessage(err instanceof Error ? err.message : "加载失败", "error");
	} finally {
		loading = false;
	}
}

$effect(() => {
	if (slug) {
		loadPost(slug);
	}
});

function showMessage(msg: string, type: "success" | "error") {
	message = msg;
	messageType = type;
	setTimeout(() => (message = ""), 3000);
}

function handleTitleInput() {
	if (!slugManuallyEdited && !isEditing) {
		postSlug = title
			.toLowerCase()
			.replace(/[^\w\u4e00-\u9fff]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}
}

function handleSlugInput() {
	slugManuallyEdited = true;
}

function wrapSelection(before: string, after: string, placeholder: string) {
	const ta = textareaRef;
	if (!ta) return;
	const start = ta.selectionStart;
	const end = ta.selectionEnd;
	const text = content;
	const selected = text.substring(start, end) || placeholder;
	const newText =
		text.substring(0, start) + before + selected + after + text.substring(end);
	content = newText;
	requestAnimationFrame(() => {
		ta.focus();
		if (text.substring(start, end) === "") {
			ta.setSelectionRange(
				start + before.length,
				start + before.length + placeholder.length,
			);
		} else {
			ta.setSelectionRange(
				start + before.length,
				start + before.length + selected.length,
			);
		}
	});
}

function handleBold() {
	wrapSelection("**", "**", "粗体文字");
}

function handleItalic() {
	wrapSelection("*", "*", "斜体文字");
}

function handleHeading() {
	wrapSelection("## ", "", "标题");
}

function handleLink() {
	const url = prompt("输入链接地址:", "https://");
	if (url) {
		wrapSelection("[", `](${url})`, "链接文字");
	}
}

function handleBlockquote() {
	wrapSelection("> ", "", "引用文字");
}

function handleOrderedList() {
	wrapSelection("\n1. ", "", "列表项");
}

function handleUnorderedList() {
	wrapSelection("\n- ", "", "列表项");
}

function handleCodeBlock() {
	wrapSelection("\n```\n", "\n```\n", "代码");
}

function handleTable() {
	const rows = prompt("行数:", "3");
	const cols = prompt("列数:", "3");
	if (rows && cols) {
		const r = Math.max(2, Number.parseInt(rows, 10));
		const c = Math.max(1, Number.parseInt(cols, 10));
		let table = "";
		for (let i = 0; i < r; i++) {
			table += "|";
			for (let j = 0; j < c; j++) {
				table += ` ${i === 1 ? "---" : "cell"} |`;
			}
			table += "\n";
		}
		const ta = textareaRef;
		if (!ta) return;
		const start = ta.selectionStart;
		content =
			content.substring(0, start) + table + content.substring(ta.selectionEnd);
		requestAnimationFrame(() => {
			ta.focus();
			ta.setSelectionRange(start + table.length, start + table.length);
		});
	}
}

function getAuthToken(): string {
	if (typeof window === "undefined") return "";
	return localStorage.getItem("firefly_admin_auth") || "";
}

function uploadFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		isUploading = true;
		uploadProgress = 0;
		const form = new FormData();
		form.append("file", file);
		const xhr = new XMLHttpRequest();
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				uploadProgress = Math.round((e.loaded / e.total) * 100);
			}
		};
		xhr.onload = () => {
			isUploading = false;
			uploadProgress = null;
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const result = JSON.parse(xhr.responseText);
					resolve(result.key);
				} catch {
					reject(new Error("解析响应失败"));
				}
			} else {
				reject(new Error(`上传失败: ${xhr.status}`));
			}
		};
		xhr.onerror = () => {
			isUploading = false;
			uploadProgress = null;
			reject(new Error("网络错误"));
		};
		xhr.open("POST", "https://api.520781.xyz/api/images/upload");
		xhr.setRequestHeader("Authorization", `Basic ${getAuthToken()}`);
		xhr.send(form);
	});
}

async function handleFileUpload(file: File) {
	if (!file.type.startsWith("image/")) {
		showMessage("仅支持上传图片文件", "error");
		return;
	}
	try {
		const key = await uploadFile(file);
		const url = getImageUrl(key);
		const alt = file.name.replace(/\.[^.]+$/, "");
		const ta = textareaRef;
		if (ta) {
			const start = ta.selectionStart;
			const md = `![${alt}](${url})`;
			content =
				content.substring(0, start) + md + content.substring(ta.selectionEnd);
			requestAnimationFrame(() => {
				ta.focus();
				ta.setSelectionRange(start + md.length, start + md.length);
			});
		} else {
			content += `\n![${alt}](${url})\n`;
		}
		showMessage("图片上传成功", "success");
	} catch (err: unknown) {
		showMessage(err instanceof Error ? err.message : "图片上传失败", "error");
	}
}

function handleDrop(e: DragEvent) {
	e.preventDefault();
	const files = e.dataTransfer?.files;
	if (files?.length) {
		handleFileUpload(files[0]);
	}
}

function handleDragOver(e: DragEvent) {
	e.preventDefault();
}

function handlePaste(e: ClipboardEvent) {
	const items = e.clipboardData?.items;
	if (!items) return;
	for (const item of items) {
		if (item.type.startsWith("image/")) {
			e.preventDefault();
			const file = item.getAsFile();
			if (file) {
				handleFileUpload(file);
			}
			break;
		}
	}
}

function triggerFilePick() {
	fileInputRef?.click();
}

async function handleFileInput(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (file) {
		await handleFileUpload(file);
	}
	input.value = "";
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
			lang: lang.trim(),
			pinned,
			author: author.trim(),
			comment,
			licenseName: licenseName.trim() || undefined,
			licenseUrl: licenseUrl.trim() || undefined,
			sourceLink: sourceLink.trim() || undefined,
			password: password.trim() || undefined,
			passwordHint: passwordHint.trim() || undefined,
		};
		if (updated) frontmatter.updated = updated;
		if (isEditing && slug) {
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

function handleTextareaFocus() {
	if (window.innerWidth > 768) return;
	setTimeout(() => {
		document
			.querySelector(".toolbar")
			?.scrollIntoView({ block: "start", behavior: "instant" });
	}, 100);
}

function preventToolbarFocus(e: Event) {
	if (window.innerWidth <= 768) e.preventDefault();
}

function toggleViewMode() {
	const modes: ("edit" | "preview" | "split")[] = ["split", "edit", "preview"];
	const idx = modes.indexOf(viewMode);
	viewMode = modes[(idx + 1) % modes.length];
}

const ICONS = {
	bold: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>`,
	italic: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>`,
	heading: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v4h3.5v12h3V8H15V4H5zm14 0h-2v16h2V4z"/></svg>`,
	link: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
	blockquote: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z"/></svg>`,
	listUl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>`,
	listOl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>`,
	code: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`,
	table: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 2v3H4V5h16zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zm-12 6h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/></svg>`,
	image: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
	split: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17V7c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2zm2 0h5V7H5v10zm7 0h5V7h-5v10z"/></svg>`,
	edit: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
	preview: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
};
</script>

<div class="page">
	{#if message}
		<div class="message" class:message-error={messageType === "error"}>{message}</div>
	{/if}

	{#if loading}
		<div class="empty-state">加载中...</div>
	{:else}
		<div class="form-grid">
			<div class="metadata-card">
				<div class="meta-row">
					<div class="meta-field flex-1">
						<label class="form-label" for="editor-title">标题</label>
						<input
							id="editor-title"
							type="text"
							bind:value={title}
							oninput={handleTitleInput}
							class="form-input form-input-lg"
							placeholder="文章标题"
						/>
					</div>
					<div class="meta-field" style="flex:0 0 200px">
						<label class="form-label" for="editor-slug">Slug</label>
						<input
							id="editor-slug"
							type="text"
							bind:value={postSlug}
							oninput={handleSlugInput}
							disabled={isEditing}
							class="form-input"
							placeholder="my-post-slug"
						/>
					</div>
				</div>
				<div class="meta-row">
					<div class="meta-field flex-1">
						<label class="form-label" for="editor-category">分类</label>
						<input
							id="editor-category"
							type="text"
							bind:value={category}
							class="form-input"
							placeholder="如: 技术"
						/>
					</div>
					<div class="meta-field flex-1">
						<label class="form-label" for="editor-tags">标签 (逗号分隔)</label>
						<input
							id="editor-tags"
							type="text"
							bind:value={tags}
							class="form-input"
							placeholder="如: 教程, Astro"
						/>
					</div>
				</div>
				<div class="meta-row">
					<label class="toggle-switch">
						<input type="checkbox" bind:checked={draft} />
						<span class="toggle-track">
							<span class="toggle-thumb"></span>
						</span>
						<span class="toggle-label" class:toggle-active={!draft}>
							{draft ? "草稿" : "发布"}
						</span>
					</label>
					<label class="check-label">
						<input type="checkbox" bind:checked={pinned} class="form-checkbox" />
						<span>置顶</span>
					</label>
					<label class="check-label">
						<input type="checkbox" bind:checked={comment} class="form-checkbox" />
						<span>评论</span>
					</label>
				</div>
			</div>

			<details class="advanced-card" bind:open={advancedOpen}>
				<summary class="advanced-summary">
					<span class="advanced-toggle">{advancedOpen ? "▾" : "▸"} 高级选项</span>
					<span class="advanced-count">{[
						lang, licenseName, licenseUrl, sourceLink, password, passwordHint
					].filter(Boolean).length} 项已设置</span>
				</summary>
				<div class="advanced-body">
					<div class="meta-row">
						<div class="meta-field flex-1">
							<label class="form-label" for="editor-lang">语言代码</label>
							<input id="editor-lang" type="text" bind:value={lang} class="form-input" placeholder="如: zh-CN" />
						</div>
						<div class="meta-field flex-1">
							<label class="form-label" for="editor-author">作者</label>
							<input id="editor-author" type="text" bind:value={author} class="form-input" placeholder="Admin" />
						</div>
					</div>
					<div class="meta-row">
						<div class="meta-field flex-1">
							<label class="form-label" for="editor-licenseName">许可证名称</label>
							<input id="editor-licenseName" type="text" bind:value={licenseName} class="form-input" placeholder="如: CC BY 4.0" />
						</div>
						<div class="meta-field flex-1">
							<label class="form-label" for="editor-licenseUrl">许可证链接</label>
							<input id="editor-licenseUrl" type="text" bind:value={licenseUrl} class="form-input" placeholder="https://creativecommons.org/..." />
						</div>
					</div>
					<div class="meta-row">
						<div class="meta-field flex-1">
							<label class="form-label" for="editor-sourceLink">来源链接</label>
							<input id="editor-sourceLink" type="text" bind:value={sourceLink} class="form-input" placeholder="https://..." />
						</div>
					</div>
					<div class="meta-row">
						<div class="meta-field flex-1">
							<label class="form-label" for="editor-password">文章密码</label>
							<input id="editor-password" type="text" bind:value={password} class="form-input" placeholder="留空则不加密" />
						</div>
						<div class="meta-field flex-1">
							<label class="form-label" for="editor-passwordHint">密码提示</label>
							<input id="editor-passwordHint" type="text" bind:value={passwordHint} class="form-input" placeholder="如: 我的生日" />
						</div>
					</div>
				</div>
			</details>

			<div
				class="editor-wrapper"
				bind:this={dropZoneRef}
				ondrop={handleDrop}
				ondragover={handleDragOver}
			>
				<div class="toolbar" onmousedown={preventToolbarFocus} ontouchstart={preventToolbarFocus}>
					<button class="tb-btn" onclick={handleBold} title="粗体">
						{@html ICONS.bold}
					</button>
					<button class="tb-btn" onclick={handleItalic} title="斜体">
						{@html ICONS.italic}
					</button>
					<button class="tb-btn" onclick={handleHeading} title="标题">
						{@html ICONS.heading}
					</button>
					<button class="tb-btn" onclick={handleLink} title="链接">
						{@html ICONS.link}
					</button>
					<button class="tb-btn" onclick={handleBlockquote} title="引用">
						{@html ICONS.blockquote}
					</button>
					<button class="tb-btn" onclick={handleUnorderedList} title="无序列表">
						{@html ICONS.listUl}
					</button>
					<button class="tb-btn" onclick={handleOrderedList} title="有序列表">
						{@html ICONS.listOl}
					</button>
					<button class="tb-btn" onclick={handleCodeBlock} title="代码块">
						{@html ICONS.code}
					</button>
					<button class="tb-btn" onclick={handleTable} title="表格">
						{@html ICONS.table}
					</button>
					<span class="tb-divider"></span>
					<button class="tb-btn" onclick={triggerFilePick} title="上传图片">
						{@html ICONS.image}
					</button>
					<input
						type="file"
						accept="image/*"
						class="hidden"
						bind:this={fileInputRef}
						onchange={handleFileInput}
					/>
					<span class="tb-divider"></span>
					<button class="tb-btn" onclick={toggleViewMode} title="切换视图">
						{#if viewMode === "split"}
							{@html ICONS.split}
						{:else if viewMode === "edit"}
							{@html ICONS.edit}
						{:else}
							{@html ICONS.preview}
						{/if}
					</button>
				</div>

				<div class="editor-area" class:is-split={viewMode === "split"}>
					<div class="editor-pane" class:hidden={viewMode === "preview"}>
						<textarea
							bind:this={textareaRef}
							bind:value={content}
							onpaste={handlePaste}
							onfocus={handleTextareaFocus}
							class="editor-textarea"
							placeholder="在此输入 Markdown 内容..."
							spellcheck="true"
						></textarea>
					</div>
					<div class="preview-pane" class:hidden={viewMode === "edit"}>
						<div class="preview-scroll">
							<div class="preview-content">
								{@html previewHtml}
							</div>
						</div>
					</div>
				</div>

				{#if isUploading}
					<div class="upload-progress">
						<div class="progress-bar">
							<div class="progress-fill" style="width:{uploadProgress ?? 0}%"></div>
						</div>
						<span class="progress-text">上传中 {uploadProgress ?? 0}%</span>
					</div>
				{/if}
			</div>

			<div class="form-actions">
				<button onclick={handleSave} disabled={saving} class="btn-primary">
					<i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:save")}</i>
					<span>{saving ? "保存中..." : isEditing ? "更新文章" : "发布文章"}</span>
				</button>
				<button onclick={onBack} class="btn-secondary">
					<i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:arrow-back")}</i>
					<span>返回列表</span>
				</button>
				{#if isEditing}
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
		max-width: 960px;
		margin: 0 auto;
	}

	.form-grid {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.hidden {
		display: none;
	}

	.message {
		padding: 10px 16px;
		border-radius: var(--radius-xl);
		background: var(--primary);
		color: white;
		font-size: 13px;
		font-weight: 500;
		margin-bottom: 16px;
		animation: msgSlideIn 0.2s ease;
	}
	.message.message-error {
		background: var(--admonitions-color-caution);
	}
	@keyframes msgSlideIn {
		from { opacity: 0; transform: translateY(-8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.empty-state {
		text-align: center;
		padding: 40px;
		color: var(--content-meta);
		font-size: 14px;
	}

	.metadata-card {
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: var(--radius-large);
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.meta-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.flex-1 {
		flex: 1;
	}

	.form-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--content-meta);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.form-input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--line-divider);
		border-radius: var(--radius-lg);
		background: var(--muted);
		color: var(--deep-text);
		font-size: 13px;
		outline: none;
		transition: border-color 0.2s, background 0.2s;
		box-sizing: border-box;
	}
	.form-input:focus {
		border-color: var(--primary);
		background: var(--card-bg);
	}
	.form-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.form-input-lg {
		font-size: 16px;
		font-weight: 600;
		padding: 10px 14px;
	}

	.form-checkbox {
		accent-color: var(--primary);
	}

	/* Toggle switch */
	.toggle-switch {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		user-select: none;
	}
	.toggle-switch input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.toggle-track {
		position: relative;
		width: 44px;
		height: 24px;
		background: var(--content-meta);
		border-radius: 12px;
		transition: background 0.25s;
		flex-shrink: 0;
	}
	.toggle-switch input:checked + .toggle-track {
		background: var(--primary);
	}
	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		background: white;
		border-radius: 50%;
		transition: transform 0.25s;
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
	}
	.toggle-switch input:checked + .toggle-track .toggle-thumb {
		transform: translateX(20px);
	}
	.toggle-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--content-meta);
		transition: color 0.2s;
	}
	.toggle-label.toggle-active {
		color: var(--primary);
	}

	.check-label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--content-meta);
		cursor: pointer;
		user-select: none;
	}

	.advanced-card {
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: var(--radius-large);
		overflow: hidden;
	}
	.advanced-summary {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		cursor: pointer;
		font-size: 13px;
		color: var(--content-meta);
		user-select: none;
		list-style: none;
	}
	.advanced-summary::-webkit-details-marker {
		display: none;
	}
	.advanced-toggle {
		font-size: 11px;
		font-weight: 700;
	}
	.advanced-count {
		font-size: 11px;
		opacity: 0.6;
		margin-left: auto;
	}
	.advanced-body {
		padding: 0 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		border-top: 1px solid var(--line-divider);
		padding-top: 16px;
	}

	/* Editor wrapper */
	.editor-wrapper {
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: var(--radius-large);
		overflow: hidden;
		transition: border-color 0.2s;
	}
	.editor-wrapper.is-dragging {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-alpha, rgba(99,102,241,0.15));
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--line-divider);
		background: var(--muted);
		flex-wrap: wrap;
	}

	.tb-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		padding: 0 6px;
		border: none;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--content-meta);
		cursor: pointer;
		font-size: 13px;
		transition: background 0.15s, color 0.15s;
	}
	.tb-btn:hover {
		background: var(--btn-plain-bg-hover);
		color: var(--deep-text);
	}
	.tb-label {
		font-weight: 700;
		font-size: 13px;
		line-height: 1;
	}

	.tb-btn :global(svg) {
		width: 18px;
		height: 18px;
		display: block;
	}

	.tb-divider {
		width: 1px;
		height: 20px;
		background: var(--line-divider);
		margin: 0 4px;
		flex-shrink: 0;
	}

	.tb-mode-label {
		font-size: 11px;
		color: var(--content-meta);
		margin-left: 2px;
	}

	/* Editor split pane */
	.editor-area {
		display: grid;
		grid-template-columns: 1fr;
		min-height: 480px;
	}
	.editor-area.is-split {
		grid-template-columns: 1fr 1fr;
	}

	.editor-pane {
		position: relative;
	}
	.editor-pane.hidden {
		display: none;
	}

	.editor-textarea {
		width: 100%;
		height: 100%;
		min-height: 480px;
		padding: 16px;
		border: none;
		background: var(--card-bg);
		color: var(--deep-text);
		font-family: "JetBrains Mono", "Cascadia Code", "Fira Code", monospace;
		font-size: 14px;
		line-height: 1.7;
		resize: vertical;
		outline: none;
		box-sizing: border-box;
		tab-size: 2;
	}
	.editor-textarea::placeholder {
		color: var(--content-meta);
		opacity: 0.5;
	}

	.preview-pane {
		position: relative;
		border-left: 1px solid var(--line-divider);
	}
	.preview-pane.hidden {
		display: none;
	}

	.preview-scroll {
		position: absolute;
		inset: 0;
		overflow-y: auto;
		padding: 16px;
	}

	.preview-content {
		font-size: 14px;
		line-height: 1.7;
		color: var(--deep-text);
		word-wrap: break-word;
	}
	.preview-content :global(h1),
	.preview-content :global(h2),
	.preview-content :global(h3),
	.preview-content :global(h4) {
		margin: 1.2em 0 0.6em;
		line-height: 1.3;
		color: var(--deep-text);
	}
	.preview-content :global(h1) { font-size: 1.6em; }
	.preview-content :global(h2) { font-size: 1.35em; }
	.preview-content :global(h3) { font-size: 1.15em; }
	.preview-content :global(p) { margin: 0.6em 0; }
	.preview-content :global(ul),
	.preview-content :global(ol) {
		padding-left: 1.5em;
		margin: 0.6em 0;
	}
	.preview-content :global(li) { margin: 0.2em 0; }
	.preview-content :global(blockquote) {
		margin: 0.6em 0;
		padding: 4px 12px;
		border-left: 3px solid var(--primary);
		color: var(--content-meta);
		background: var(--muted);
		border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
	}
	.preview-content :global(code) {
		padding: 2px 6px;
		background: var(--muted);
		border-radius: var(--radius-sm);
		font-family: "JetBrains Mono", monospace;
		font-size: 0.9em;
	}
	.preview-content :global(pre) {
		margin: 0.8em 0;
		padding: 14px 16px;
		background: var(--muted);
		border: 1px solid var(--line-divider);
		border-radius: var(--radius-lg);
		overflow-x: auto;
	}
	.preview-content :global(pre code) {
		padding: 0;
		background: none;
		font-size: 13px;
		line-height: 1.6;
	}
	.preview-content :global(a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.preview-content :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-lg);
		margin: 0.8em 0;
	}
	.preview-content :global(table) {
		border-collapse: collapse;
		margin: 0.8em 0;
		width: 100%;
		font-size: 13px;
	}
	.preview-content :global(th),
	.preview-content :global(td) {
		border: 1px solid var(--line-divider);
		padding: 8px 12px;
		text-align: left;
	}
	.preview-content :global(th) {
		background: var(--muted);
		font-weight: 600;
	}
	.preview-content :global(hr) {
		border: none;
		border-top: 1px solid var(--line-divider);
		margin: 1.2em 0;
	}

	/* Upload progress */
	.upload-progress {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px;
		border-top: 1px solid var(--line-divider);
		background: var(--muted);
	}
	.progress-bar {
		flex: 1;
		height: 6px;
		background: var(--line-divider);
		border-radius: 3px;
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 3px;
		transition: width 0.2s ease;
	}
	.progress-text {
		font-size: 12px;
		color: var(--content-meta);
		flex-shrink: 0;
		min-width: 5em;
		text-align: right;
	}

	/* Action buttons */
	.form-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 22px;
		background: var(--primary);
		color: white;
		font-weight: 600;
		font-size: 13px;
		border: none;
		border-radius: var(--radius-xl);
		cursor: pointer;
		transition: opacity 0.2s;
	}
	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 20px;
		background: transparent;
		color: var(--btn-content);
		font-weight: 500;
		font-size: 13px;
		border: 1px solid var(--line-divider);
		border-radius: var(--radius-xl);
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-secondary:hover {
		background: var(--btn-card-bg-hover);
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
		transition: background 0.15s;
		margin-left: auto;
	}
	.btn-danger:hover {
		background: var(--btn-card-bg-hover);
	}

	@media (max-width: 768px) {
		.editor-area.is-split {
			grid-template-columns: 1fr;
		}
		.meta-field[style*="200px"] {
			flex: 1 1 100% !important;
		}
		.editor-textarea {
			min-height: 300px;
		}
		.toolbar {
			position: sticky;
			top: 0;
			z-index: 20;
		}
	}
</style>
