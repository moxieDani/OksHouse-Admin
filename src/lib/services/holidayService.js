/**
 * 대한민국 공휴일 서비스
 * Google Calendar API의 '대한민국의 휴일' 캘린더에서 공휴일을 조회합니다.
 */

import { formatDateForAPI } from '../../shared/utils/dateUtils.js';

const HOLIDAY_CALENDAR_ID = 'ko.south_korea#holiday@group.v.calendar.google.com';
const API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;

// '대한민국의 휴일' 캘린더에는 기념일(어버이날, 스승의날 등)도 섞여 있어 description으로 공휴일만 구분
const PUBLIC_HOLIDAY_DESCRIPTIONS = ['공휴일', 'Public holiday'];

// 연도별 조회 결과 캐시 (Promise를 저장해 동시 중복 요청 방지)
const holidayCache = new Map();

/**
 * 특정 연도의 공휴일 조회
 * @param {number} year - 조회할 연도
 * @returns {Promise<Object<string, string>>} { 'YYYY-MM-DD': '공휴일 이름' } 형태의 객체 (실패 시 빈 객체)
 */
export function fetchHolidays(year) {
	if (!holidayCache.has(year)) {
		const request = requestHolidays(year).catch(error => {
			console.warn(`${year}년 공휴일 정보를 불러오지 못했습니다:`, error);
			// 다음 조회 때 다시 시도할 수 있도록 실패한 요청은 캐시에서 제거
			if (holidayCache.get(year) === request) {
				holidayCache.delete(year);
			}
			return {};
		});
		holidayCache.set(year, request);
	}
	return holidayCache.get(year);
}

/**
 * 공휴일 객체 조회용 날짜 키 생성
 * @param {Date} date - 날짜
 * @returns {string} 'YYYY-MM-DD' 형식 문자열
 */
export function toHolidayKey(date) {
	return /** @type {string} */ (formatDateForAPI(date));
}

/**
 * 공휴일 캐시 초기화 (새로고침 시 최신 공휴일을 다시 받아오기 위해 사용)
 */
export function clearHolidayCache() {
	holidayCache.clear();
}

/**
 * Google Calendar API로 특정 연도의 공휴일 요청
 * @param {number} year - 조회할 연도
 * @returns {Promise<Object<string, string>>} 날짜별 공휴일 이름
 */
async function requestHolidays(year) {
	if (!API_KEY) {
		console.warn('VITE_GOOGLE_CALENDAR_API_KEY가 설정되지 않아 공휴일을 표시하지 않습니다.');
		return {};
	}

	const params = new URLSearchParams({
		key: API_KEY,
		timeMin: `${year}-01-01T00:00:00+09:00`,
		timeMax: `${year + 1}-01-01T00:00:00+09:00`,
		timeZone: 'Asia/Seoul',
		singleEvents: 'true',
		maxResults: '250'
	});
	const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(HOLIDAY_CALENDAR_ID)}/events?${params}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${await response.text()}`);
	}

	const data = await response.json();
	return toHolidayMap(data.items || []);
}

/**
 * 캘린더 이벤트 목록을 날짜별 공휴일 이름 객체로 변환
 * @param {Array<any>} events - Google Calendar API 이벤트 목록
 * @returns {Object<string, string>} 날짜별 공휴일 이름
 */
function toHolidayMap(events) {
	/** @type {Object<string, string>} */
	const holidays = {};

	for (const event of events) {
		const description = event.description || '';
		const isPublicHoliday = PUBLIC_HOLIDAY_DESCRIPTIONS.some(label => description.startsWith(label));
		if (!isPublicHoliday || !event.start?.date) continue;

		// 종일 일정의 end.date는 마지막 날의 다음 날(미포함)
		const current = parseLocalDate(event.start.date);
		const end = parseLocalDate(event.end?.date || event.start.date);
		do {
			const key = toHolidayKey(current);
			holidays[key] = holidays[key] ? `${holidays[key]}, ${event.summary}` : event.summary;
			current.setDate(current.getDate() + 1);
		} while (current < end);
	}

	return holidays;
}

/**
 * 'YYYY-MM-DD' 문자열을 로컬 자정 기준 Date로 변환
 * @param {string} dateString - 날짜 문자열
 * @returns {Date} 로컬 Date 객체
 */
function parseLocalDate(dateString) {
	const [year, month, day] = dateString.split('-').map(Number);
	return new Date(year, month - 1, day);
}
