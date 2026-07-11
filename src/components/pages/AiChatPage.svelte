<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { aiSummaryConfig } from "@/config";

const API_BASE = "https://i.520781.xyz";

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

let token = $state("");
let user = $state<User | null>(null);
let conversations = $state<Conversation[]>([]);
let currentConv = $state<Conversation | null>(null);
let modelIdx = $state(aiSummaryConfig.defaultModel);
let modelMenuOpen = $state(false);

onMount(() => {
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

	return () => clearInterval(retryTimer);
});

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

async function newConversation() {
	const res = await api("/conversations", {
		method: "POST",
		body: JSON.stringify({ title: "新对话" }),
	});
	if (res.ok) {
		const data = await res.json();
		conversations = [data.conversation, ...conversations];
		currentConv = data.conversation;
	}
}

async function deleteConv(id: string) {
	await api(`/conversations/${id}`, { method: "DELETE" });
	conversations = conversations.filter((c) => c.id !== id);
	if (currentConv?.id === id) {
		currentConv = null;
	}
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
  <div class="card-base overflow-hidden max-w-md mx-auto">
    <div class="flex flex-col bg-(--card-bg)">
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

      <div class="overflow-y-auto p-2 space-y-1" style="max-height: 60vh">
        {#each conversations as conv}
          <div
            class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 {currentConv?.id === conv.id ? 'bg-(--primary)/10 text-(--primary)' : 'hover:bg-black/5 dark:hover:bg-white/5 text-black/70 dark:text-white/70'}"
          >
            <span class="truncate flex-1">{conv.title}</span>
            <span
              onclick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
              class="shrink-0 cursor-pointer text-black/30 dark:text-white/30 hover:text-red-500"
            >
              <Icon icon="material-symbols:delete" size="sm" />
            </span>
          </div>
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
  </div>
{/if}