---
title: 为 Firefly 添加 Umami 访问统计卡片
published: 2026-05-29
image: 'api'
updated: 2026-05-31
description: 在 Firefly 博客侧边栏集成 Umami 访问统计，实时展示浏览量、访问数和游客数
tags: [Firefly, Umami, Astro]
category: 'blog'
draft: false
lang: 'zh-CN'
sourceLink: "https://blog.tianhw.top/posts/fuwari-umami-stats/"
author: "THW's Blog"
---

> [!NOTE]
> 这篇文章是基于 [THW's Blog](https://blog.tianhw.top/posts/fuwari-umami-stats/) 的教程改造的，感谢大佬的分享。

## 为什么要加统计

搞个博客总想知道有没有人看吧。Umami 是个轻量级的统计工具，部署简单，也不会像 Google Analytics 那样隐私问题一堆。

但问题来了：Umami 自带的分享链接打开就是一个独立页面，跟博客风格完全不搭。所以我把它做成了一个侧边栏组件，嵌进博客里，打开就能看到访问数据，顺眼多了。

## 准备工作

前提是你已经部署好了 Umami，然后拿到一个分享链接。后面填进代码里就行。

## 添加组件

在 `src/components/widget/` 目录下新建一个 `UmamiStats.astro` 文件，把下面的代码贴进去：

```astro
---
import WidgetLayout from "../common/WidgetLayout.astro";

interface Props {
	class?: string;
	style?: string;
}
const { class: className, style } = Astro.props;
---

<WidgetLayout name="统计" class:list={["umami-stats-container", className, "cursor-pointer transition-opacity active:scale-95"]} {style}>
    <a target="_blank" rel="noopener noreferrer" class="block umami-link">
        <div class="text-center py-2">
            <div class="text-3xl font-bold text-neutral-900 dark:text-neutral-100 umami-total-pageviews">-</div>
            <div class="text-sm text-neutral-500 dark:text-neutral-400">总浏览量</div>
        </div>
        <div class="grid grid-cols-2 divide-x divide-neutral-200 dark:divide-neutral-700 text-center pt-2">
            <div class="px-2">
                <div class="text-xl font-bold text-neutral-900 dark:text-neutral-100 umami-total-visits">-</div>
                <div class="text-sm text-neutral-500 dark:text-neutral-400">访问数</div>
            </div>
            <div class="px-2">
                <div class="text-xl font-bold text-neutral-900 dark:text-neutral-100 umami-total-visitors">-</div>
                <div class="text-sm text-neutral-500 dark:text-neutral-400">游客数</div>
            </div>
        </div>
    </a>
</WidgetLayout>

<script>
const UMAMI_CONFIG = {
    shareUrl: '你的分享链接',
};

let __UMAMI_INTERNAL = {
    baseUrl: '',
    websiteId: '',
    shareToken: '',
    shareId: '',
    isReady: false
};

const FALLBACK_STATS = {
    pageviews: 1000,
    visits: 1000,
    visitors: 1000,
};

async function initUmamiConfig() {
    try {
        const sharePath = UMAMI_CONFIG.shareUrl.split('/share/')[1];
        if (!sharePath) throw new Error('Invalid Umami Share URL');

        let apiBase = '';
        if (UMAMI_CONFIG.shareUrl.includes('cloud.umami.is') || UMAMI_CONFIG.shareUrl.includes('analytics.umami.is')) {
            const region = UMAMI_CONFIG.shareUrl.includes('/analytics/eu/') ? 'eu' : 'us';
            apiBase = `https://cloud.umami.is/analytics/${region}/api`;
        } else {
            const urlObj = new URL(UMAMI_CONFIG.shareUrl);
            apiBase = `${urlObj.origin}/api`;
        }

        const res = await fetch(`${apiBase}/share/${sharePath}`);
        if (!res.ok) throw new Error(`Failed to fetch share config: ${res.status}`);
        const data = await res.json();

        __UMAMI_INTERNAL = {
            baseUrl: apiBase,
            websiteId: data.websiteId,
            shareToken: data.token,
            shareId: data.shareId,
            isReady: true
        };

        const links = document.querySelectorAll('.umami-link');
        links.forEach(link => link.setAttribute('href', UMAMI_CONFIG.shareUrl));

    } catch (e) {
        console.error('Umami Config Init Failed:', e);
    }
}

function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return Math.round(num).toString();
}

function setStats(values: { pageviews: number; visits: number; visitors: number }) {
    const pageviewsElements = document.querySelectorAll('.umami-total-pageviews');
    const visitsElements = document.querySelectorAll('.umami-total-visits');
    const visitorsElements = document.querySelectorAll('.umami-total-visitors');

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const animHandles = new Map<HTMLElement, number>();

    const animateStat = (el: HTMLElement | null, to: number, duration = 2000) => {
        if (!el) return;

        const prev = animHandles.get(el);
        if (prev) cancelAnimationFrame(prev);

        const from = 0;
        const startTime = performance.now();

        const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            const easedProgress = easeOutCubic(progress);

            const current = from + (to - from) * easedProgress;
            el.textContent = formatNumber(current);

            if (progress < 1) {
                animHandles.set(el, requestAnimationFrame(tick));
            }
        };
        animHandles.set(el, requestAnimationFrame(tick));
    };

    pageviewsElements.forEach(el => animateStat(el as HTMLElement, values.pageviews));
    visitsElements.forEach(el => animateStat(el as HTMLElement, values.visits));
    visitorsElements.forEach(el => animateStat(el as HTMLElement, values.visitors));
}

async function fetchUmamiStats() {
    if (!__UMAMI_INTERNAL.isReady) {
        await initUmamiConfig();
    }

    if (!__UMAMI_INTERNAL.isReady) {
        setStats(FALLBACK_STATS);
        return;
    }

    try {
        const endAt = Date.now();
        const startAt = 0;
        const url = `${__UMAMI_INTERNAL.baseUrl}/websites/${__UMAMI_INTERNAL.websiteId}/stats?startAt=${startAt}&endAt=${endAt}&unit=hour&timezone=Asia%2FShanghai`;

        const response = await fetch(url, {
            headers: {
                'x-umami-share-context': '1',
                'x-umami-share-token': __UMAMI_INTERNAL.shareToken
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const getValue = (field: any) => (typeof field === 'object' ? field?.value : field) || 0;

        setStats({
            pageviews: getValue(data.pageviews),
            visits: getValue(data.visits),
            visitors: getValue(data.visitors),
        });

    } catch (error) {
        console.error('Umami Fetch Failed:', error);
        setStats(FALLBACK_STATS);
    }
}

let __umamiStatsStarted = false;
function startUmamiStats() {
    if (__umamiStatsStarted) return;
    __umamiStatsStarted = true;
    fetchUmamiStats();
}

function initUmamiStatsVisibility() {
    const containers = document.querySelectorAll('.umami-stats-container');
    const io = new IntersectionObserver((entries) => {
        let isAnyVisible = false;
        entries.forEach(entry => {
            if (entry.isIntersecting) isAnyVisible = true;
        });

        if (isAnyVisible) {
            startUmamiStats();
            io.disconnect();
        }
    }, { threshold: 0.1 });

    containers.forEach(container => io.observe(container));
}

initUmamiStatsVisibility();

if (window.swup) {
    window.swup.hooks.on('page:view', () => {
        __umamiStatsStarted = false;
        initUmamiStatsVisibility();
    });
}
</script>
```

## 配置

代码里有个 `UMAMI_CONFIG`，把你的分享链接填进去就行：

```javascript
<script>
const UMAMI_CONFIG = {
    shareUrl: '你的分享链接',  // ← 这里改成你自己的
};
```

## 挂到侧边栏上

组件写好了，接下来得让它出现在页面上。打开 `src/components/layout/SideBar.astro`，把 `UmamiStats` import 进来，然后在合适的位置放上 `<UmamiStats />`。

下面是改完之后的完整代码，可以对照着改：

```astro
---
import type { MarkdownHeading } from "astro";
import Advertisement from "@/components/widget/Advertisement.astro";
import Announcement from "@/components/widget/Announcement.astro";
import Calendar from "@/components/widget/Calendar.astro";
import Categories from "@/components/widget/Categories.astro";
import Music from "@/components/widget/Music.astro";
import Profile from "@/components/widget/Profile.astro";
import SidebarTOC from "@/components/widget/SidebarTOC.astro";
import SiteStats from "@/components/widget/SiteStats.astro";
import Tags from "@/components/widget/Tags.astro";
import { sidebarLayoutConfig } from "@/config";
import type {
	MobileBottomComponentConfig,
	WidgetComponentConfig,
	WidgetComponentType,
} from "@/types/config";
import UmamiStats from "../widget/UmamiStats.astro";

interface Props {
	class?: string;
	headings?: MarkdownHeading[];
	side?: "left" | "right" | "bottom";
}

const SIDEBAR_SIDE = {
	LEFT: "left",
	RIGHT: "right",
	BOTTOM: "bottom",
} as const;

const COMPONENT_POSITION = {
	TOP: "top",
	STICKY: "sticky",
} as const;

const ANIMATION_DELAY_UNIT = 50;

const componentMap = {
	profile: Profile,
	announcement: Announcement,
	categories: Categories,
	tags: Tags,
	sidebarToc: SidebarTOC,
	advertisement: Advertisement,
	stats: SiteStats,
	calendar: Calendar,
	music: Music,
} satisfies Record<WidgetComponentType, typeof Profile>;

const side = (Astro.props.side ||
	SIDEBAR_SIDE.LEFT) as (typeof SIDEBAR_SIDE)[keyof typeof SIDEBAR_SIDE];
const className = Astro.props.class;

const getComponents = (): (
	| WidgetComponentConfig
	| MobileBottomComponentConfig
)[] => {
	if (side === SIDEBAR_SIDE.LEFT) {
		return sidebarLayoutConfig.leftComponents;
	}
	if (side === SIDEBAR_SIDE.RIGHT) {
		return sidebarLayoutConfig.rightComponents;
	}
	if (side === SIDEBAR_SIDE.BOTTOM) {
		return sidebarLayoutConfig.mobileBottomComponents;
	}
	return [];
};

const filterAndSortComponents = (
	components: (WidgetComponentConfig | MobileBottomComponentConfig)[],
) => {
	return components.filter((comp) => comp.enable);
};

const getComponentsByPosition = (
	components: (WidgetComponentConfig | MobileBottomComponentConfig)[],
) => {
	const topComponents = components.filter(
		(c) => "position" in c && c.position === COMPONENT_POSITION.TOP,
	) as WidgetComponentConfig[];
	const stickyComponents = components.filter(
		(c) => "position" in c && c.position === COMPONENT_POSITION.STICKY,
	) as WidgetComponentConfig[];
	return { topComponents, stickyComponents };
};

const getAnimationDelay = (index: number): string => {
	return `${index * ANIMATION_DELAY_UNIT}ms`;
};

const isPostPage = Astro.url.pathname.includes("/posts/");

const isComponentInitiallyVisible = (
	config: WidgetComponentConfig | MobileBottomComponentConfig,
): boolean => {
	if (
		"showOnPostPage" in config &&
		config.showOnPostPage === false &&
		isPostPage
	) {
		return false;
	}
	if (
		"showOnNonPostPage" in config &&
		config.showOnNonPostPage === false &&
		!isPostPage
	) {
		return false;
	}
	return true;
};

const getComponentProps = (
	config: WidgetComponentConfig | MobileBottomComponentConfig,
	index: number,
): Record<string, unknown> => {
	const baseProps: Record<string, unknown> = {
		class: "onload-animation",
		style: `animation-delay: ${getAnimationDelay(index)}`,
	};

	if ("showOnPostPage" in config && config.showOnPostPage === false) {
		baseProps.class = `${baseProps.class} widget-hide-on-post`;
		if (isPostPage) {
			baseProps.class = `${baseProps.class} hidden`;
		}
	}
	if ("showOnNonPostPage" in config && config.showOnNonPostPage === false) {
		baseProps.class = `${baseProps.class} widget-hide-on-non-post`;
		if (!isPostPage) {
			baseProps.class = `${baseProps.class} hidden`;
		}
	}

	if (config.type === "sidebarToc") {
		return { ...baseProps, headings: Astro.props.headings || [] };
	}

	if (
		config.type === "advertisement" &&
		"configId" in config &&
		config.configId
	) {
		return { ...baseProps, configId: config.configId };
	}

	return baseProps;
};

const allComponents = getComponents();
const filteredComponents = filterAndSortComponents(allComponents);

const isMobileBottom = side === SIDEBAR_SIDE.BOTTOM;
const { topComponents, stickyComponents } = !isMobileBottom
	? getComponentsByPosition(filteredComponents)
	: { topComponents: [], stickyComponents: [] };
const bottomComponents = isMobileBottom ? filteredComponents : [];
const hasInitiallyVisibleTopComponents = topComponents.some(
	isComponentInitiallyVisible,
);

let mobileProfileComp: MobileBottomComponentConfig | undefined;
let mobileOtherComponents: MobileBottomComponentConfig[] = [];

if (isMobileBottom) {
	mobileProfileComp = bottomComponents.find((comp) => comp.type === "profile");
	mobileOtherComponents = bottomComponents.filter(
		(comp) => comp.type !== "profile",
	);
}

const hasStickyContent =
	stickyComponents.length > 0 || side === SIDEBAR_SIDE.LEFT;
---

{
	(topComponents.length > 0 || stickyComponents.length > 0 || bottomComponents.length > 0 || hasStickyContent) && (
		<div id={`${side}-sidebar`} class:list={[className, "flex flex-col w-full pt-0"]}>
			{isMobileBottom ? (
				<div class="flex flex-col w-full gap-4">
					{mobileProfileComp && (() => {
						const Component = componentMap[mobileProfileComp.type];
						if (!Component) return null;
						const props = getComponentProps(mobileProfileComp, 0) as any;
						return <Component {...props} />;
					})()}

					<UmamiStats class="onload-animation" style="animation-delay: 50ms" />

					{mobileOtherComponents.map((comp, index) => {
						const Component = componentMap[comp.type];
						if (!Component) return null;
						const props = getComponentProps(comp, index + 2) as any;
						return <Component {...props} />;
					})}
				</div>
			) : (
				<>
					{topComponents.length > 0 && (
						<div
							class:list={[
								"flex flex-col w-full gap-4",
								hasInitiallyVisibleTopComponents && "mb-4",
							]}
						>
							{topComponents.map((comp, index) => {
								const Component = componentMap[comp.type];
								if (!Component) return null;
								const props = getComponentProps(comp, index) as any;
								return <Component {...props} />;
							})}
						</div>
					)}

					{hasStickyContent && !isMobileBottom && (
						<div
							id={`${side}-sidebar-sticky`}
							class:list={[
								"flex flex-col w-full mt-0 gap-4",
								"sticky",
								hasInitiallyVisibleTopComponents ? "top-4" : "top-0",
							]}
						>
							{side === SIDEBAR_SIDE.LEFT && (
								<UmamiStats class="onload-animation" style="animation-delay: 200ms" />
							)}

							{stickyComponents.map((comp, index) => {
								const Component = componentMap[comp.type];
								if (!Component) return null;
								const props = getComponentProps(
									comp,
									topComponents.length + index
								) as any;
								return <Component {...props} />;
							})}
						</div>
					)}
				</>
			)}
		</div>
	)
}
```

## 结尾

搞定了。现在每次打开博客，侧边栏就会自动加载 Umami 的访问数据，还有个数字滚动的动画效果，看着还挺舒服的。如果数据拉不到（比如 API 挂了），会自动显示 fallback 的数字，不至于空空的。
