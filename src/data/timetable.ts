/**
 * 课程表数据 —— 直接改这个文件即可更新课表
 *
 * weeks 支持任意组合：
 *   { start: 1, end: 18 }                → 1-18 周全部
 *   { start: 1, end: 15, parity: "odd" } → 1-15 周中的单周
 *   { start: 2, end: 16, parity: "even" }→ 双周
 *   也可以多个规则叠加，如 [{start:1,end:6},{start:9,end:12,parity:"odd"}]
 * day: 1-7 表示周一到周日
 * slot: 大节下标，对应下面 periods 数组的下标（从 0 开始）
 */

export type WeekParity = "odd" | "even" | "all";

export interface WeekRule {
	start: number;
	end: number;
	/** "odd" 单周 / "even" 双周 / "all" 全部（默认） */
	parity?: WeekParity;
}

export interface Course {
	/** 课程名 */
	name: string;
	/** 星期几上课（1=周一 … 7=周日） */
	day: number;
	/** 第几大节，对应 periods 下标（从 0 开始） */
	slot: number;
	/** 上课周次规则（可多条） */
	weeks: WeekRule[];
	/** 上课地点 */
	location: string;
	/** 教师 */
	teacher: string;
	/** 教学班（可选） */
	className?: string;
}

export interface Period {
	/** 大节名，如"上午1" */
	label: string;
	/** 小节范围，如"第1节" */
	sessions: string;
	/** 早读/上午/中午/下午/晚上 */
	part: string;
	start: string;
	end: string;
}

// ============================================================================
// 学期信息
// ============================================================================
export const semester = {
	/** 课表标题 */
	title: "我的课表",
	/** 学期徽章文字 */
	term: "2026-2027 学年第 1 学期",
	/** 开学第一天（周二），用于计算当前第几周 */
	startDate: "2026-09-01",
	/** 学期总周数 */
	totalWeeks: 21,
};

// ============================================================================
// 作息时间（大节）
// ============================================================================
export const periods: Period[] = [
	{
		label: "早读1",
		sessions: "第1节",
		part: "早读",
		start: "07:00",
		end: "07:25",
	},
	{
		label: "早读2",
		sessions: "第2节",
		part: "早读",
		start: "07:25",
		end: "07:50",
	},
	{
		label: "上午1",
		sessions: "第3节",
		part: "上午",
		start: "08:00",
		end: "08:40",
	},
	{
		label: "上午2",
		sessions: "第4节",
		part: "上午",
		start: "08:55",
		end: "09:35",
	},
	{
		label: "上午3",
		sessions: "第5节",
		part: "上午",
		start: "10:05",
		end: "10:45",
	},
	{
		label: "上午4",
		sessions: "第6节",
		part: "上午",
		start: "11:00",
		end: "11:41",
	},
	{
		label: "中午1",
		sessions: "第7节",
		part: "中午",
		start: "12:00",
		end: "12:30",
	},
	{
		label: "中午2",
		sessions: "第8节",
		part: "中午",
		start: "13:00",
		end: "13:30",
	},
	{
		label: "下午1",
		sessions: "第9节",
		part: "下午",
		start: "13:40",
		end: "14:20",
	},
	{
		label: "下午2",
		sessions: "第10节",
		part: "下午",
		start: "14:35",
		end: "15:15",
	},
	{
		label: "下午3",
		sessions: "第11节",
		part: "下午",
		start: "15:45",
		end: "16:25",
	},
	{
		label: "下午4",
		sessions: "第12节",
		part: "下午",
		start: "16:40",
		end: "17:20",
	},
	{
		label: "晚自习",
		sessions: "第13节",
		part: "晚上",
		start: "17:45",
		end: "20:30",
	},
];

// ============================================================================
// 课程
// ============================================================================
export const courses: Course[] = [
	// ==================== 周一（day: 1）====================
	{
		name: "英语",
		day: 1,
		slot: 0,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 1,
		slot: 1,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 1,
		slot: 2,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "化学",
		day: 1,
		slot: 3,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 1,
		slot: 4,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "道法",
		day: 1,
		slot: 5,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 1,
		slot: 6,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 1,
		slot: 7,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 1,
		slot: 8,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 1,
		slot: 9,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 1,
		slot: 10,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "体育",
		day: 1,
		slot: 11,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 1,
		slot: 12,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},

	// ==================== 周二（day: 2）====================
	{
		name: "英语",
		day: 2,
		slot: 0,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 2,
		slot: 1,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 2,
		slot: 2,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 2,
		slot: 3,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 2,
		slot: 4,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "历史",
		day: 2,
		slot: 5,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "化学",
		day: 2,
		slot: 6,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 2,
		slot: 7,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "体育",
		day: 2,
		slot: 8,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "道法",
		day: 2,
		slot: 9,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 2,
		slot: 10,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 2,
		slot: 11,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 2,
		slot: 12,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},

	// ==================== 周三（day: 3）====================
	{
		name: "英语",
		day: 3,
		slot: 0,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 3,
		slot: 1,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 3,
		slot: 2,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 3,
		slot: 3,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 3,
		slot: 4,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "化学",
		day: 3,
		slot: 5,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 3,
		slot: 6,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 3,
		slot: 7,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "历史",
		day: 3,
		slot: 8,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 3,
		slot: 9,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 3,
		slot: 10,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 3,
		slot: 11,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 3,
		slot: 12,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},

	// ==================== 周四（day: 4）====================
	{
		name: "语文",
		day: 4,
		slot: 0,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 4,
		slot: 1,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "历史",
		day: 4,
		slot: 2,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 4,
		slot: 3,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 4,
		slot: 4,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 4,
		slot: 5,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 4,
		slot: 6,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 4,
		slot: 7,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "体育",
		day: 4,
		slot: 8,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 4,
		slot: 9,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "化学",
		day: 4,
		slot: 10,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 4,
		slot: 11,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "历史",
		day: 4,
		slot: 12,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},

	// ==================== 周五（day: 5）====================
	{
		name: "语文",
		day: 5,
		slot: 0,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 5,
		slot: 1,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "语文",
		day: 5,
		slot: 2,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "化学",
		day: 5,
		slot: 3,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 5,
		slot: 4,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "英语",
		day: 5,
		slot: 5,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "化学",
		day: 5,
		slot: 6,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 5,
		slot: 7,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	// 下午1：单周化学，双周体育
	{
		name: "化学",
		day: 5,
		slot: 8,
		weeks: [{ start: 1, end: 18, parity: "odd" }],
		location: "",
		teacher: "",
	},
	{
		name: "体育",
		day: 5,
		slot: 8,
		weeks: [{ start: 1, end: 18, parity: "even" }],
		location: "",
		teacher: "",
	},
	{
		name: "道法",
		day: 5,
		slot: 9,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 5,
		slot: 10,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "物理",
		day: 5,
		slot: 11,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
	{
		name: "数学",
		day: 5,
		slot: 12,
		weeks: [{ start: 1, end: 18 }],
		location: "",
		teacher: "",
	},
];
