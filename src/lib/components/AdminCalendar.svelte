<script>
	import { createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { fetchHolidays, clearHolidayCache, toHolidayKey } from '$lib/services/holidayService.js';

	const dispatch = createEventDispatcher();
	
	// Props
	export let currentMonth = new Date().getMonth();
	export let currentYear = new Date().getFullYear();
	export let existingReservations = [];
	export let isRefreshing = false;
	/** @type {(() => void) | null} */
	export let onRefresh = null;
	
	// Constants
	const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
	const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
	
	let today = new Date().setHours(0, 0, 0, 0);
	/** @type {Object<string, string>} { 'YYYY-MM-DD': '공휴일 이름' } */
	let holidays = {};
	let holidayRequestId = 0;

	// Reactive calendar days generation - existingReservations, holidays 변경시에도 업데이트
	$: calendarDays = generateCalendarDays(currentYear, currentMonth, existingReservations, holidays);
	$: if (browser) loadHolidays(currentYear, currentMonth);

	/**
	 * 현재 달력에 보이는 기간의 공휴일 로드
	 * @param {number} year - 년도
	 * @param {number} month - 월 (0-11)
	 */
	async function loadHolidays(year, month) {
		const requestId = ++holidayRequestId;

		// 달력에 함께 보이는 이전/다음 달 날짜가 다른 연도일 수 있으므로 인접 연도도 조회
		const years = [year];
		if (month === 0) years.push(year - 1);
		if (month === 11) years.push(year + 1);

		const results = await Promise.all(years.map(fetchHolidays));

		// 달을 빠르게 넘긴 경우 이전 요청의 응답이 최신 결과를 덮어쓰지 않도록 무시
		if (requestId === holidayRequestId) {
			holidays = Object.assign({}, ...results);
		}
	}

	/**
	 * 새로고침 - 예약 정보와 함께 공휴일도 다시 조회
	 */
	function handleRefresh() {
		clearHolidayCache();
		loadHolidays(currentYear, currentMonth);
		onRefresh?.();
	}

	/**
	 * 달력 날짜 생성
	 * @param {number} year - 년도
	 * @param {number} month - 월 (0-11)
	 * @param {Array} reservations - 예약 데이터 (리액티브 의존성을 위해)
	 * @param {Object<string, string>} holidayMap - 날짜별 공휴일 이름
	 * @returns {Array} 달력 날짜 배열
	 */
	function generateCalendarDays(year, month, reservations = [], holidayMap = {}) {
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const firstDayOfWeek = firstDay.getDay();
		const daysInMonth = lastDay.getDate();
		
		const days = [];
		
		// Previous month's trailing days
		const prevMonth = new Date(year, month, 0);
		const prevMonthLastDay = prevMonth.getDate();
		const daysFromPrevMonth = firstDayOfWeek;
		for (let i = daysFromPrevMonth; i > 0; i--) {
			const day = prevMonthLastDay - i + 1;
			const dayDate = new Date(year, month - 1, day);
			days.push({
				day,
				date: dayDate,
				isCurrentMonth: false,
				isOtherMonth: true,
				holidayName: holidayMap[toHolidayKey(dayDate)] || null,
				...getReservationInfo(dayDate)
			});
		}
		
		// Current month days
		for (let day = 1; day <= daysInMonth; day++) {
			const dayDate = new Date(year, month, day);
			days.push({
				day,
				date: dayDate,
				isCurrentMonth: true,
				isOtherMonth: false,
				holidayName: holidayMap[toHolidayKey(dayDate)] || null,
				...getReservationInfo(dayDate)
			});
		}
		
		// Next month's leading days
		const totalCells = 42; // 6 weeks × 7 days
		const remainingCells = totalCells - days.length;
		for (let day = 1; day <= remainingCells; day++) {
			const dayDate = new Date(year, month + 1, day);
			days.push({
				day,
				date: dayDate,
				isCurrentMonth: false,
				isOtherMonth: true,
				holidayName: holidayMap[toHolidayKey(dayDate)] || null,
				...getReservationInfo(dayDate)
			});
		}
		
		return days;
	}

	/**
	 * 특정 날짜의 예약 정보 및 범위 위치 반환
	 * @param {Date} date - 확인할 날짜
	 * @returns {Object} 예약 정보 객체
	 */
	function getReservationInfo(date) {
		if (!existingReservations || existingReservations.length === 0) {
			return { hasReservation: false, reservationStatus: null, reservationPosition: null };
		}
		
		// 날짜 비교를 위해 시간을 00:00:00으로 설정
		const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const targetTime = targetDate.getTime();
		
		for (const reservation of existingReservations) {
			const startDate = new Date(reservation.startDate.getFullYear(), reservation.startDate.getMonth(), reservation.startDate.getDate());
			const endDate = new Date(reservation.endDate.getFullYear(), reservation.endDate.getMonth(), reservation.endDate.getDate());
			
			const startTime = startDate.getTime();
			const endTime = endDate.getTime();
			
			if (targetTime >= startTime && targetTime <= endTime) {
				// 예약 범위 내에서의 위치 결정
				let position = null;
				const isStart = targetTime === startTime;
				const isEnd = targetTime === endTime;
				const isSingle = startTime === endTime;
				
				if (isSingle) {
					position = 'single';
				} else if (isStart) {
					position = 'start';
				} else if (isEnd) {
					position = 'end';
				} else {
					position = 'middle';
				}
				
				// 과거 예약인지 확인 (체크아웃 날짜가 오늘보다 이전인 경우)
				const isPastReservation = reservation.isPastReservation || endTime < today;
				const finalStatus = isPastReservation ? 'expired' : reservation.status;
				
				return {
					hasReservation: true,
					reservationStatus: finalStatus,
					reservationPosition: position,
					isPastReservation
				};
			}
		}
		
		return { hasReservation: false, reservationStatus: null, reservationPosition: null };
	}
	
	/**
	 * 날짜 클릭 처리 - 관리자 모드에서는 예약이 있는 날짜만 클릭 가능
	 * @param {Object} dayInfo - 클릭된 날짜 정보
	 */
	function handleDateClick(dayInfo) {
		// 다른 달의 날짜를 클릭한 경우
		if (!dayInfo.isCurrentMonth) {
			// 예약이 있는 다른 달 날짜인 경우 달 변경 후 상세 모달 표시
			if (dayInfo.hasReservation || hasReservations(dayInfo.date)) {
				currentMonth = dayInfo.date.getMonth();
				currentYear = dayInfo.date.getFullYear();
				dispatch('monthChange', { month: currentMonth, year: currentYear });
				
				// 달 변경 후 예약 상세 모달 표시
				const reservationsOnDate = getReservationsOnDate(dayInfo.date);
				dispatch('reservationDateClick', { 
					date: dayInfo.date, 
					reservations: reservationsOnDate 
				});
			} else {
				// 예약이 없는 다른 달 날짜인 경우 달만 변경
				currentMonth = dayInfo.date.getMonth();
				currentYear = dayInfo.date.getFullYear();
				dispatch('monthChange', { month: currentMonth, year: currentYear });
			}
			return;
		}

		// 현재 달의 예약이 있는 날짜만 클릭 가능 (과거 날짜 포함)
		if (dayInfo.hasReservation || hasReservations(dayInfo.date)) {
			const reservationsOnDate = getReservationsOnDate(dayInfo.date);
			dispatch('reservationDateClick', { 
				date: dayInfo.date, 
				reservations: reservationsOnDate 
			});
		}
	}
	
	/**
	 * 달 변경
	 * @param {number} direction - 방향 (-1: 이전달, 1: 다음달)
	 */
	function changeMonth(direction) {
		if (direction > 0) {
			if (currentMonth === 11) {
				currentMonth = 0;
				currentYear += 1;
			} else {
				currentMonth += 1;
			}
		} else {
			if (currentMonth === 0) {
				currentMonth = 11;
				currentYear -= 1;
			} else {
				currentMonth -= 1;
			}
		}
		dispatch('monthChange', { month: currentMonth, year: currentYear });
	}
	
	/**
	 * 오늘인지 확인
	 * @param {Date} date - 확인할 날짜
	 * @returns {boolean} 오늘 여부
	 */
	function isToday(date) {
		return new Date(date).setHours(0, 0, 0, 0) === today;
	}
	
	/**
	 * 특정 날짜에 예약이 있는지 확인
	 * @param {Date} date - 확인할 날짜
	 * @returns {boolean} 예약 존재 여부
	 */
	function hasReservations(date) {
		if (!existingReservations || existingReservations.length === 0) return false;
		
		// 날짜 비교를 위해 시간을 00:00:00으로 설정
		const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const targetTime = targetDate.getTime();
		
		return existingReservations.some(reservation => {
			const startDate = new Date(reservation.startDate.getFullYear(), reservation.startDate.getMonth(), reservation.startDate.getDate());
			const endDate = new Date(reservation.endDate.getFullYear(), reservation.endDate.getMonth(), reservation.endDate.getDate());
			
			return targetTime >= startDate.getTime() && targetTime <= endDate.getTime();
		});
	}
	
	/**
	 * 특정 날짜의 예약 목록 반환
	 * @param {Date} date - 확인할 날짜
	 * @returns {Array} 해당 날짜의 예약 목록
	 */
	function getReservationsOnDate(date) {
		if (!existingReservations || existingReservations.length === 0) return [];
		
		const dateTime = date.getTime();
		
		return existingReservations.filter(reservation => {
			const startDate = reservation.startDate instanceof Date 
				? reservation.startDate 
				: new Date(reservation.start_date + 'T00:00:00');
			const endDate = reservation.endDate instanceof Date
				? reservation.endDate
				: new Date(reservation.end_date + 'T00:00:00');
			
			return dateTime >= startDate.getTime() && dateTime <= endDate.getTime();
		});
	}
	
	/**
	 * 과거 날짜인지 확인
	 * @param {Date} date - 확인할 날짜
	 * @returns {boolean} 과거 날짜 여부
	 */
	function isDisabled(date) {
		return date < today;
	}

	/**
	 * 날짜 CSS 클래스 생성
	 * @param {Object} dayInfo - 날짜 정보
	 * @returns {string} CSS 클래스 문자열
	 */
	function getDayClass(dayInfo) {
		const classes = ['calendar-day'];
		const { date, isCurrentMonth, isOtherMonth, hasReservation, reservationStatus, reservationPosition, holidayName } = dayInfo;
		const dayOfWeek = date.getDay();
		
		if (isOtherMonth) classes.push('other-month');
		if (isToday(date)) classes.push('today');
		if (isDisabled(date)) classes.push('disabled');
		
		// 예약 상태별 스타일 추가
		if (hasReservation && reservationStatus) {
			classes.push('has-reservation');
			classes.push(`reserved-${reservationStatus}`);
			if (reservationPosition) {
				classes.push(`position-${reservationPosition}`);
			}
		} else if (hasReservations(date)) {
			// 기존 hasReservations 함수와의 호환성
			classes.push('has-reservation');
		}
		
		if (dayOfWeek === 0) classes.push('sunday');
		if (dayOfWeek === 6) classes.push('saturday');
		if (holidayName) classes.push('holiday');

		return classes.join(' ');
	}
</script>

<div class="admin-calendar">
	<div class="calendar-header">
		<button 
			class="calendar-nav" 
			on:click={() => changeMonth(-1)}
			aria-label="이전 달"
		>
			‹
		</button>
		<div class="header-center">
			<span class="month-display">
				{currentYear}년 {monthNames[currentMonth]}
			</span>
			{#if onRefresh}
				<button 
					class="refresh-button"
					on:click={handleRefresh}
					disabled={isRefreshing}
					title="예약 정보 새로고침"
				>
					<span class="refresh-icon {isRefreshing ? 'spinning' : ''}">🔄</span>
				</button>
			{/if}
		</div>
		<button 
			class="calendar-nav" 
			on:click={() => changeMonth(1)}
			aria-label="다음 달"
		>
			›
		</button>
	</div>
	
	<div class="calendar-weekdays">
		{#each weekdays as day}
			<div class="calendar-weekday">{day}</div>
		{/each}
	</div>
	
	<div class="calendar-grid">
		{#each calendarDays as dayInfo}
			<button 
				class="{getDayClass(dayInfo)}"
				disabled={isDisabled(dayInfo.date) && dayInfo.isCurrentMonth && !dayInfo.hasReservation && !hasReservations(dayInfo.date)}
				on:click={() => handleDateClick(dayInfo)}
				aria-label="{currentYear}년 {currentMonth + 1}월 {dayInfo.day}일{dayInfo.holidayName ? ` ${dayInfo.holidayName}` : ''}"
				title={dayInfo.holidayName}
			>
				{dayInfo.day}
			</button>
		{/each}
	</div>
</div>

<style>

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4);
		background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
		color: white;
	}

	.calendar-nav {
		background: none;
		border: none;
		color: white;
		font-size: var(--text-xl);
		cursor: pointer;
		padding: var(--space-2);
		border-radius: var(--radius-md);
		transition: var(--transition-colors);
		font-family: inherit;
	}

	.calendar-nav:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.header-center {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.month-display {
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.refresh-button {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-md);
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: all 0.2s ease;
		backdrop-filter: blur(4px);
	}

	.refresh-button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		transform: translateY(-1px);
	}

	.refresh-button:disabled {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.1);
		cursor: not-allowed;
		transform: none;
		opacity: 0.7;
	}

	.refresh-icon {
		font-size: var(--text-base);
		transition: transform 0.3s ease;
	}

	.refresh-icon.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.calendar-weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		background: var(--neutral-100);
	}

	.calendar-weekday {
		padding: var(--space-3) var(--space-2);
		text-align: center;
		font-weight: 600;
		color: var(--neutral-600);
		font-size: clamp(0.75rem, 2vw, 1.125rem);
		min-height: clamp(32px, 5vw, 50px);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
	}

	.calendar-day {
		aspect-ratio: 1;
		background: white;
		color: var(--neutral-700);
		font-size: clamp(0.875rem, 2.5vw, 1.375rem);
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition-colors);
		font-family: inherit;
		border: 1px solid var(--neutral-200);
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: clamp(42px, 6vw, 60px);
		position: relative;
		border-radius: var(--radius-sm);
	}

	.calendar-day.other-month {
		color: var(--neutral-400);
		background: var(--neutral-50);
		cursor: pointer;
	}

	.calendar-day.other-month:hover {
		background: var(--neutral-200);
		color: var(--neutral-600);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.calendar-day.today:not(.has-reservation):not(.reserved-confirmed):not(.reserved-pending):not(.reserved-cancelled):not(.reserved-expired) {
		background: #6366f1;
		color: white !important;
		font-weight: 700;
		position: relative;
	}

	.calendar-day.disabled {
		color: var(--neutral-400);
		cursor: not-allowed;
		background: var(--neutral-100);
		opacity: 0.6;
	}

	/* 예약이 없는 과거 날짜 hover 효과 */
	.calendar-day.disabled:not(.has-reservation):not(.reserved-confirmed):not(.reserved-pending):not(.reserved-cancelled):not(.reserved-expired):hover {
		background: var(--neutral-100);
		color: var(--neutral-400);
		transform: none;
		box-shadow: none;
	}

	/* 예약이 있는 과거 날짜는 클릭 가능하므로 다른 스타일 적용 */
	.calendar-day.disabled.has-reservation,
	.calendar-day.disabled.reserved-confirmed,
	.calendar-day.disabled.reserved-pending,
	.calendar-day.disabled.reserved-cancelled,
	.calendar-day.disabled.reserved-expired {
		cursor: pointer;
		opacity: 1;
	}

	.calendar-day.sunday {
		color: var(--error);
	}

	.calendar-day.saturday {
		color: #6366f1;
	}

	/* 공휴일은 토요일이어도 일요일과 같은 색으로 표시 */
	.calendar-day.holiday {
		color: var(--error);
	}

	/* Today + disabled 상태 */
	.calendar-day.today.disabled {
		background: #6366f1 !important;
		color: white !important;
		opacity: 0.7;
		cursor: not-allowed;
	}

	.calendar-day.today.disabled:hover {
		background: #6366f1 !important;
		color: white !important;
		transform: none;
		box-shadow: none;
	}

	/* 기본 예약 스타일 (호환성을 위해 유지) */
	.calendar-day.has-reservation {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%);
		border-color: #6366f1;
		color: #4f46e5;
		font-weight: 600;
		cursor: pointer;
	}

	/* 상태별 예약 스타일 */
	.calendar-day.reserved-confirmed {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: white;
		font-weight: 600;
		box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
		border: 3px solid #047857 !important; /* 테두리 두께 증가 + 우선순위 */
		border-color: #047857 !important; /* has-reservation 덮어쓰기 */
	}

	.calendar-day.reserved-pending {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: white;
		font-weight: 600;
		box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
		border: 3px solid #b45309 !important; /* 테두리 두께 증가 + 우선순위 */
		border-color: #b45309 !important; /* has-reservation 덮어쓰기 */
	}

	.calendar-day.reserved-cancelled {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		color: white;
		font-weight: 600;
		box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
		border: 3px solid #b91c1c !important; /* 테두리 두께 증가 + 우선순위 */
		border-color: #b91c1c !important; /* has-reservation 덮어쓰기 */
	}

	.calendar-day.reserved-expired {
		background: linear-gradient(135deg, #bbbbbb 0%, #d0d0d0 100%) !important;
		color: white !important;
		font-weight: 600;
		box-shadow: 0 2px 4px rgba(107, 114, 128, 0.3);
		border: 3px solid #8c8c8c !important; /* 테두리 두께 증가 + 우선순위 */
		border-color: #8c8c8c !important; /* has-reservation 덮어쓰기 */
	}

	/* 예약 범위 연속 사각형 스타일 */
	.calendar-day.position-start {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
		position: relative;
		border-right: none !important; /* 중간 세로 테두리 제거 */
	}

	.calendar-day.position-middle {
		border-radius: 0;
		position: relative;
		border-left: none !important; /* 중간 세로 테두리 제거 */
		border-right: none !important; /* 중간 세로 테두리 제거 */
	}

	/* position-middle에서 상하 테두리 색상을 예약 상태에 맞게 설정 */
	.calendar-day.has-reservation.position-middle.reserved-confirmed {
		border-top: 3px solid #047857 !important;
		border-bottom: 3px solid #047857 !important;
		border-color: #047857 !important; /* 모든 테두리 색상 통일 */
	}

	.calendar-day.has-reservation.position-middle.reserved-pending {
		border-top: 3px solid #b45309 !important;
		border-bottom: 3px solid #b45309 !important;
		border-color: #b45309 !important; /* 모든 테두리 색상 통일 */
	}

	.calendar-day.has-reservation.position-middle.reserved-cancelled {
		border-top: 3px solid #b91c1c !important;
		border-bottom: 3px solid #b91c1c !important;
		border-color: #b91c1c !important; /* 모든 테두리 색상 통일 */
	}

	.calendar-day.has-reservation.position-middle.reserved-expired {
		border-top: 3px solid #8c8c8c !important;
		border-bottom: 3px solid #8c8c8c !important;
		border-color: #8c8c8c !important; /* 모든 테두리 색상 통일 */
	}

	.calendar-day.position-end {
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
		position: relative;
		border-left: none !important; /* 중간 세로 테두리 제거 */
	}

	.calendar-day.position-single {
		/* 단일 날짜는 기본 border-radius 유지 */
		border-radius: var(--radius-sm);
	}


	.calendar-day:hover {
		background: var(--neutral-50);
		border-color: var(--neutral-300);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.calendar-day.has-reservation:hover {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%);
		color: #4338ca;
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(99, 102, 241, 0.2);
	}

	/* 예약된 날짜 hover 효과 - 과거 날짜는 배경색 변경 안 함 */
	.calendar-day.reserved-confirmed:hover:not(.disabled),
	.calendar-day.reserved-pending:hover:not(.disabled),
	.calendar-day.reserved-cancelled:hover:not(.disabled),
	.calendar-day.reserved-expired:hover:not(.disabled) {
		transform: translateY(-1px);
		filter: brightness(1.1);
		box-shadow: 0 4px 8px rgba(0,0,0,0.2);
	}

	/* 과거 날짜(disabled)인 예약된 날짜 hover 효과 - 배경색 유지 */
	.calendar-day.reserved-confirmed.disabled:hover,
	.calendar-day.reserved-pending.disabled:hover,
	.calendar-day.reserved-cancelled.disabled:hover,
	.calendar-day.reserved-expired.disabled:hover {
		transform: none;
		filter: none;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		cursor: pointer; /* 클릭 가능하므로 포인터 커서 유지 */
	}

	/* 오늘 + 예약이 있는 날짜 */
	.calendar-day.today.has-reservation {
		background: #6366f1 !important;
		border-color: #6366f1;
		color: #ffffff;
	}

	.calendar-day.today.has-reservation:hover {
		background: #6366f1 !important;
		color: #ffffff;
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(99, 102, 241, 0.2);
	}

	/* 오늘 + 예약 상태별 스타일 */
	.calendar-day.today.reserved-confirmed,
	.calendar-day.today.reserved-pending,
	.calendar-day.today.reserved-cancelled,
	.calendar-day.today.reserved-expired {
		/* 예약 상태별 배경과 테두리는 기본 reserved-* 클래스에서 가져옴 */
		font-weight: 700 !important; /* today 강조 */
		box-shadow: inset 0 0 0 2px #ffffff; /* 내부 흰색 테두리로 today 표시 */
	}

	/* 극소형 모바일에서는 최소값 보장 */
	@media (max-width: 480px) {
		.calendar-weekday {
			font-size: 0.75rem;
			min-height: 30px;
		}
		
		.calendar-day {
			font-size: 0.875rem;
			min-height: 40px;
		}
	}

	/* 대형 화면에서는 최대값 보장 */
	@media (min-width: 1400px) {
		.calendar-weekday {
			font-size: 1.125rem;
			min-height: 50px;
		}
		
		.calendar-day {
			font-size: 1.375rem;
			min-height: 60px;
		}
	}
</style>