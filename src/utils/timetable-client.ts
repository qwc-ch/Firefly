import type {
	ResolvedTimetableDate,
	ScheduleDay,
	TimetableCalendarConfig,
	TimetableDateOverride,
} from "@/types/timetable";
import {
	assertTimetableCalendarConfig,
	getWeekStartDate,
	isCourseActiveForSchedule,
	resolveTimetableDate,
} from "@/utils/timetable-calendar";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function parseDateOverrides(
	value: string | undefined,
): TimetableDateOverride[] {
	if (!value) return [];
	const parsed: unknown = JSON.parse(value);
	if (!Array.isArray(parsed)) {
		throw new Error("课表日期覆盖规则格式错误");
	}
	return parsed as TimetableDateOverride[];
}

function readCalendarConfig(root: HTMLElement): TimetableCalendarConfig {
	return {
		firstWeekMonday: root.dataset.firstWeekMonday ?? "",
		teachingStartDate: root.dataset.teachingStartDate ?? "",
		totalWeeks: Number(root.dataset.totalWeeks),
		dateOverrides: parseDateOverrides(root.dataset.dateOverrides),
	};
}

function formatMonthDay(date: Date): string {
	return `${date.getMonth() + 1}/${date.getDate()}`;
}

function updateCurrentWeekLabel(
	root: HTMLElement,
	state: ResolvedTimetableDate,
): void {
	const text =
		state.status === "before-term"
			? "未开学"
			: state.status === "after-term"
				? "已结课"
				: String(state.calendarWeek);
	root.querySelectorAll("[data-current-week]").forEach((element) => {
		element.textContent = text;
	});
}

function updateClock(root: HTMLElement, now: Date): void {
	const weekday = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
	const pad = (value: number): string => String(value).padStart(2, "0");
	root.querySelectorAll("[data-clock-weekday]").forEach((element) => {
		element.textContent = `星期${weekday}`;
	});
	root.querySelectorAll("[data-clock-time]").forEach((element) => {
		element.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
	});
}

function updateCourseCards(
	root: HTMLElement,
	state: ResolvedTimetableDate,
	config: TimetableCalendarConfig,
): void {
	const displayWeek = Math.min(
		Math.max(state.calendarWeek, 1),
		config.totalWeeks,
	);
	const weekStart = getWeekStartDate(displayWeek, config.firstWeekMonday);

	root.querySelectorAll<HTMLElement>(".course-card").forEach((card) => {
		const weeks = (card.dataset.weeks ?? "")
			.split(",")
			.filter(Boolean)
			.map(Number);
		const courseDay = Number(card.dataset.courseDay) as ScheduleDay;
		const courseDate = new Date(weekStart);
		courseDate.setDate(courseDate.getDate() + courseDay - 1);
		const courseDateState = resolveTimetableDate(courseDate, config);
		card.classList.toggle(
			"not-this-week",
			!isCourseActiveForSchedule(weeks, courseDay, state, courseDateState),
		);
	});
}

function countTodayCourses(
	root: HTMLElement,
	state: ResolvedTimetableDate,
): number {
	const todayCard = [
		...root.querySelectorAll<HTMLElement>("[data-day-card]"),
	].find((element) => Number(element.dataset.dayCard) === state.day);
	if (!todayCard) return 0;
	return [...todayCard.querySelectorAll(".course-card")].filter(
		(card) => !card.classList.contains("not-this-week"),
	).length;
}

function updateTodaySummary(
	root: HTMLElement,
	state: ResolvedTimetableDate,
	todayCount: number,
): void {
	const courseText = todayCount > 0 ? `有 ${todayCount} 门课` : "今天没课 🎉";
	let text: string;

	if (state.status === "before-term") {
		text = "假期中，还没开学。";
	} else if (state.status === "after-term") {
		text = "本学期已结束。";
	} else if (state.status === "holiday") {
		text = `今天是${state.name ?? "假期"}，没有课。`;
	} else if (state.status === "makeup") {
		const name = state.name ? `${state.name}，` : "";
		const scheduleText =
			state.week === state.calendarWeek
				? `星期${WEEKDAYS[state.day - 1]}课表`
				: `第 ${state.week} 周星期${WEEKDAYS[state.day - 1]}课表`;
		text = `今天是第 ${state.calendarWeek} 周${name}按${scheduleText}上课，${courseText}。`;
	} else {
		text = `今天是第 ${state.calendarWeek} 周，${courseText}。`;
	}

	root.querySelectorAll("[data-today-summary]").forEach((element) => {
		element.textContent = text;
	});
}

function updateTodayHighlight(
	root: HTMLElement,
	state: ResolvedTimetableDate,
): void {
	root
		.querySelectorAll<HTMLElement>(
			"[data-day-col],[data-day-cell],[data-day-card]",
		)
		.forEach((element) => {
			const day = Number(
				element.dataset.dayCol ??
					element.dataset.dayCell ??
					element.dataset.dayCard,
			);
			element.classList.toggle(
				"is-today",
				state.isTeachingDay && day === state.day,
			);
		});
}

function updateWeekDates(
	root: HTMLElement,
	state: ResolvedTimetableDate,
	config: TimetableCalendarConfig,
): void {
	const displayWeek = Math.min(
		Math.max(state.calendarWeek, 1),
		config.totalWeeks,
	);
	const monday = getWeekStartDate(displayWeek, config.firstWeekMonday);
	root.querySelectorAll<HTMLElement>("[data-day-date]").forEach((element) => {
		const day = Number(element.dataset.dayDate);
		const date = new Date(monday);
		date.setDate(date.getDate() + day - 1);
		element.textContent = formatMonthDay(date);
	});
}

function renderTimetable(
	root: HTMLElement,
	config: TimetableCalendarConfig,
): void {
	const now = new Date();
	const state = resolveTimetableDate(now, config);

	updateCurrentWeekLabel(root, state);
	updateClock(root, now);
	updateCourseCards(root, state, config);
	const todayCount = countTodayCourses(root, state);
	updateTodaySummary(root, state, todayCount);
	updateTodayHighlight(root, state);
	updateWeekDates(root, state, config);
}

/** 初始化课表实时状态；Swup 换页后对新 DOM 再次调用即可。 */
export function initTimetable(): void {
	const root = document.getElementById("timetable-root");
	if (!(root instanceof HTMLElement)) return;
	if (root.dataset.timetableInitialized === "true") return;

	const config = readCalendarConfig(root);
	assertTimetableCalendarConfig(config);
	root.dataset.timetableInitialized = "true";

	renderTimetable(root, config);
	const timer = window.setInterval(() => {
		if (
			!root.isConnected ||
			document.getElementById("timetable-root") !== root
		) {
			window.clearInterval(timer);
			return;
		}
		renderTimetable(root, config);
	}, 1000);
}
