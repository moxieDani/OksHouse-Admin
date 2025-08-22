/**
 * 달력 관련 유틸리티 함수들
 * 달력 생성, 날짜 계산 등의 기능을 제공합니다.
 */

/**
 * 예약 기간에 해당하는 달력 생성 (이전달/다음달 날짜 포함)
 * @param {Object} reservation - 예약 객체
 * @returns {Array} 달력 데이터 배열
 */
export function generateReservationCalendar(reservation) {
	const start = new Date(reservation.startDate);
	const end = new Date(reservation.endDate);
	const calendar = [];
	
	// 예약 시작일의 월을 기준으로 달력 생성
	const currentYear = start.getFullYear();
	const currentMonth = start.getMonth();
	
	// 현재 월의 첫째 날과 마지막 날
	const firstDay = new Date(currentYear, currentMonth, 1);
	const lastDay = new Date(currentYear, currentMonth + 1, 0);
	
	// 달력 첫 주의 시작 날짜 (이전 달 포함)
	const startDayOfWeek = firstDay.getDay();
	const calendarStart = new Date(firstDay);
	calendarStart.setDate(firstDay.getDate() - startDayOfWeek);
	
	// 달력 마지막 주의 끝 날짜 (다음 달 포함)
	const endDayOfWeek = lastDay.getDay();
	const calendarEnd = new Date(lastDay);
	calendarEnd.setDate(lastDay.getDate() + (6 - endDayOfWeek));
	
	// 달력 전체 기간 생성 (42일 = 6주)
	const totalDays = 42;
	for (let i = 0; i < totalDays; i++) {
		const currentDate = new Date(calendarStart);
		currentDate.setDate(calendarStart.getDate() + i);
		
		const isCurrentMonth = currentDate.getMonth() === currentMonth && currentDate.getFullYear() === currentYear;
		const isReserved = currentDate >= start && currentDate <= end;
		const isToday = currentDate.toDateString() === new Date().toDateString();
		
		// 이전달/다음달 구분 (년도 경계도 고려)
		const isPrevMonth = (currentDate.getFullYear() < currentYear) || 
			(currentDate.getFullYear() === currentYear && currentDate.getMonth() < currentMonth);
		const isNextMonth = (currentDate.getFullYear() > currentYear) || 
			(currentDate.getFullYear() === currentYear && currentDate.getMonth() > currentMonth);
		
		// 예약 범위 내에서의 위치 결정
		let reservationPosition = null;
		if (isReserved) {
			const isStart = currentDate.getTime() === start.getTime();
			const isEnd = currentDate.getTime() === end.getTime();
			const isSingle = start.getTime() === end.getTime();
			
			if (isSingle) {
				reservationPosition = 'single';
			} else if (isStart) {
				reservationPosition = 'start';
			} else if (isEnd) {
				reservationPosition = 'end';
			} else {
				reservationPosition = 'middle';
			}
		}
		
		calendar.push({
			date: currentDate.getDate(),
			fullDate: new Date(currentDate),
			isCurrentMonth: isCurrentMonth,
			isReserved: isReserved,
			isToday: isToday,
			reservationPosition: reservationPosition,
			isPrevMonth: isPrevMonth,
			isNextMonth: isNextMonth
		});
	}
	
	return calendar;
}

/**
 * 달력 높이 자동 조정을 위한 헬퍼 함수
 * @param {number} delay - 지연 시간 (밀리초)
 * @returns {Promise} Promise 객체
 */
export function scheduleHeightAdjustment(delay = 100) {
	return new Promise(resolve => {
		setTimeout(resolve, delay);
	});
}

/**
 * 현재 날짜가 오늘인지 확인
 * @param {Date} date - 확인할 날짜
 * @returns {boolean} 오늘 여부
 */
export function isToday(date) {
	return date.toDateString() === new Date().toDateString();
}

/**
 * 두 날짜가 같은 날짜인지 확인
 * @param {Date} date1 - 첫 번째 날짜
 * @param {Date} date2 - 두 번째 날짜
 * @returns {boolean} 같은 날짜 여부
 */
export function isSameDate(date1, date2) {
	return date1.getTime() === date2.getTime();
}