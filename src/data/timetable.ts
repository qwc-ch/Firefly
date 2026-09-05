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
	/** 大节名，如“一” */
	label: string;
	/** 小节范围，如“1-2 节” */
	sessions: string;
	/** 上午/下午/晚上 */
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
	term: "2025-2026 学年第 2 学期",
	/** 开学第一天（周一），用于计算当前第几周 */
	startDate: "2026-03-02",
	/** 学期总周数 */
	totalWeeks: 18,
};

// ============================================================================
// 作息时间（大节）
// ============================================================================
export const periods: Period[] = [
	{
		label: "一",
		sessions: "1-2 节",
		part: "上午",
		start: "08:20",
		end: "09:45",
	},
	{
		label: "二",
		sessions: "3-4 节",
		part: "上午",
		start: "10:00",
		end: "11:25",
	},
	{
		label: "三",
		sessions: "5-6 节",
		part: "下午",
		start: "13:40",
		end: "15:05",
	},
	{
		label: "四",
		sessions: "7-8 节",
		part: "下午",
		start: "15:20",
		end: "16:45",
	},
	{
		label: "五",
		sessions: "9-10 节",
		part: "晚上",
		start: "18:00",
		end: "19:25",
	},
	{
		label: "六",
		sessions: "11-12 节",
		part: "晚上",
		start: "19:40",
		end: "21:00",
	},
];

// ============================================================================
// 课程（示例数据，换成你自己的即可）
// ============================================================================
export const courses: Course[] = [
	{
		name: "高等数学",
		day: 1,
		slot: 0,
		weeks: [{ start: 1, end: 18 }],
		location: "教学楼 A101",
		teacher: "张三",
		className: "高等数学-0001",
	},
	{
		name: "大学英语",
		day: 1,
		slot: 2,
		weeks: [{ start: 1, end: 16 }],
		location: "外语楼 302",
		teacher: "李四",
	},
	{
		name: "数据结构",
		day: 2,
		slot: 1,
		weeks: [{ start: 1, end: 18 }],
		location: "计算机楼 505 机房",
		teacher: "王五",
		className: "数据结构-0003",
	},
	{
		name: "体育",
		day: 3,
		slot: 2,
		weeks: [{ start: 1, end: 12 }],
		location: "体育馆",
		teacher: "赵六",
	},
	{
		name: "形势与政策",
		day: 3,
		slot: 3,
		weeks: [
			// 单双周轮换示例：第 1-8 周的单周上课
			{ start: 1, end: 8, parity: "odd" },
		],
		location: "阶梯教室 201",
		teacher: "钱七",
	},
	{
		name: "大学物理",
		day: 4,
		slot: 0,
		weeks: [{ start: 1, end: 18 }],
		location: "理科楼 B203",
		teacher: "孙八",
	},
	{
		name: "数据结构实验",
		day: 4,
		slot: 3,
		weeks: [
			// 单双周轮换示例：第 2-12 周的双周上课
			{ start: 2, end: 12, parity: "even" },
		],
		location: "计算机楼 505 机房",
		teacher: "王五",
	},
	{
		name: "线性代数",
		day: 5,
		slot: 1,
		weeks: [{ start: 1, end: 18 }],
		location: "教学楼 A305",
		teacher: "周九",
	},
];
