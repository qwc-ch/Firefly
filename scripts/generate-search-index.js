import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

const POSTS_DIR = "./src/content/posts";

function extractFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;

	const fm = match[1];
	const getVal = (key) => {
		const line = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
		if (!line) return "";
		return line[1].trim();
	};

	const title = getVal("title").replace(/^["']|["']$/g, "");
	const description = getVal("description").replace(/^["']|["']$/g, "");
	const category = getVal("category").replace(/^["']|["']$/g, "");

	const tagsRaw = getVal("tags");
	const tags = tagsRaw
		.replace(/^\[|\]$/g, "")
		.split(",")
		.map((t) => t.trim().replace(/^["']|["']$/g, ""))
		.filter(Boolean);

	return { title, description, tags, category };
}

async function main() {
	const files = await glob("**/*.{md,mdx}", { cwd: POSTS_DIR });
	const posts = [];

	for (const file of files) {
		const filePath = path.join(POSTS_DIR, file);
		const content = fs.readFileSync(filePath, "utf-8");
		const fm = extractFrontmatter(content);
		if (!fm?.title) continue;

		const slug = file.replace(/\.(md|mdx)$/, "");
		posts.push({
			title: fm.title,
			description: fm.description,
			category: fm.category,
			tags: fm.tags,
			url: `/posts/${slug}/`,
		});
	}

	fs.mkdirSync("public", { recursive: true });
	fs.writeFileSync("public/posts-index.json", JSON.stringify(posts, null, 2));
	console.log(`Generated search index with ${posts.length} posts`);
}

main().catch(console.error);
