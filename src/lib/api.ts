const API_BASE = "https://api.520781.xyz";
const TOKEN_KEY = "firefly_admin_token";

function getToken(): string {
	if (typeof window === "undefined") return "";
	return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth() {
	localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
	return !!getToken();
}

export async function login(username: string, password: string): Promise<void> {
	const auth = btoa(`${username}:${password}`);
	const res = await fetch(`${API_BASE}/api/auth/login`, {
		method: "POST",
		headers: { Authorization: `Basic ${auth}` },
	});

	if (res.status === 429) {
		throw new Error("登录尝试过于频繁，请 15 分钟后重试");
	}
	if (!res.ok) {
		throw new Error("用户名或密码错误");
	}

	const data = (await res.json()) as { token: string; expires_in: number };
	setToken(data.token);
}

async function request(
	path: string,
	options: RequestInit = {},
): Promise<unknown> {
	const token = getToken();
	const headers: Record<string, string> = {
		...(options.headers as Record<string, string>),
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	if (!(options.body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}

	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers,
	});

	if (res.status === 429) {
		throw new Error("请求过于频繁，请稍后重试");
	}

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
	url: string;
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
	list: () => request("/api/images") as Promise<ImageItem[]>,
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
