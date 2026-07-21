<script lang="ts">
import { onMount } from "svelte";

interface Article {
	floor: number;
	title: string;
	created: string;
	updated: string;
	link: string;
	author: string;
	avatar: string;
}

interface Statistics {
	friends_num: number;
	active_num: number;
	error_num: number;
	article_num: number;
	last_updated_time: string;
}

interface CircleData {
	statistical_data: Statistics;
	article_data: Article[];
}

interface Props {
	dataUrl: string;
	pageSize: number;
	showStats: boolean;
	showFloor: boolean;
	cacheTime: number;
	friendsLinkText: string;
	allFriendsUrl: string;
	emptyText: string;
	errorText: string;
	loadingText: string;
	refreshingText: string;
	sortLatestText: string;
	sortUpdatedText: string;
	loadMoreText: string;
	noMoreText: string;
	retryText: string;
	friendsStatText: string;
	activeStatText: string;
	articleStatText: string;
	randomNoticePrefix: string;
}

const {
	dataUrl,
	pageSize,
	showStats,
	showFloor,
	cacheTime,
	friendsLinkText,
	allFriendsUrl,
	emptyText,
	errorText,
	loadingText,
	refreshingText,
	sortLatestText,
	sortUpdatedText,
	loadMoreText,
	noMoreText,
	retryText,
	friendsStatText,
	activeStatText,
	articleStatText,
	randomNoticePrefix,
}: Props = $props();

let allArticles = $state<Article[]>([]);
let displayedArticles = $state<Article[]>([]);
let loading = $state(true);
let refreshing = $state(false);
let failed = $state(false);
let currentPage = $state(1);
let stats = $state<Statistics | null>(null);
let sortMode: "created" | "updated" = $state("created");
let randomNotice: Article | null = $state(null);

const totalPages = $derived(
	Math.max(1, Math.ceil(allArticles.length / pageSize)),
);

function shuffleArray<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function applySort(articles: Article[]): Article[] {
	const sorted = [...articles];
	sorted.sort((a, b) => {
		const dateA = new Date(
			sortMode === "created" ? a.created : a.updated,
		).getTime();
		const dateB = new Date(
			sortMode === "created" ? b.created : b.updated,
		).getTime();
		return dateB - dateA;
	});
	return sorted;
}

function updateDisplayed() {
	const sorted = applySort(allArticles);
	displayedArticles = sorted.slice(0, currentPage * pageSize);
}

function pickRandomNotice() {
	if (allArticles.length === 0) return;
	const recent = allArticles.slice(0, 6);
	randomNotice = recent[Math.floor(Math.random() * recent.length)];
}

async function loadData() {
	loading = true;
	failed = false;
	try {
		const resp = await fetch(dataUrl, {
			signal: AbortSignal.timeout(cacheTime),
		});
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const data: CircleData = await resp.json();
		allArticles = data.article_data || [];
		stats = data.statistical_data || null;
		currentPage = 1;
		updateDisplayed();
		pickRandomNotice();
	} catch {
		failed = true;
	} finally {
		loading = false;
	}
}

async function refresh() {
	if (refreshing) return;
	refreshing = true;
	try {
		const resp = await fetch(dataUrl, {
			signal: AbortSignal.timeout(cacheTime),
		});
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const data: CircleData = await resp.json();
		allArticles = data.article_data || [];
		stats = data.statistical_data || null;
		updateDisplayed();
		pickRandomNotice();
	} catch {
		// silent fail on refresh
	} finally {
		refreshing = false;
	}
}

function loadMore() {
	if (currentPage < totalPages) {
		currentPage++;
		updateDisplayed();
	}
}

function switchSort(mode: "created" | "updated") {
	if (sortMode === mode) return;
	sortMode = mode;
	updateDisplayed();
}

function handleRetry() {
	loadData();
}

onMount(() => {
	loadData();
});
</script>

<div class="circle-page">
	<div class="circle-header">
		<div class="circle-header-left">
			<div class="circle-header-icon">🎣</div>
			<h2>钓鱼</h2>
		</div>
		<div class="circle-header-actions">
			<button
				class="circle-refresh-btn"
				onclick={refresh}
				disabled={refreshing}
				title={refreshing ? refreshingText : "刷新"}
			>
				{#if refreshing}
					<span class="circle-loading-spinner" style="width:0.9rem;height:0.9rem;border-width:1.5px;"></span>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>
				{/if}
				{refreshing ? refreshingText : "刷新"}
			</button>
			<a href={allFriendsUrl} class="circle-all-link">
				{friendsLinkText}
				<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-4 4l4-4m-4-4l4 4"/></svg>
			</a>
		</div>
	</div>

	{#if !loading && !failed && randomNotice}
		<div class="circle-random-notice">
			<span class="circle-random-notice-icon">📢</span>
			<span class="circle-random-notice-text">
				{randomNoticePrefix}
				<a href={randomNotice.link} target="_blank" rel="noopener noreferrer">{randomNotice.author}</a>
				的文章: <a href={randomNotice.link} target="_blank" rel="noopener noreferrer">{randomNotice.title}</a>
			</span>
		</div>
	{/if}

	{#if showStats && stats}
		<div class="circle-stats">
			<span class="circle-stat-item">
				🌊 鱼塘 {friendsStatText}
				<strong>{stats.friends_num}</strong>
			</span>
			<span class="circle-stat-item">
				{activeStatText}
				<strong>{stats.active_num}</strong>
			</span>
			<span class="circle-stat-item">
				{articleStatText}
				<strong>{stats.article_num}</strong>
			</span>
		</div>
	{/if}

	<div class="circle-controls">
		<button
			class="circle-sort-btn"
			class:active={sortMode === "created"}
			onclick={() => switchSort("created")}
		>
			{sortLatestText}
		</button>
		<button
			class="circle-sort-btn"
			class:active={sortMode === "updated"}
			onclick={() => switchSort("updated")}
		>
			{sortUpdatedText}
		</button>
	</div>

	{#if loading}
		<div class="circle-loading">
			<div class="circle-loading-spinner"></div>
			<span>{loadingText}</span>
		</div>
	{:else if failed}
		<div class="circle-error">
			<div class="circle-error-icon">😵</div>
			<span>{errorText}</span>
			<button class="circle-retry-btn" onclick={handleRetry}>
				{retryText}
			</button>
		</div>
	{:else if displayedArticles.length === 0}
		<div class="circle-empty">
			<div class="circle-empty-icon">📭</div>
			<span>{emptyText}</span>
		</div>
	{:else}
		<div class="circle-grid">
			{#each displayedArticles as article (article.floor + article.link)}
				<a
					href={article.link}
					target="_blank"
					rel="noopener noreferrer"
					class="circle-card"
				>
					<div class="circle-card-body">
						<h3 class="circle-card-title">{article.title}</h3>
						{#if article.description}
							<p class="circle-card-desc">{article.description}</p>
						{/if}
					</div>
					<div class="circle-card-footer">
						<div class="circle-card-author">
							<span class="circle-card-author-name">{article.author}</span>
						</div>
						<span class="circle-card-date">
							{article.created || article.updated}
						</span>
					</div>
					<img
						src={article.avatar}
						alt=""
						class="circle-card-avatar-watermark"
						aria-hidden="true"
						loading="lazy"
					/>
				</a>
			{/each}
		</div>

		{#if currentPage < totalPages}
			<div class="circle-load-more">
				<button class="circle-load-more-btn" onclick={loadMore}>
					{loadMoreText}
				</button>
			</div>
		{:else if allArticles.length > 0}
			<div class="circle-no-more">{noMoreText}</div>
		{/if}
	{/if}
</div>


<!-- Styles are defined in src/styles/features/circle.css -->
