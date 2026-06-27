const API_BASE = "https://api.520781.xyz";

function getAuth(): string {
	if (typeof window === "undefined") return "";
	const saved = localStorage.getItem("firefly_admin_auth");
	if (saved) return saved;
	return "";
}

export function setAuth(username: string, password: string) {
	const auth = btoa(`${username}:${password}`);
	localStorage.setItem("firefly_admin_auth", auth);
}

export function clearAuth() {
	localStorage.removeItem("firefly_admin_auth");
}

export function isAuthenticated(): boolean {
	return !!getAuth();
}

async function request(
	path: string,
	options: RequestInit = {},
): Promise<unknown> {
	const auth = getAuth();
	const headers: Record<string, string> = {
		...(options.headers as Record<string, string>),
	};

	if (auth) {
		headers.Authorization = `Basic ${auth}`;
	}

	if (!(options.body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}

	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers,
	});

	if (res.status === 401) {
		clearAuth();
		throw new Error("认证失败，请重新登录");
	}

	if (!res.ok) {
		const err = await res.text();
		throw new Error(err || `请求失败: ${res.status}`);
	}

	return res.json();
}

export interface PostMeta {
	slug: string;
	title: string;
	published: string;
	updated?: string;
	draft: boolean;
	description: string;
	image: string;
	tags: string[];
	category: string;
	lang: string;
	pinned: boolean;
	author: string;
	comment: boolean;
	licenseName?: string;
	licenseUrl?: string;
	sourceLink?: string;
	password?: string;
	passwordHint?: string;
}

export interface PostContent extends PostMeta {
	content: string;
}

export interface ImageItem {
	key: string;
	size: number;
	etag: string;
	lastModified: string;
}

function enc(slug: string) {
	return encodeURIComponent(slug);
}

export const postsApi = {
	list: () => request("/api/posts") as Promise<PostMeta[]>,
	get: (slug: string) =>
		request(`/api/posts/${enc(slug)}`) as Promise<PostContent>,
	create: (data: {
		slug: string;
		frontmatter: Record<string, unknown>;
		content: string;
	}) => request("/api/posts", { method: "POST", body: JSON.stringify(data) }),
	update: (
		slug: string,
		data: { frontmatter: Record<string, unknown>; content: string },
	) =>
		request(`/api/posts/${enc(slug)}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),
	delete: (slug: string) =>
		request(`/api/posts/${enc(slug)}`, { method: "DELETE" }),
};

export const imagesApi = {
	list: (prefix?: string) =>
		request(`/api/images${prefix ? `?prefix=${prefix}` : ""}`) as Promise<
			ImageItem[]
		>,
	upload: async (file: File) => {
		const form = new FormData();
		form.append("file", file);
		return request("/api/images/upload", { method: "POST", body: form });
	},
	delete: (key: string) =>
		request(`/api/images/${encodeURIComponent(key)}`, { method: "DELETE" }),
};

export const siteConfigApi = {
	get: () =>
		request("/api/config/site") as Promise<{
			config: Record<string, unknown>;
			sha: string;
		}>,
	save: (config: Record<string, unknown>, sha: string, message?: string) =>
		request("/api/config/site", {
			method: "PUT",
			body: JSON.stringify({ config, sha, message }),
		}),
};

export function getImageUrl(key: string): string {
	return `${API_BASE}/img/${key}`;
}
