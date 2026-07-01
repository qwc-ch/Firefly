<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import { aiSummaryConfig } from "@/config/aiSummaryConfig";

interface TocItem {
	id: string;
	text: string;
}

interface SummaryParagraph {
	p: string;
	r?: number[];
}

let {
	url = "",
	toc = [] as TocItem[],
	enabled = true,
}: { url?: string; toc?: TocItem[]; enabled?: boolean } = $props();

let modelIdx = $state(aiSummaryConfig.defaultModel ?? 0);
let loading = $state(false);
let thinking = $state("");
let showThinking = $state(true);
let result = $state<SummaryParagraph[]>([]);
let questions = $state<string[]>([]);
let error = $state(false);
let stats = $state("");
let hasStarted = $state(false);
let isMenuOpen = $state(false);
let rawText = $state("");

let summaryBox: HTMLDivElement | undefined = $state();
let observer: IntersectionObserver | null = null;

onMount(() => {
	const saved = localStorage.getItem("firefly-ai-summary-model");
	if (saved && aiSummaryConfig.models[Number.parseInt(saved, 10)]) {
		modelIdx = Number.parseInt(saved, 10);
	}
	if (!summaryBox) {
		fetchSummary();
		return;
	}
	observer = new IntersectionObserver(
		([entry]) => {
			if (entry.isIntersecting) {
				observer?.disconnect();
				fetchSummary();
			}
		},
		{ rootMargin: "200px" },
	);
	observer.observe(summaryBox);

	const handleSwup = () => fetchSummary();
	document.addEventListener("astro:page-load", handleSwup);
	return () => {
		observer?.disconnect();
		document.removeEventListener("astro:page-load", handleSwup);
	};
});

async function fetchSummary(forceModelIdx?: number) {
	const targetIdx = forceModelIdx !== undefined ? forceModelIdx : modelIdx;
	const models = aiSummaryConfig.models;
	if (!models.length) return;

	loading = true;
	error = false;
	thinking = "";
	rawText = "";
	result = [];
	questions = [];
	hasStarted = false;
	showThinking = true;
	stats = "";

	let usedIdx = -1;
	let resp: Response | null = null;
	const startTime = Date.now();

	for (let i = targetIdx; i < models.length; i++) {
		try {
			resp = await fetch(models[i].url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ articleUrl: url }),
			});
			if (resp.ok) {
				usedIdx = i;
				break;
			}
		} catch {}
	}
	if (!resp?.ok) {
		for (let i = 0; i < targetIdx; i++) {
			try {
				resp = await fetch(models[i].url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ articleUrl: url }),
				});
				if (resp.ok) {
					usedIdx = i;
					break;
				}
			} catch {}
		}
	}

	if (!resp?.ok) {
		error = true;
		loading = false;
		return;
	}

	if (usedIdx !== modelIdx) {
		modelIdx = usedIdx;
		localStorage.setItem("firefly-ai-summary-model", String(usedIdx));
	}

	let usedModelName = models[usedIdx].name;

	const reader = resp.body?.getReader();
	if (!reader) {
		error = true;
		loading = false;
		return;
	}

	const decoder = new TextDecoder();
	let buf = "";
	let firstContentTime = 0;
	let fullContent = "";
	let completionTokens = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buf += decoder.decode(value, { stream: true });
		const lines = buf.split("\n");
		buf = lines.pop() || "";

		for (const line of lines) {
			if (!line.startsWith("data: ")) continue;
			const data = line.slice(6).trim();
			if (data === "[DONE]") continue;

			try {
				const parsed = JSON.parse(data);
				if (parsed.usage?.completion_tokens) {
					completionTokens = parsed.usage.completion_tokens;
				}
				if (parsed.model) usedModelName = parsed.model;
				const delta = parsed.choices?.[0]?.delta;

				if (delta?.reasoning_content) {
					thinking += delta.reasoning_content;
				}

				if (delta?.content) {
					if (!firstContentTime) {
						firstContentTime = Date.now();
						hasStarted = true;
						showThinking = false;
					}
					fullContent += delta.content;
					rawText = fullContent;
				}
			} catch {}
		}
	}

	parseResult(fullContent);

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	const ttft = firstContentTime
		? `${((firstContentTime - startTime) / 1000).toFixed(1)}s`
		: "-";
	const tks = completionTokens || Math.round(fullContent.length / 3);
	stats = `${usedModelName.split("/").pop()} · D: ${ttft} · T: ${tks} · ${elapsed}s`;

	loading = false;
}

function parseResult(text: string) {
	let clean = text
		.replace(/```(?:json)?\s*/gi, "")
		.replace(/\s*```/g, "")
		.trim();
	let externalQ: string[] = [];

	const afterArray = clean.slice(clean.lastIndexOf("]") + 1);
	const qOuter = afterArray.match(/\{"q":\s*\[/);
	if (qOuter) {
		const qStart = afterArray.indexOf("{");
		try {
			const qObj = JSON.parse(afterArray.slice(qStart));
			if (Array.isArray(qObj.q)) externalQ = qObj.q;
		} catch {}
	}

	const startB = clean.indexOf("[");
	const endB = clean.lastIndexOf("]");
	if (startB !== -1 && endB > startB) clean = clean.slice(startB, endB + 1);

	try {
		const data = JSON.parse(clean);
		if (Array.isArray(data)) {
			result = data.filter((d: Record<string, unknown>) => "p" in d);
			if (externalQ.length > 0) questions = externalQ;
			else
				questions =
					(data.find((d: Record<string, unknown>) => "q" in d)
						?.q as string[]) || [];
			return;
		}
	} catch {}
}

function selectModel(idx: number) {
	isMenuOpen = false;
	modelIdx = idx;
	localStorage.setItem("firefly-ai-summary-model", String(idx));
	fetchSummary(idx);
}

const defaultQuestions = ["详细概括本文内容", "概括文章特点"];
</script>

{#if enabled}
<div bind:this={summaryBox} class="card-base p-4 sm:p-5 mb-6">
  <div class="flex items-center justify-between border-b border-(--line-divider) pb-3 mb-3">
    <div class="flex items-center gap-2">
      <span class="text-(--primary) text-lg">✨</span>
      <h3 class="font-bold text-(--primary) uppercase tracking-wider text-sm">{i18n(I18nKey.aiSummary)}</h3>
      {#if stats}
        <span class="ml-2 text-[10px] font-mono text-black/30 dark:text-white/30 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-sm hidden sm:inline-block">{stats}</span>
      {/if}
    </div>

    <div class="relative">
      <button
        onclick={() => isMenuOpen = !isMenuOpen}
        class="flex items-center gap-1 text-xs font-bold text-black/50 dark:text-white/50 hover:text-(--primary) transition-colors bg-(--enter-btn-bg) px-2 py-1 rounded-lg"
      >
        <span class="text-xs">⚙️</span>
        {aiSummaryConfig.models[modelIdx]?.name}
        <span class="text-xs">{isMenuOpen ? "▲" : "▼"}</span>
      </button>

      {#if isMenuOpen}
        <div class="absolute right-0 top-full mt-1 w-44 bg-(--card-bg) border border-(--line-divider) shadow-lg z-50 rounded-lg overflow-hidden">
          {#each aiSummaryConfig.models as model, idx}
            <button
              onclick={() => selectModel(idx)}
              class="block w-full text-left px-3 py-2 text-xs font-bold transition-colors {idx === modelIdx ? 'bg-(--primary) text-white' : 'text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5'}"
            >
              {model.name}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="min-h-[60px] text-sm text-black/75 dark:text-white/75 leading-relaxed">
    {#if loading && !thinking && !rawText}
      <div class="flex items-center gap-2 text-(--primary) font-bold animate-pulse">
        <span class="inline-block w-4 h-4 border-2 border-(--primary) border-t-transparent rounded-full animate-spin"></span>
        {i18n(I18nKey.aiSummaryReading)}
      </div>
    {/if}

    {#if error}
      <div class="text-red-500 font-bold flex items-center gap-2">
        ⚠️ {i18n(I18nKey.aiSummaryError)}
      </div>
    {/if}

    {#if thinking}
      <div class="mb-4 bg-black/5 dark:bg-white/5 border-l-4 border-(--primary) p-2 rounded-r-md">
        <button
          onclick={() => showThinking = !showThinking}
          class="flex items-center gap-1 text-[11px] font-mono text-(--primary) font-bold uppercase tracking-wider mb-1"
        >
          <span>🧠</span>
          {i18n(I18nKey.aiSummaryThinking)}
          <span class="text-xs">{showThinking ? "▼" : "▶"}</span>
        </button>
        {#if showThinking}
          <div class="text-xs font-mono text-black/40 dark:text-white/40 whitespace-pre-wrap mt-2 max-h-40 overflow-y-auto break-all">
            {thinking}
          </div>
        {/if}
      </div>
    {/if}

    {#if result.length > 0}
      <div class="space-y-3">
        {#each result as item, idx (idx)}
          <div class="mb-4 last:mb-0">
            <div class="flex items-start gap-2">
              <span class="shrink-0 w-1.5 h-1.5 rounded-full bg-(--primary)/30 mt-2"></span>
              <div class="flex-1 min-w-0 markdown-content">
                {item.p}
              </div>
            </div>
            {#if item.r && item.r.length > 0}
              <div class="flex flex-wrap gap-1.5 mt-1 ml-8 mb-2 opacity-60">
                <span class="text-[10px] uppercase font-bold text-black/40 dark:text-white/40">{i18n(I18nKey.aiSummaryReference)}:</span>
                {#each item.r as refIndex, rIdx}
                  {#if toc[refIndex - 1]}
                    <a
                      href={`#${toc[refIndex - 1].id}`}
                      class="text-[10px] text-(--primary) hover:bg-(--primary) hover:text-white transition-colors bg-(--primary)/10 dark:bg-(--primary)/20 px-1 py-0.5 rounded-sm font-mono border border-(--primary)/30"
                    >
                      {toc[refIndex - 1].text}
                    </a>
                  {:else}
                    <span class="text-[10px] text-(--primary) bg-(--primary)/10 dark:bg-(--primary)/20 px-1 py-0.5 rounded-sm font-mono border border-(--primary)/30">
                      [{refIndex}]
                    </span>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else if rawText}
      <div class="whitespace-pre-wrap markdown-content">{rawText}</div>
    {/if}

    {#if !loading && (result.length > 0 || rawText)}
      <div class="mt-5 pt-3 border-t border-dashed border-(--line-divider)">
        <div class="text-xs font-bold text-black/50 dark:text-white/50 mb-2 flex items-center gap-1.5">
          <span>💬</span>
          {i18n(I18nKey.aiSummaryMoreAsk)}
        </div>
        <div class="flex flex-wrap gap-2">
          {#each defaultQuestions as q}
            <button
              onclick={() => {}}
              class="text-xs px-2.5 py-1 bg-(--enter-btn-bg) hover:bg-(--primary)/10 text-black/60 dark:text-white/60 hover:text-(--primary) transition-colors rounded border border-(--line-divider) hover:border-(--primary) shrink-0"
            >
              {q}
            </button>
          {/each}
          {#each questions as q}
            <button
              onclick={() => {}}
              class="text-xs px-2.5 py-1 bg-(--primary)/5 border border-(--primary)/30 hover:border-(--primary) hover:bg-(--primary)/10 text-(--primary) font-medium transition-colors rounded shrink-0"
            >
              {q}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
{/if}