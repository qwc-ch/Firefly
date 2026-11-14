export type WeekParity = "odd" | "even" | "all";

export interface WeekRule {
	start: number;
	end: number;
	/** "odd" 单周 / "even" 双周 / "all" 全部（默认） */
	parity?: WeekParity;
}

/** ISO 星期：1=周一 … 7=周日 */
export type ScheduleDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 假期（闭区间），区间内不上课 */
export interface HolidayDateOverride {
	type: "holiday";
	start: string;
	end: string;
	/** 例如“国庆节”“寒假” */
	name?: string;
}

/** 调休补课：指定日期按哪一天的课表、哪一个教学周上课 */
export interface MakeupDateOverride {
	type: "makeup";
	date: string;
	/** 该日期实际采用的课表星期 */
	scheduleDay: ScheduleDay;
	/** 该日期实际采用的教学周；省略时使用日期所在的自然教学周 */
	scheduleWeek?: number;
	/** 例如“国庆调休” */
	name?: string;
}

export type TimetableDateOverride = HolidayDateOverride | MakeupDateOverride;

export interface TimetableCalendarConfig {
	/** 学校规定的第一周周一，周次计算的唯一锚点 */
	firstWeekMonday: string;
	/** 实际开学日，允许是周二等非周一日期 */
	teachingStartDate: string;
	/** 学期总周数 */
	totalWeeks: number;
	/** 日期覆盖规则；调休规则优先于假期规则 */
	dateOverrides: readonly TimetableDateOverride[];
}

export type TimetableDateStatus =
	| "before-term"
	| "teaching"
	| "holiday"
	| "makeup"
	| "after-term";

export interface ResolvedTimetableDate {
	/** 本地日期，格式 YYYY-MM-DD */
	date: string;
	/** 日期按第一周周一推算出的自然教学周 */
	calendarWeek: number;
	/** 实际用于匹配课程周次的教学周（调休时可能与自然教学周不同） */
	week: number;
	/** 实际用于匹配课程的星期（调休时可能与自然星期不同） */
	day: ScheduleDay;
	status: TimetableDateStatus;
	/** 是否处于可上课状态 */
	isTeachingDay: boolean;
	isMakeup: boolean;
	/** 假期或调休名称 */
	name?: string;
}

export interface SemesterConfig {
	title: string;
	term: string;
	/** 实际开学日 */
	startDate: string;
	/** 学校规定的第一周周一 */
	firstWeekMonday: string;
	totalWeeks: number;
	dateOverrides: TimetableDateOverride[];
}
