import type {
	ResolvedTimetableDate,
	ScheduleDay,
	TimetableCalendarConfig,
	TimetableDateOverride,
	WeekRule,
} from "@/types/timetable";

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CalendarDateParts {
	year: number;
	month: number;
	day: number;
}

function parseIsoDate(value: string): CalendarDateParts {
	const match = ISO_DATE_PATTERN.exec(value);
	if (!match) {
		throw new Error(`无效日期：${value}（应为 YYYY-MM-DD）`);
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(0);
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCFullYear(year, month - 1, day);

	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		throw new Error(`无效日期：${value}`);
	}

	return { year, month, day };
}

function toEpochDay(value: string): number {
	const { year, month, day } = parseIsoDate(value);
	const date = new Date(0);
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCFullYear(year, month - 1, day);
	return Math.floor(date.getTime() / DAY_MS);
}

function formatDateKey(parts: CalendarDateParts): string {
	return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function normalizeDate(value: string | Date): {
	date: string;
	epochDay: number;
} {
	if (typeof value !== "string") {
		if (Number.isNaN(value.getTime())) {
			throw new Error("无效 Date 对象");
		}
		const date = formatDateKey({
			year: value.getFullYear(),
			month: value.getMonth() + 1,
			day: value.getDate(),
		});
		return { date, epochDay: toEpochDay(date) };
	}

	parseIsoDate(value);
	return { date: value, epochDay: toEpochDay(value) };
}

function getIsoWeekday(epochDay: number): ScheduleDay {
	const sundayBasedWeekday = new Date(epochDay * DAY_MS).getUTCDay();
	return (((sundayBasedWeekday + 6) % 7) + 1) as ScheduleDay;
}

/** 返回日期所在教学周；第一周周一为 1，周一切换到下一周。 */
export function getCalendarWeek(
	value: string | Date,
	firstWeekMonday: string,
): number {
	if (getIsoWeekday(toEpochDay(firstWeekMonday)) !== 1) {
		throw new Error(`第一周周一必须是星期一：${firstWeekMonday}`);
	}

	const { epochDay } = normalizeDate(value);
	return Math.floor((epochDay - toEpochDay(firstWeekMonday)) / 7) + 1;
}

/** 返回指定教学周周一对应的本地 Date。 */
export function getWeekStartDate(week: number, firstWeekMonday: string): Date {
	if (getIsoWeekday(toEpochDay(firstWeekMonday)) !== 1) {
		throw new Error(`第一周周一必须是星期一：${firstWeekMonday}`);
	}

	const { year, month, day } = parseIsoDate(firstWeekMonday);
	return new Date(year, month - 1, day + (week - 1) * 7);
}

/** 将周次规则展开为实际周次数组。 */
export function expandWeeks(
	rules: readonly WeekRule[],
	totalWeeks: number,
): number[] {
	const weeks = new Set<number>();
	for (const rule of rules) {
		const end = Math.min(rule.end, totalWeeks);
		for (let week = Math.max(rule.start, 1); week <= end; week++) {
			if (rule.parity === "odd" && week % 2 === 0) continue;
			if (rule.parity === "even" && week % 2 === 1) continue;
			weeks.add(week);
		}
	}
	return [...weeks].sort((a, b) => a - b);
}

/** 判断课程是否在当前日期对应的教学周上课。 */
export function isCourseActiveForDate(
	weeks: readonly number[],
	date: ResolvedTimetableDate,
): boolean {
	return date.isTeachingDay && date.week >= 1 && weeks.includes(date.week);
}

/**
 * 判断周课表中的一门课是否应在当前日期保持激活。
 *
 * 常规情况下按该课程所在星期的日期状态判断；因此某一天放假只会压制
 * 假期的星期，不会把同一周其他星期的课程一起变灰。调休日则优先采用
 * 调休规则指定的课表星期与教学周。
 */
export function isCourseActiveForSchedule(
	weeks: readonly number[],
	courseDay: ScheduleDay,
	currentDate: ResolvedTimetableDate,
	courseDate: ResolvedTimetableDate,
): boolean {
	if (
		currentDate.status === "before-term" ||
		currentDate.status === "after-term"
	) {
		return false;
	}

	if (currentDate.status === "makeup" && courseDay === currentDate.day) {
		return (
			currentDate.isTeachingDay &&
			currentDate.week >= 1 &&
			weeks.includes(currentDate.week)
		);
	}

	if (courseDate.status === "makeup") {
		return (
			courseDay === courseDate.day && isCourseActiveForDate(weeks, courseDate)
		);
	}

	return isCourseActiveForDate(weeks, courseDate);
}

function findHolidayOverride(
	date: string,
	dateOverrides: readonly TimetableDateOverride[],
): Extract<TimetableDateOverride, { type: "holiday" }> | undefined {
	const epochDay = toEpochDay(date);
	return dateOverrides.find(
		(
			override,
		): override is Extract<TimetableDateOverride, { type: "holiday" }> => {
			if (override.type !== "holiday") return false;
			return (
				epochDay >= toEpochDay(override.start) &&
				epochDay <= toEpochDay(override.end)
			);
		},
	);
}

function findMakeupOverride(
	date: string,
	dateOverrides: readonly TimetableDateOverride[],
): Extract<TimetableDateOverride, { type: "makeup" }> | undefined {
	return dateOverrides.find(
		(
			override,
		): override is Extract<TimetableDateOverride, { type: "makeup" }> =>
			override.type === "makeup" && override.date === date,
	);
}

/**
 * 解析某一天对应的教学周、课表星期及上课状态。
 *
 * 规则优先级：
 * 1. 精确日期的调休补课；
 * 2. 实际开学日之前 / 学期总周数之后；
 * 3. 假期区间；
 * 4. 正常教学日。
 */
export function resolveTimetableDate(
	value: string | Date,
	config: TimetableCalendarConfig,
): ResolvedTimetableDate {
	const { date, epochDay } = normalizeDate(value);
	const calendarWeek = getCalendarWeek(date, config.firstWeekMonday);
	const naturalDay = getIsoWeekday(epochDay);
	const makeup = findMakeupOverride(date, config.dateOverrides);

	if (makeup) {
		const week = makeup.scheduleWeek ?? calendarWeek;
		return {
			date,
			calendarWeek,
			week,
			day: makeup.scheduleDay,
			status: "makeup",
			isTeachingDay: week >= 1 && week <= config.totalWeeks,
			isMakeup: true,
			name: makeup.name,
		};
	}

	const startEpochDay = toEpochDay(config.teachingStartDate);
	const isBeforeTerm = epochDay < startEpochDay;
	const isAfterTerm = calendarWeek > config.totalWeeks;
	const holiday = findHolidayOverride(date, config.dateOverrides);

	if (isBeforeTerm) {
		return {
			date,
			calendarWeek,
			week: calendarWeek,
			day: naturalDay,
			status: "before-term",
			isTeachingDay: false,
			isMakeup: false,
		};
	}

	if (isAfterTerm) {
		return {
			date,
			calendarWeek,
			week: calendarWeek,
			day: naturalDay,
			status: "after-term",
			isTeachingDay: false,
			isMakeup: false,
		};
	}

	if (holiday) {
		return {
			date,
			calendarWeek,
			week: calendarWeek,
			day: naturalDay,
			status: "holiday",
			isTeachingDay: false,
			isMakeup: false,
			name: holiday.name,
		};
	}

	return {
		date,
		calendarWeek,
		week: calendarWeek,
		day: naturalDay,
		status: "teaching",
		isTeachingDay: true,
		isMakeup: false,
	};
}

/** 校验课表日期配置，避免锚点或覆盖规则写错后静默偏移。 */
export function assertTimetableCalendarConfig(
	config: TimetableCalendarConfig,
): void {
	if (!Number.isInteger(config.totalWeeks) || config.totalWeeks < 1) {
		throw new Error("学期总周数必须是正整数");
	}

	if (getIsoWeekday(toEpochDay(config.firstWeekMonday)) !== 1) {
		throw new Error(`第一周周一必须是星期一：${config.firstWeekMonday}`);
	}

	const anchorEpochDay = toEpochDay(config.firstWeekMonday);
	const startEpochDay = toEpochDay(config.teachingStartDate);
	if (startEpochDay < anchorEpochDay) {
		throw new Error("实际开学日不能早于第一周周一");
	}
	if (getCalendarWeek(config.teachingStartDate, config.firstWeekMonday) !== 1) {
		throw new Error("实际开学日必须位于第一周内");
	}

	const makeupDates = new Set<string>();
	for (const override of config.dateOverrides) {
		if (override.type === "holiday") {
			if (toEpochDay(override.start) > toEpochDay(override.end)) {
				throw new Error(`假期起始日期不能晚于结束日期：${override.start}`);
			}
			continue;
		}

		parseIsoDate(override.date);
		if (makeupDates.has(override.date)) {
			throw new Error(`调休日期重复：${override.date}`);
		}
		makeupDates.add(override.date);
		if (
			!Number.isInteger(override.scheduleDay) ||
			override.scheduleDay < 1 ||
			override.scheduleDay > 7
		) {
			throw new Error(`调休课表星期无效：${override.scheduleDay}`);
		}
		if (override.scheduleWeek !== undefined) {
			if (
				!Number.isInteger(override.scheduleWeek) ||
				override.scheduleWeek < 1 ||
				override.scheduleWeek > config.totalWeeks
			) {
				throw new Error(`调休教学周超出学期范围：${override.scheduleWeek}`);
			}
		}
	}
}
