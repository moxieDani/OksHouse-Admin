/**
 * 날짜 관련 유틸리티 함수들
 * 프로젝트 전체에서 사용되는 날짜 포맷팅 및 계산 함수
 */

/**
 * 날짜를 한국어 형식으로 포맷팅
 * @param {Date | string | null} date - 포맷팅할 날짜
 * @returns {string} 포맷팅된 날짜 문자열 (MM월 DD일(요일))
 */
export function formatKoreanDate(date) {
	if (!date) return '';
	
	// Date 객체 보장 및 유효성 검증
	const dateObj = date instanceof Date ? date : new Date(date);
	if (isNaN(dateObj.getTime())) {
		console.error('Invalid date passed to formatKoreanDate:', date);
		return '';
	}
	
	const month = dateObj.getMonth() + 1;
	const day = dateObj.getDate();
	const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
	const weekday = weekdays[dateObj.getDay()];
	return `${month}월 ${day}일(${weekday})`;
}

/**
 * API용 날짜 형식으로 포맷팅 (YYYY-MM-DD)
 * @param {Date | null} date - 포맷팅할 날짜
 * @returns {string | null} API용 날짜 문자열
 */
export function formatDateForAPI(date) {
	if (!date) return null;
	
	const dateObj = date instanceof Date ? date : new Date(date);
	
	if (isNaN(dateObj.getTime())) {
		throw new Error('Invalid date provided to formatDateForAPI');
	}
	
	// 로컬 날짜 사용하여 시간대 변환 문제 방지
	const year = dateObj.getFullYear();
	const month = String(dateObj.getMonth() + 1).padStart(2, '0');
	const day = String(dateObj.getDate()).padStart(2, '0');
	
	return `${year}-${month}-${day}`;
}

/**
 * 날짜 범위 계산
 * @param {Date | null} startDate - 시작일
 * @param {number} duration - 숙박 기간 (일)
 * @returns {{startDate: Date, endDate: Date, duration: number} | null} 계산된 날짜 범위
 */
export function calculateDateRange(startDate, duration) {
	if (!startDate || !duration) return null;
	const endDate = new Date(startDate);
	endDate.setDate(startDate.getDate() + duration);
	return { startDate, endDate, duration };
}

/**
 * 시작일과 종료일 사이의 일수 계산
 * @param {Date} startDate - 시작일
 * @param {Date} endDate - 종료일
 * @returns {number} 일수
 */
export function calculateDurationInDays(startDate, endDate) {
	if (!startDate || !endDate) return 0;
	const timeDiff = endDate.getTime() - startDate.getTime();
	return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
}