<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { aiSummaryConfig } from "@/config";

const API_BASE = "https://i.520781.xyz";

interface PagefindResult {
	id: string;
	data(): Promise<{ meta: { title: string }; excerpt: string; url: string }>;
}

interface User {
	id: number;
	github_id: number;
	username: string;
	avatar_url: string | null;
}

interface Conversation {
	id: string;
	user_id: number;
	title: string;
	created_at: string;
	updated_at: string;
}

interface Message {
	id: number;
	conversation_id: string;
	role: "user" | "assistant";
	content: string;
	created_at: string;
}

let token = $state("");
let user = $state<User | null>(null);
let conversations = $state<Conversation[]>([]);
let currentConv = $state<Conversation | null>(null);
let messages = $state<Message[]>([]);
let inputText = $state("");
let loading = $state(false);
let streaming = $state(false);
let streamContent = $state("");
let showSidebar = $state(true);
let searchQuery = $state("");
let searchResults = $state<
	{ id: string; title: string; excerpt: string; url: string }[]
>([]);
let searchOpen = $state(false);
let pagefindReady = $state(false);
let modelIdx = $state(aiSummaryConfig.defaultModel);
let modelMenuOpen = $state(false);

onMount(() => {
	showSidebar = window.innerWidth >= 768;

	const params = new URLSearchParams(window.location.search);
	const urlToken = params.get("token");
	if (urlToken) {
		token = urlToken;
		localStorage.setItem("firefly-chat-token", urlToken);
		window.history.replaceState({}, "", "/chat/");
	} else {
		token = localStorage.getItem("firefly-chat-token") || "";
	}

	if (token) {
		loadUser();
		loadConversations();
	}

	const retryTimer = setInterval(() => {
		if (token && !user) {
			loadUser();
			loadConversations();
		} else {
			clearInterval(retryTimer);
		}
	}, 5000);

	initPagefind();
	return () => clearInterval(retryTimer);
});

async function initPagefind() {
	if (window.pagefind) {
		pagefindReady = true;
		return;
	}
	const handleReady = () => {
		pagefindReady = true;
	};
	window.addEventListener("pagefindready", handleReady);
	if (!window.pagefind && import.meta.env.PROD) {
		try {
			const pagefindUrl = "/pagefind/pagefind.js";
			const pagefind = await import(/* @vite-ignore */ pagefindUrl);
			await pagefind.options({ excerptLength: 30 });
			window.pagefind = pagefind;
			pagefindReady = true;
		} catch {}
	}
	return () => window.removeEventListener("pagefindready", handleReady);
}

async function api(path: string, opts: RequestInit = {}) {
	return fetch(`${API_BASE}${path}`, {
		...opts,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...((opts.headers as Record<string, string>) || {}),
		},
	});
}

async function loadUser() {
	try {
		const res = await api("/me");
		if (res.ok) {
			const data = await res.json();
			user = data.user;
		} else if (res.status === 401) {
			token = "";
			localStorage.removeItem("firefly-chat-token");
		}
	} catch {}
}

async function loadConversations() {
	try {
		const res = await api("/conversations");
		if (res.ok) {
			const data = await res.json();
			conversations = data.conversations;
		}
	} catch {}
}

async function selectConversation(conv: Conversation) {
	currentConv = conv;
	try {
		const res = await api(`/conversations/${conv.id}`);
		if (res.ok) {
			const data = await res.json();
			messages = data.messages;
		}
	} catch {}
	if (window.innerWidth < 768) showSidebar = false;
}

async function newConversation() {
	const res = await api("/conversations", {
		method: "POST",
		body: JSON.stringify({ title: "新对话" }),
	});
	if (res.ok) {
		const data = await res.json();
		conversations = [data.conversation, ...conversations];
		currentConv = data.conversation;
		messages = [];
		if (window.innerWidth < 768) showSidebar = false;
	}
}

async function deleteConv(id: string) {
	await api(`/conversations/${id}`, { method: "DELETE" });
	conversations = conversations.filter((c) => c.id !== id);
	if (currentConv?.id === id) {
		currentConv = null;
		messages = [];
	}
}

async function sendMessage() {
	const text = inputText.trim();
	if (!text || streaming) return;

	let convId = currentConv?.id || "new";
	inputText = "";

	messages = [
		...messages,
		{
			id: Date.now(),
			conversation_id: convId,
			role: "user",
			content: text,
			created_at: new Date().toISOString(),
		},
	];

	streaming = true;
	streamContent = "";

	let context = "";
	if (window.pagefind) {
		try {
			const result = await window.pagefind.search(text);
			if (result.results.length > 0) {
				const top = result.results.slice(0, 3);
				const articles = await Promise.all(
					top.map(async (r: PagefindResult) => {
						const data = await r.data();
						return `${data.meta.title}: ${(data.excerpt || "").replace(/<[^>]*>/g, "").slice(0, 200)}`;
					}),
				);
				context = articles.join("\n");
			}
		} catch {}
	}

	try {
		const res = await fetch(`${API_BASE}/chat/persona`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({
				conversationId: convId,
				message: text,
				modelIdx,
				articleContext: context,
			}),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: "Request failed" }));
			messages = [
				...messages,
				{
					id: Date.now(),
					conversation_id: convId,
					role: "assistant",
					content: `错误: ${err.error}`,
					created_at: new Date().toISOString(),
				},
			];
			streaming = false;
			return;
		}

		const reader = res.body?.getReader();
		if (!reader) throw new Error("No reader");

		const decoder = new TextDecoder();
		let buf = "";
		let fullContent = "";
		let newConvId = convId;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buf += decoder.decode(value, { stream: true });
			const lines = buf.split("\n");
			buf = lines.pop() || "";

			for (const line of lines) {
				if (line.startsWith("{")) {
					try {
						const meta = JSON.parse(line);
						if (meta.conversationId) {
							newConvId = meta.conversationId;
							convId = newConvId;
							if (!conversations.find((c) => c.id === newConvId)) {
								currentConv = {
									id: newConvId,
									user_id: user?.id || 0,
									title: text.slice(0, 30),
									created_at: new Date().toISOString(),
									updated_at: new Date().toISOString(),
								};
								conversations = [currentConv, ...conversations];
							}
						}
					} catch {}
					continue;
				}
				if (!line.startsWith("data: ")) continue;
				const data = line.slice(6).trim();
				if (data === "[DONE]") continue;
				try {
					const parsed = JSON.parse(data);
					const content = parsed.choices?.[0]?.delta?.content;
					if (content) {
						fullContent += content;
						streamContent = fullContent;
					}
				} catch {}
			}
		}

		if (fullContent) {
			messages = [
				...messages,
				{
					id: Date.now(),
					conversation_id: convId,
					role: "assistant",
					content: fullContent,
					created_at: new Date().toISOString(),
				},
			];
			loadConversations();
		}
	} catch (e: unknown) {
		messages = [
			...messages,
			{
				id: Date.now(),
				conversation_id: convId,
				role: "assistant",
				content: `连接错误: ${e instanceof Error ? e.message : "未知错误"}`,
				created_at: new Date().toISOString(),
			},
		];
	}

	streaming = false;
	streamContent = "";
}

let searchDebounce: ReturnType<typeof setTimeout>;

async function searchArticles() {
	const q = searchQuery.trim();
	if (!q) {
		searchOpen = false;
		searchResults = [];
		return;
	}
	searchOpen = true;
	clearTimeout(searchDebounce);
	searchDebounce = setTimeout(async () => {
		if (!window.pagefind) {
			searchResults = [];
			return;
		}
		try {
			const result = await window.pagefind.search(q);
			if (result.results.length > 0) {
				searchResults = await Promise.all(
					result.results.slice(0, 5).map(async (r: PagefindResult) => {
						const data = await r.data();
						return {
							id: r.id,
							title: data.meta.title || "无标题",
							excerpt: data.excerpt?.replace(/<[^>]*>/g, "") || "",
							url: data.url || "#",
						};
					}),
				);
			} else {
				searchResults = [];
			}
		} catch {
			searchResults = [];
		}
	}, 300);
}

function insertArticleContext(article: {
	title: string;
	excerpt: string;
	url: string;
}) {
	inputText = `关于文章《${article.title}》：${article.excerpt.slice(0, 100)}`;
	searchOpen = false;
}

function login() {
	window.location.href = `${API_BASE}/auth/github`;
}

async function logout() {
	await api("/logout", { method: "POST" });
	token = "";
	user = null;
	localStorage.removeItem("firefly-chat-token");
	conversations = [];
	currentConv = null;
	messages = [];
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
}
</script>

{#if !token || !user}
  <div class="flex flex-col items-center justify-center min-h-[70vh] gap-6">
    <div class="w-16 h-16 rounded-full bg-(--primary)/10 flex items-center justify-center text-(--primary)">
      <Icon icon="material-symbols:link" class="text-2xl" />
    </div>
    <h1 class="text-2xl font-bold text-black/80 dark:text-white/80">流萤AI</h1>
    <p class="text-sm text-black/50 dark:text-white/50">登录后开始与 AI 聊天，可以搜索本站文章进行讨论</p>
    <button
      onclick={login}
      class="flex items-center gap-2 px-6 py-3 bg-(--primary) text-white rounded-lg font-bold hover:opacity-90 transition-all active:scale-95"
    >
      GitHub 登录
    </button>
  </div>
{:else}
  <div class="flex h-[80vh] gap-0 card-base overflow-hidden">
    {#if showSidebar}
      <div class="md:hidden fixed inset-0 z-30 bg-black/30" onclick={() => showSidebar = false}></div>
      <div class="w-64 shrink-0 border-r border-(--line-divider) flex flex-col bg-(--card-bg) fixed inset-y-0 left-0 z-40 shadow-xl md:relative md:shadow-none md:flex">
        <div class="p-3 border-b border-(--line-divider) flex items-center gap-2">
          {#if user.avatar_url}
            <img src={user.avatar_url} alt={user.username} class="w-8 h-8 rounded-full" />
          {/if}
          <span class="text-sm font-bold text-black/70 dark:text-white/70 flex-1 truncate">{user.username}</span>
          <button onclick={logout} class="text-xs text-black/40 dark:text-white/40 hover:text-red-500" title="退出登录">
            <Icon icon="material-symbols:logout" size="sm" />
          </button>
        </div>

        <button
          onclick={newConversation}
          class="mx-3 mt-3 px-3 py-2 bg-(--primary) text-white rounded-lg text-sm font-bold hover:opacity-90 transition-colors flex items-center gap-2 justify-center"
        >
          <Icon icon="material-symbols:add" size="sm" />
          新对话
        </button>

        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          {#each conversations as conv}
            <button
              onclick={() => selectConversation(conv)}
              class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 {currentConv?.id === conv.id ? 'bg-(--primary)/10 text-(--primary)' : 'hover:bg-black/5 dark:hover:bg-white/5 text-black/70 dark:text-white/70'}"
            >
              <span class="truncate flex-1">{conv.title}</span>
              <span
                onclick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
                class="shrink-0 cursor-pointer text-black/30 dark:text-white/30 hover:text-red-500"
              >
                <Icon icon="material-symbols:delete" size="sm" />
              </span>
            </button>
          {/each}
        </div>

        <div class="px-3 py-2 border-t border-(--line-divider) relative">
          <button
            onclick={() => modelMenuOpen = !modelMenuOpen}
            class="flex items-center gap-1 w-full text-xs text-black/60 dark:text-white/60 hover:text-(--primary) transition-colors"
          >
            <Icon icon="material-symbols:settings" size="sm" />
            <span class="flex-1 text-left">{aiSummaryConfig.models[modelIdx]?.name}</span>
            <Icon icon="material-symbols:chevron-right" size="sm" class="transition-transform {modelMenuOpen ? 'rotate-90' : ''}" />
          </button>
          {#if modelMenuOpen}
            <div class="absolute bottom-full left-0 right-0 mb-1 bg-(--card-bg) border border-(--line-divider) rounded-lg shadow-lg z-10 overflow-hidden">
              {#each aiSummaryConfig.models as model, idx}
                <button
                  onclick={() => { modelIdx = idx; modelMenuOpen = false; }}
                  class="block w-full text-left px-3 py-2 text-xs transition-colors {idx === modelIdx ? 'bg-(--primary)/10 text-(--primary) font-bold' : 'hover:bg-black/5 dark:hover:bg-white/5 text-black/70 dark:text-white/70'}"
                >
                  {model.name}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <div class="flex-1 flex flex-col min-w-0">
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#if currentConv}
          {#each messages as msg}
            <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
              <div
                class="max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words {msg.role === 'user' ? 'bg-(--primary) text-white' : 'bg-(--btn-regular-bg) text-(--btn-content)'}"
              >
                {msg.content}
              </div>
            </div>
          {/each}
          {#if streaming && streamContent}
            <div class="flex justify-start">
              <div class="max-w-[80%] px-4 py-2 rounded-2xl text-sm bg-(--btn-regular-bg) text-(--btn-content) whitespace-pre-wrap break-words">
                {streamContent}
                <span class="inline-block w-2 h-4 bg-(--primary) animate-pulse ml-0.5"></span>
              </div>
            </div>
          {/if}
        {:else}
          <div class="flex flex-col items-center justify-center h-full gap-4 text-black/50 dark:text-white/50">
            <div class="w-16 h-16 rounded-full bg-(--primary)/10 flex items-center justify-center text-(--primary)">
              <Icon icon="material-symbols:forum" class="text-2xl" />
            </div>
            <p class="text-lg font-bold">欢迎来到流萤AI</p>
            <p class="text-sm">在下方输入消息开始聊天</p>
          </div>
        {/if}
        <div id="chat-bottom"></div>
      </div>

      <div class="p-4 border-t border-(--line-divider)">
        <div class="flex gap-2">
          <button
            onclick={() => showSidebar = !showSidebar}
            class="md:hidden px-2 text-sm text-black/50 dark:text-white/50"
          >
            <Icon icon="material-symbols:menu" size="lg" />
          </button>
          <textarea
            bind:value={inputText}
            onkeydown={handleKeydown}
            placeholder="输入消息... (Enter 发送)"
            rows="1"
            class="flex-1 px-4 py-2 text-sm rounded-xl bg-(--btn-regular-bg) text-(--btn-content) border border-(--line-divider) focus:outline-none focus:border-(--primary) resize-none"
          ></textarea>
          <button
            onclick={sendMessage}
            disabled={!inputText.trim() || streaming}
            class="px-4 py-2 bg-(--primary) text-white rounded-xl font-bold disabled:opacity-50 hover:opacity-90 transition-colors shrink-0"
          >
            {streaming ? "..." : "发送"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}