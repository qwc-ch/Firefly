import { friendsConfig } from "@/config";
import type { FriendLink } from "@/types/friendsConfig";
import { fetchAllFriendsRSS } from "@/utils/rss-utils";

export async function GET() {
	const friendsWithRSS = friendsConfig
		.filter((f: FriendLink) => f.enabled && f.rss)
		.map((f: FriendLink) => ({
			rss: f.rss as string,
			author: f.title,
			avatar: f.imgurl,
		}));

	const articles = await fetchAllFriendsRSS(friendsWithRSS, 5);

	const data = {
		statistical_data: {
			friends_num: friendsWithRSS.length,
			active_num: friendsWithRSS.length,
			error_num: 0,
			article_num: articles.length,
			last_updated_time: new Date().toISOString(),
		},
		article_data: articles.map((a, i) => ({
			floor: i + 1,
			title: a.title,
			created: a.created,
			updated: a.updated,
			link: a.link,
			author: a.author,
			avatar: a.avatar,
		})),
	};

	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
