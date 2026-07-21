export interface CircleArticle {
	floor: number;
	title: string;
	created: string;
	updated: string;
	link: string;
	author: string;
	avatar: string;
}

export interface CircleStatistics {
	friends_num: number;
	active_num: number;
	error_num: number;
	article_num: number;
	last_updated_time: string;
}

export interface CircleData {
	statistical_data: CircleStatistics;
	article_data: CircleArticle[];
}

export type CircleSortMode = "created" | "updated";

export interface CircleConfig {
	dataUrl: string;
	pageSize: number;
	showStats: boolean;
	showFloor: boolean;
	cacheTime: number;
	title?: string;
	description?: string;
	showComment?: boolean;
}
