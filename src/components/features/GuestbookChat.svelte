<script lang="ts">
import { onDestroy, onMount } from "svelte";
import { commentConfig } from "@/config/commentConfig";

type Profile = { nick: string; mail: string; link: string };

const envId = commentConfig.twikoo.envId;
const PATH = "/guestbook/";

let messages = $state<CommentData[]>([]);
let loading = $state(true);
let text = $state("");
let sending = $state(false);
let error = $state("");
let replyNick = $state("");
let replyId = $state("");
let profile = $state<Profile>({ nick: "", mail: "", link: "" });
let profileOpen = $state(false);
let msgEl: HTMLDivElement | undefined = $state();
let textareaEl: HTMLTextAreaElement | undefined = $state();
let autoScroll = $state(true);

const KEY = "guestbook-profile";

function loadProfile() {
	try {
		const d = localStorage.getItem(KEY);
		if (d) profile = JSON.parse(d);
	} catch {}
	if (profile.mail) return;
	const twikooKeys = [
		`twikoo-${envId}`,
		"twikoo-commenter",
		"twikooOverseaCommenter",
		`twikoo-commenter-${envId}`,
	];
	for (const key of twikooKeys) {
		try {
			const d = localStorage.getItem(key);
			if (d) {
				const p = JSON.parse(d);
				if (p.mail) {
					profile = {
						mail: p.mail,
						nick: p.nick || profile.nick,
						link: p.link || profile.link || "",
					};
					return;
				}
			}
		} catch {}
	}
}
function saveProfile() {
	localStorage.setItem(KEY, JSON.stringify(profile));
}
function avatarUrl(mail: string | undefined, mailMd5?: string): string {
	const e = mail || "";
	const qq = e.match(/^(\d+)@qq\.com$/);
	if (qq) return `https://thirdqq.qlogo.cn/g?b=sdk&nk=${qq[1]}&s=140`;
	const hash = mailMd5 || "00000000000000000000000000000000";
	return `https://weavatar.com/avatar/${hash}?d=mp&s=100`;
}
function initials(s: string) {
	return s.slice(0, 2).toUpperCase();
}
function fmtTime(iso: string) {
	const d = new Date(iso);
	const n = Date.now();
	const m = Math.floor((n - d.getTime()) / 60000);
	if (m < 1) return "刚刚";
	if (m < 60) return `${m}分钟前`;
	if (m < 1440) return `${Math.floor(m / 60)}小时前`;
	if (m < 10080) return `${Math.floor(m / 1440)}天前`;
	return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isSelf(msg: CommentData) {
	if (profile.mail && msg.mail && msg.mail === profile.mail) return true;
	const ids: string[] = JSON.parse(localStorage.getItem("gb-self-ids") || "[]");
	return ids.includes(msg.id);
}
function token(): string {
	return localStorage.getItem("twikoo-access-token") || "";
}
function setToken(t: string) {
	if (t) localStorage.setItem("twikoo-access-token", t);
}

async function api(event: string, data: Record<string, unknown> = {}) {
	const body = {
		event,
		accessToken: token(),
		envId,
		path: PATH,
		url: PATH,
		...data,
	};
	const res = await fetch(envId, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	let text2: string;
	try {
		text2 = await res.text();
	} catch {
		text2 = "";
	}
	// biome-ignore lint/suspicious/noExplicitAny: API response shape varies
	let json: any;
	try {
		json = JSON.parse(text2);
	} catch {
		json = { raw: text2 };
	}
	setToken(json.accessToken);
	if (!res.ok) throw new Error(json.message || json.msg || res.statusText);
	return { result: json };
}

interface CommentData {
	id: string;
	nick: string;
	comment: string;
	content?: string;
	created: string;
	mail?: string;
	mailMd5?: string;
	link?: string;
	pid?: string;
	rid?: string;
	ua?: string;
	isAdmin?: boolean;
	isSpam?: boolean;
	children?: CommentData[];
}

function flatten(list: CommentData[]): CommentData[] {
	const r: CommentData[] = [];
	function walk(arr: CommentData[], parentNick?: string) {
		for (const c of arr) {
			const txt = c.comment ?? c.content ?? "";
			const prefixed = parentNick ? `@${parentNick} ${txt}` : txt;
			r.push({ ...c, comment: prefixed, children: [] });
			if (c.children?.length) walk(c.children, c.nick);
		}
	}
	walk(list);
	r.sort(
		(a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
	);
	return r;
}

async function fetchAll() {
	try {
		const res = await api("COMMENT_GET", { per: 999, page: 1, sort: 0 });
		const raw = res?.result?.data || [];
		messages = flatten(raw);
	} catch (e) {
		console.error(e);
		error = "加载失败";
	} finally {
		loading = false;
	}
}

async function send() {
	const content = text.trim();
	if (!content || sending) return;
	if (!profile.nick) {
		profileOpen = true;
		return;
	}
	sending = true;
	error = "";
	try {
		const body: Record<string, unknown> = {
			comment: content,
			nick: profile.nick,
			mail: profile.mail || "",
			link: profile.link || "",
			ua: navigator.userAgent,
		};
		if (replyId) body.pid = replyId;
		const res = await api("COMMENT_SUBMIT", body);
		if (!res?.result?.id) {
			console.error("submit failed", res);
			throw new Error(res?.result?.message || "提交失败");
		}
		const selfIds: string[] = JSON.parse(
			localStorage.getItem("gb-self-ids") || "[]",
		);
		selfIds.push(res.result.id);
		localStorage.setItem("gb-self-ids", JSON.stringify(selfIds));
		text = "";
		replyNick = "";
		replyId = "";
		await fetchAll();
		requestAnimationFrame(() => {
			if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
		});
	} catch (e) {
		console.error("send error", e);
		error = `发送失败: ${(e as Error).message}`;
	} finally {
		sending = false;
	}
}

async function del(id: string) {
	if (!confirm("删除这条留言？")) return;
	try {
		await api("COMMENT_DELETE_FOR_USER", { id });
		messages = messages.filter((m) => m.id !== id);
	} catch {
		error = "删除失败";
	}
}

function onScroll() {
	if (!msgEl) return;
	const { scrollTop, scrollHeight, clientHeight } = msgEl;
	autoScroll = scrollHeight - scrollTop - clientHeight < 100;
}

function handleKey(e: KeyboardEvent) {
	if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
		e.preventDefault();
		send();
	}
}

let timer: ReturnType<typeof setInterval>;

onMount(() => {
	loadProfile();
	fetchAll();
	timer = setInterval(fetchAll, 30000);
});
onDestroy(() => {
	if (timer) clearInterval(timer);
});
$effect(() => {
	if (messages.length && autoScroll && !loading) {
		requestAnimationFrame(() => {
			if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
		});
	}
});
$effect(() => {
	void text;
	if (textareaEl) {
		textareaEl.style.height = "auto";
		textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, 150)}px`;
	}
});
</script>

<div class="gb">
	<div class="gb__head">
		<span class="gb__title">留言板</span>
		<span class="gb__count">{messages.length} 条留言</span>
	</div>

	<div class="gb__msgs" bind:this={msgEl} onscroll={onScroll}>
		{#if loading}
			<div class="gb__ld">
				<span class="gb__sp"></span> 加载中...
			</div>
		{:else if messages.length === 0}
			<div class="gb__empty">
				<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
				<p>还没有留言</p>
				<span>来说点什么吧 👋</span>
			</div>
		{:else}
			{#each messages as msg (msg.id)}
				<div class="gb__row" class:gb__row--self={isSelf(msg)} class:gb__row--admin={msg.isAdmin}>
					<div class="gb__av" class:gb__av--self={isSelf(msg)} class:gb__av--admin={msg.isAdmin}>
						<img src={avatarUrl(msg.mail, msg.mailMd5)} alt={msg.nick} onerror={(e) => { const el = e.target as HTMLElement; el.style.display = "none"; (el.nextElementSibling as HTMLElement).style.display = ""; }} />
						<span style="display:none">{initials(msg.nick)}</span>
					</div>
					<div class="gb__body">
						<div class="gb__meta" class:gb__meta--self={isSelf(msg)}>
							<span class="gb__nick" class:gb__nick--admin={msg.isAdmin}>{msg.nick}</span>
							{#if msg.isAdmin}<span class="gb__badge">站长</span>{/if}
							<span class="gb__time">{fmtTime(msg.created)}</span>
						</div>
						<div class="gb__bub" class:gb__bub--self={isSelf(msg)} class:gb__bub--admin={msg.isAdmin}>{@html msg.comment}</div>
						<div class="gb__act" class:gb__act--self={isSelf(msg)}>
							<button onclick={() => { replyNick = msg.nick; replyId = msg.id; if (msgEl) msgEl.scrollTo({ top: msgEl.scrollHeight, behavior: "smooth" }); }}>回复</button>
							{#if isSelf(msg)}<button class="gb__del" onclick={() => del(msg.id)}>删除</button>{/if}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	{#if replyNick}
		<div class="gb__rep">
			<span>回复 @{replyNick}</span>
			<button onclick={() => { replyNick = ""; replyId = ""; }}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
			</button>
		</div>
	{/if}

	{#if error}
		<div class="gb__err">{error}</div>
	{/if}

	<div class="gb__inp">
		<button class="gb__usr" onclick={() => (profileOpen = true)} title="设置昵称">
			{#if profile.nick}
				{initials(profile.nick)}
			{:else}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
			{/if}
		</button>
		<textarea bind:value={text} bind:this={textareaEl} placeholder="说点什么..." onkeydown={handleKey} rows="1"></textarea>
		<button class="gb__send" onclick={send} disabled={sending || !text.trim()}>
			{#if sending}
				<span class="gb__sp"></span>
			{:else}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
			{/if}
		</button>
	</div>
</div>

{#if profileOpen}
	<div class="gb__over" onclick={() => (profileOpen = false)}>
		<div class="gb__modal" onclick={(e) => e.stopPropagation()}>
			<div class="gb__mt">设置昵称</div>
			<div class="gb__mb">
				<label><span>昵称 *</span><input type="text" bind:value={profile.nick} placeholder="你的昵称" maxlength="20" /></label>
				<label><span>邮箱</span><input type="email" bind:value={profile.mail} placeholder="邮箱" /></label>
				<label><span>网站</span><input type="url" bind:value={profile.link} placeholder="https://" /></label>
			</div>
			<div class="gb__mf">
				<button onclick={() => { if (profile.nick.trim()) { saveProfile(); profileOpen = false; } }}>确认</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.gb {
		background: var(--card-bg);
		border-radius: var(--radius-large);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.gb__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--line-divider);
	}
	.gb__title { font-size: 15px; font-weight: 700; color: var(--deep-text); }
	.gb__count { font-size: 12px; color: var(--content-meta); }

	.gb__msgs {
		flex: 1;
		overflow-y: auto;
		padding: 12px 16px;
		min-height: 280px;
		max-height: 520px;
	}
	.gb__ld {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 48px 0;
		color: var(--content-meta);
		font-size: 14px;
	}
	.gb__sp {
		width: 14px; height: 14px;
		border: 2px solid var(--line-divider);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: gbspin 0.6s linear infinite;
		display: inline-block;
	}
	@keyframes gbspin { to { transform: rotate(360deg); } }
	.gb__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 48px 0;
		color: var(--content-meta);
	}
	.gb__empty p { font-weight: 600; margin: 0; }
	.gb__empty span { font-size: 13px; opacity: 0.7; }

	.gb__row {
		display: flex;
		gap: 10px;
		margin-bottom: 16px;
		animation: gbfade 0.2s ease;
	}
	.gb__row--self {
		flex-direction: row-reverse;
	}
	@keyframes gbfade {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.gb__av {
		width: 36px; height: 36px; min-width: 36px;
		border-radius: 50%;
		background: var(--btn-regular-bg);
		color: var(--btn-content);
		display: flex; align-items: center; justify-content: center;
		font-size: 13px; font-weight: 700;
		flex-shrink: 0;
	}
	.gb__av img {
		width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
	}
	.gb__av--admin {
		background: var(--primary);
		color: #fff;
	}
	:root.dark .gb__av--admin { color: #000; }

	.gb__body { flex: 1; min-width: 0; }
	.gb__row--self .gb__body {
		display: flex; flex-direction: column; align-items: flex-end;
	}

	.gb__meta {
		display: flex; align-items: center; gap: 6px; margin-bottom: 3px;
	}
	.gb__meta--self {
		flex-direction: row-reverse;
	}
	.gb__nick {
		font-size: 13px; font-weight: 600; color: var(--deep-text);
	}
	.gb__nick--admin { color: var(--primary); }
	.gb__badge {
		font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
		background: var(--primary); color: #fff; line-height: 1.4;
	}
	:root.dark .gb__badge { color: #000; }
	.gb__time { font-size: 11px; color: var(--content-meta); }

	.gb__bub {
		display: inline-block;
		padding: 8px 14px;
		border-radius: 12px 12px 12px 4px;
		background: var(--btn-regular-bg);
		color: var(--deep-text);
		font-size: 14px; line-height: 1.55;
		word-break: break-word;
		max-width: 85%;
	}
	.gb__bub--self {
		background: var(--primary); color: #fff;
		border-radius: 12px 12px 4px 12px;
	}
	:root.dark .gb__bub--self { color: #000; }
	.gb__bub--admin {
		background: var(--primary); color: #fff;
		border-radius: 12px 12px 4px 12px;
	}
	:root.dark .gb__bub--admin { color: #000; }
	.gb__bub :global(p) { margin: 0 0 4px; }
	.gb__bub :global(p:last-child) { margin-bottom: 0; }
	.gb__bub :global(br) { display: inline; }
	.gb__bub :global(img) { max-width: 100%; border-radius: 6px; margin: 4px 0; }

	.gb__act {
		display: flex; gap: 4px; margin-top: 2px;
		opacity: 0; transition: opacity 0.15s;
	}
	.gb__act--self {
		justify-content: flex-end;
	}
	.gb__row:hover .gb__act { opacity: 1; }
	.gb__act button {
		font-size: 11px; padding: 2px 6px; border: none; background: none;
		color: var(--content-meta); cursor: pointer; border-radius: 4px;
	}
	.gb__act button:hover { color: var(--primary); background: var(--btn-regular-bg); }
	.gb__del:hover { color: #ef4444 !important; }

	.gb__rep {
		display: flex; align-items: center; justify-content: space-between;
		padding: 6px 16px; background: var(--btn-regular-bg);
		font-size: 12px; color: var(--primary); font-weight: 600;
		border-top: 1px solid var(--line-divider);
	}
	.gb__rep button {
		border: none; background: none; color: var(--content-meta);
		cursor: pointer; display: flex; padding: 2px; border-radius: 4px;
	}
	.gb__rep button:hover { color: var(--deep-text); background: var(--btn-regular-bg); }

	.gb__err {
		padding: 6px 16px; font-size: 12px; color: #ef4444;
		background: #fef2f2; border-top: 1px solid #fecaca;
	}
	:root.dark .gb__err { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.2); }

	.gb__inp {
		display: flex; align-items: center; gap: 8px;
		padding: 10px 12px; border-top: 1px solid var(--line-divider);
		background: var(--card-bg);
	}
	.gb__usr {
		width: 32px; height: 32px; min-width: 32px;
		border-radius: 50%; border: 1px dashed var(--line-divider);
		background: none; color: var(--content-meta);
		display: flex; align-items: center; justify-content: center;
		cursor: pointer; font-size: 12px; font-weight: 700;
	}
	.gb__usr:hover { border-color: var(--primary); color: var(--primary); background: var(--btn-regular-bg); }
	.gb__inp textarea {
		flex: 1; border: none; padding: 7px 12px; font-size: 14px; line-height: 1.5;
		background: none; color: var(--deep-text); resize: none; outline: none;
		font-family: inherit; min-height: 32px;
	}
	.gb__inp textarea::placeholder { color: var(--content-meta); opacity: 0.6; }
	.gb__send {
		width: 34px; height: 34px; min-width: 34px;
		border-radius: 50%; border: none; background: none;
		color: var(--deep-text); cursor: pointer;
		display: flex; align-items: center; justify-content: center;
	}
	.gb__send:disabled { opacity: 0.3; cursor: not-allowed; }
	.gb__send:not(:disabled):hover { color: var(--primary); background: var(--btn-regular-bg); }

	.gb__over {
		position: fixed; inset: 0; background: rgba(0,0,0,0.4);
		display: flex; align-items: center; justify-content: center;
		z-index: 1000; padding: 16px;
	}
	.gb__modal {
		background: var(--card-bg); border-radius: var(--radius-large);
		padding: 24px; width: 100%; max-width: 340px;
	}
	.gb__mt { font-size: 16px; font-weight: 700; color: var(--deep-text); margin-bottom: 16px; }
	.gb__mb { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
	.gb__mb label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--content-meta); }
	.gb__mb input {
		padding: 8px 12px; border: 1px solid var(--line-divider);
		border-radius: 8px; font-size: 14px; background: var(--card-bg);
		color: var(--deep-text); outline: none;
	}
	.gb__mb input:focus { border-color: var(--primary); }
	.gb__mf { display: flex; justify-content: flex-end; }
	.gb__mf button {
		padding: 8px 24px; border-radius: 8px; border: none;
		background: var(--primary); color: #fff; font-size: 14px;
		font-weight: 600; cursor: pointer;
	}
	:root.dark .gb__mf button { color: #000; }
	.gb__mf button:hover { opacity: 0.9; }

	@media (max-width: 768px) {
		.gb__msgs { padding: 10px 12px; min-height: 220px; max-height: 380px; }
		.gb__bub { max-width: 92%; font-size: 13px; }
		.gb__act { opacity: 1; }
	}
</style>
