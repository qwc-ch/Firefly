import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TimetableCalendarConfig } from "../src/types/timetable";
import {
	assertTimetableCalendarConfig,
	expandWeeks,
	getCalendarWeek,
	isCourseActiveForDate,
	isCourseActiveForSchedule,
	resolveTimetableDate,
} from "../src/utils/timetable-calendar";

const baseConfig: TimetableCalendarConfig = {
	firstWeekMonday: "2026-08-31",
	teachingStartDate: "2026-09-01",
	totalWeeks: 21,
	dateOverrides: [],
};

describe("教学周计算", () => {
	it("以第一周周一为锚点，并在周一切换到下一周", () => {
		assert.equal(getCalendarWeek("2026-08-31", baseConfig.firstWeekMonday), 1);
		assert.equal(getCalendarWeek("2026-09-01", baseConfig.firstWeekMonday), 1);
		assert.equal(getCalendarWeek("2026-09-06", baseConfig.firstWeekMonday), 1);
		assert.equal(getCalendarWeek("2026-09-07", baseConfig.firstWeekMonday), 2);
	});

	it("跨月时连续计算，不在月初重置", () => {
		assert.equal(getCalendarWeek("2026-09-28", baseConfig.firstWeekMonday), 5);
		assert.equal(getCalendarWeek("2026-09-30", baseConfig.firstWeekMonday), 5);
		assert.equal(getCalendarWeek("2026-10-01", baseConfig.firstWeekMonday), 5);
		assert.equal(getCalendarWeek("2026-10-05", baseConfig.firstWeekMonday), 6);
	});

	it("周日仍属于上一周，周一进入下一周", () => {
		assert.equal(getCalendarWeek("2026-10-04", baseConfig.firstWeekMonday), 5);
		assert.equal(getCalendarWeek("2026-10-05", baseConfig.firstWeekMonday), 6);
		assert.equal(
			getCalendarWeek(
				new Date(2026, 9, 4, 23, 59, 59),
				baseConfig.firstWeekMonday,
			),
			5,
		);
		assert.equal(
			getCalendarWeek(
				new Date(2026, 9, 5, 0, 0, 0),
				baseConfig.firstWeekMonday,
			),
			6,
		);
	});
});

describe("学期与假期边界", () => {
	it("第一周周一的实际开学前仍显示为未开学", () => {
		const monday = resolveTimetableDate("2026-08-31", baseConfig);
		const tuesday = resolveTimetableDate("2026-09-01", baseConfig);

		assert.equal(monday.calendarWeek, 1);
		assert.equal(monday.status, "before-term");
		assert.equal(monday.isTeachingDay, false);
		assert.equal(tuesday.week, 1);
		assert.equal(tuesday.status, "teaching");
		assert.equal(tuesday.isTeachingDay, true);
	});

	it("最后一周结束后进入已结课状态", () => {
		const lastWeek = resolveTimetableDate("2027-01-24", baseConfig);
		const afterTerm = resolveTimetableDate("2027-01-25", baseConfig);

		assert.equal(lastWeek.week, 21);
		assert.equal(lastWeek.status, "teaching");
		assert.equal(afterTerm.week, 22);
		assert.equal(afterTerm.status, "after-term");
		assert.equal(afterTerm.isTeachingDay, false);
	});

	it("假期区间内即使周次和单双周匹配也不显示课程", () => {
		const config: TimetableCalendarConfig = {
			...baseConfig,
			dateOverrides: [
				{
					type: "holiday",
					start: "2026-10-01",
					end: "2026-10-07",
					name: "国庆节",
				},
			],
		};
		const holiday = resolveTimetableDate("2026-10-05", config);
		const oddWeek = expandWeeks(
			[{ start: 1, end: 18, parity: "odd" }],
			config.totalWeeks,
		);
		const evenWeek = expandWeeks(
			[{ start: 1, end: 18, parity: "even" }],
			config.totalWeeks,
		);

		assert.equal(holiday.week, 6);
		assert.equal(holiday.status, "holiday");
		assert.equal(holiday.name, "国庆节");
		assert.equal(isCourseActiveForDate(oddWeek, holiday), false);
		assert.equal(isCourseActiveForDate(evenWeek, holiday), false);
	});

	it("假期只压制对应日期的课程，不影响同周其他日期", () => {
		const config: TimetableCalendarConfig = {
			...baseConfig,
			dateOverrides: [
				{
					type: "holiday",
					start: "2026-10-01",
					end: "2026-10-07",
					name: "国庆节",
				},
			],
		};
		const currentHoliday = resolveTimetableDate("2026-10-01", config);
		const mondayDate = resolveTimetableDate("2026-09-28", config);
		const thursdayDate = resolveTimetableDate("2026-10-01", config);
		const fridayDate = resolveTimetableDate("2026-10-02", config);
		const allWeeks = expandWeeks([{ start: 1, end: 18 }], config.totalWeeks);

		assert.equal(
			isCourseActiveForSchedule(allWeeks, 1, currentHoliday, mondayDate),
			true,
		);
		assert.equal(
			isCourseActiveForSchedule(allWeeks, 4, currentHoliday, thursdayDate),
			false,
		);
		assert.equal(
			isCourseActiveForSchedule(allWeeks, 5, currentHoliday, fridayDate),
			false,
		);
		assert.equal(resolveTimetableDate("2026-10-08", config).status, "teaching");
	});
});

describe("调休日期覆盖", () => {
	it("调休规则优先于假期规则，并使用指定的星期和教学周", () => {
		const config: TimetableCalendarConfig = {
			...baseConfig,
			dateOverrides: [
				{
					type: "holiday",
					start: "2026-10-01",
					end: "2026-10-07",
					name: "国庆节",
				},
				{
					type: "makeup",
					date: "2026-10-04",
					scheduleDay: 1,
					scheduleWeek: 5,
					name: "国庆调休",
				},
			],
		};
		const makeup = resolveTimetableDate("2026-10-04", config);
		const oddWeek = expandWeeks(
			[{ start: 1, end: 18, parity: "odd" }],
			config.totalWeeks,
		);
		const evenWeek = expandWeeks(
			[{ start: 1, end: 18, parity: "even" }],
			config.totalWeeks,
		);

		assert.equal(makeup.calendarWeek, 5);
		assert.equal(makeup.week, 5);
		assert.equal(makeup.day, 1);
		assert.equal(makeup.status, "makeup");
		assert.equal(makeup.isTeachingDay, true);
		assert.equal(isCourseActiveForDate(oddWeek, makeup), true);
		assert.equal(isCourseActiveForDate(evenWeek, makeup), false);
	});

	it("指定教学周只覆盖课程匹配，不改变自然教学周", () => {
		const config: TimetableCalendarConfig = {
			...baseConfig,
			dateOverrides: [
				{
					type: "makeup",
					date: "2026-10-10",
					scheduleDay: 5,
					scheduleWeek: 5,
				},
			],
		};
		const makeup = resolveTimetableDate("2026-10-10", config);

		assert.equal(makeup.calendarWeek, 6);
		assert.equal(makeup.week, 5);
		assert.equal(makeup.day, 5);
		assert.equal(makeup.status, "makeup");
	});

	it("未指定教学周时使用调休日期所在的自然教学周", () => {
		const config: TimetableCalendarConfig = {
			...baseConfig,
			dateOverrides: [
				{
					type: "makeup",
					date: "2026-10-10",
					scheduleDay: 5,
				},
			],
		};
		const makeup = resolveTimetableDate("2026-10-10", config);

		assert.equal(makeup.calendarWeek, 6);
		assert.equal(makeup.week, 6);
		assert.equal(makeup.day, 5);
		assert.equal(makeup.status, "makeup");
	});
});

describe("配置校验", () => {
	it("拒绝不是周一的第一周锚点", () => {
		assert.throws(
			() =>
				assertTimetableCalendarConfig({
					...baseConfig,
					firstWeekMonday: "2026-09-01",
				}),
			/第一周周一必须是星期一/,
		);
	});

	it("拒绝落在第二周的实际开学日", () => {
		assert.throws(
			() =>
				assertTimetableCalendarConfig({
					...baseConfig,
					teachingStartDate: "2026-09-07",
				}),
			/实际开学日必须位于第一周内/,
		);
	});
});
