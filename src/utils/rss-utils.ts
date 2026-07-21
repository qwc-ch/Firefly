interface RawArticle {
	title: string;
	link: string;
	created: string;
	updated: string;
	author: string;
	avatar: string;
	description: string;
}

function extractTag(xml: string, tag: string): string {
	const match = xml.match(
		new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
	);
	if (!match) return "";
	return decodeHtmlEntities(match[1].trim());
}

function extractAttr(xml: string, tag: string, attr: string): string {
	const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["']`, "i");
	const match = xml.match(regex);
	return match ? match[1] : "";
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/&#x2F;/g, "/")
		.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(code));
}

function stripHtml(text: string): string {
	return text.replace(/<[^>]*>/g, "").trim();
}

function parseDate(dateStr: string): string {
	if (!dateStr) return "";
	try {
		const date = new Date(dateStr);
		if (Number.isNaN(date.getTime())) return dateStr;
		return date.toISOString().split("T")[0];
	} catch {
		return dateStr;
	}
}

function parseRSS(xml: string, author: string, avatar: string): RawArticle[] {
	const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
	if (items.length > 0) {
		return items.map(([_, content]) => {
			const title = extractTag(content, "title") || "(无标题)";
			const rawLink = extractTag(content, "link");
			const pubDate = extractTag(content, "pubDate");
			const dcDate = extractTag(content, "dc:date");
			const description = extractTag(content, "description");
			return {
				title,
				link: rawLink,
				created: parseDate(pubDate || dcDate),
				updated: parseDate(pubDate || dcDate),
				author,
				avatar,
				description: stripHtml(description).slice(0, 200),
			};
		});
	}

	const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
	if (entries.length > 0) {
		return entries.map(([_, content]) => {
			const title = extractTag(content, "title") || "(无标题)";
			const linkHref = extractAttr(content, "link", "href");
			const linkTag = extractTag(content, "link");
			const published = extractTag(content, "published");
			const updated = extractTag(content, "updated");
			const summary = extractTag(content, "summary");
			return {
				title,
				link: linkHref || linkTag,
				created: parseDate(published),
				updated: parseDate(updated || published),
				author,
				avatar,
				description: stripHtml(summary).slice(0, 200),
			};
		});
	}

	return [];
}

export interface FetchedArticle {
	title: string;
	link: string;
	created: string;
	updated: string;
	author: string;
	avatar: string;
	description: string;
}

export interface RSSFriend {
	rss: string;
	author: string;
	avatar: string;
}

export async function fetchFriendRSS(
	friend: RSSFriend,
): Promise<FetchedArticle[]> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const response = await fetch(friend.rss, {
			signal: controller.signal,
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; FireflyRSS/1.0)",
			},
		});
		clearTimeout(timeout);
		if (!response.ok) return [];
		const xml = await response.text();
		return parseRSS(xml, friend.author, friend.avatar);
	} catch {
		return [];
	}
}

export async function fetchAllFriendsRSS(
	friends: RSSFriend[],
	maxPerFriend = 5,
): Promise<FetchedArticle[]> {
	const results = await Promise.allSettled(
		friends.map((friend) => fetchFriendRSS(friend)),
	);

	const all: FetchedArticle[] = [];
	for (const result of results) {
		if (result.status === "fulfilled") {
			all.push(...result.value.slice(0, maxPerFriend));
		}
	}

	all.sort((a, b) => {
		const dateA = a.created ? new Date(a.created).getTime() : 0;
		const dateB = b.created ? new Date(b.created).getTime() : 0;
		return dateB - dateA;
	});

	return all;
}
