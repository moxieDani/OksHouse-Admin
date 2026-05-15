<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import AdminCalendar from '$lib/components/AdminCalendar.svelte';
	import FeedbackManager from '../../shared/components/FeedbackManager.svelte';
	import { checkAuthStatus, logout, isAuthenticated, currentAdmin as authCurrentAdmin } from '$lib/stores/auth.js';
	import { initializeFCM, requestFCMToken, setupFCMListener, isFCMSupported, showCustomNotification } from '$lib/services/firebase.js';
	import './admin-page.css';
	
	// SvelteKit이 자동으로 전달하는 params prop을 받아서 경고 제거
	export let params = {};
	
	// API 및 서비스 imports
	import { adminAPI } from '$lib/services/api.js';
	import { formatKoreanDate } from '../../shared/utils/dateUtils.js';
	import { showErrorFeedback } from '../../shared/utils/errorUtils.js';
	
	// 상수 imports
	import { administrators, getAdminName, getAdminEmoji, getAdminIdByName, getStringIdFromNumeric, getNumericIdFromString } from '$lib/constants/admins.js';
	import { filterOptions, defaultFilter, statusActionNames, statusChangeMessages, statusChangeTitles } from '$lib/constants/reservations.js';
	
	// 유틸리티 함수 imports
	import { 
		getReservationStatusText, 
		getStatusColor, 
		formatReservationPeriod,
		groupReservationsByCategory,
		filterReservations,
		validateStatusChange
	} from '$lib/utils/reservationUtils.js';
	import { generateReservationCalendar } from '$lib/utils/calendarUtils.js';
	


	// 현재 관리자 정보
	$: adminId = $page.params.adminId;
	$: currentAdmin = adminId && administrators ? administrators[/** @type {keyof typeof administrators} */ (adminId)] : null;

	// 달력 상태 - 초기값은 오늘 날짜 (loadAllReservations 완료 후 첫 카드 기준으로 재조정됨)
	let currentMonth = new Date().getMonth();
	let currentYear = new Date().getFullYear();
	/** @type {any[]} */
	let existingReservations = []; // 현재 월의 예약 데이터
	/** @type {any[]} */
	let allReservations = []; // 전체 예약 데이터 (통계용)
	let isLoading = false; // 초기 로딩 상태
	let isRefreshing = false; // 새로고침 상태


	// 필터링 상태 관리
	let selectedFilter = defaultFilter;
	
	// 상세보기 팝업 상태
	let showDetailModal = false;
	let selectedDetailReservation = null;

	// 상태 변경 확인 모달 상태
	let showConfirmModal = false;
	let confirmAction = null;
	let confirmActionText = '';
	let confirmActionType = '';

	// 유효하지 않은 상태 모달 상태
	let showInvalidStateModal = false;
	let invalidStateMessage = '';

	// 상태 변경 완료 모달 상태
	let showCompletionModal = false;
	let completionMessage = '';
	let completionTitle = '';
	
	


	// 피드백 관리자 상태
	let feedbackManager = {
		show: false,
		type: 'info',
		title: '',
		message: ''
	};

	/**
	 * step 영역의 하단을 reservations-list 하단과 일치시키기
	 */
	function adjustHeightToLastCard() {
		if (typeof window === 'undefined') return;
		
		setTimeout(() => {
			const reservationsList = document.querySelector('.reservations-list');
			const stepElement = document.querySelector('.step');
			
			if (reservationsList && stepElement) {
				// reservations-list의 하단 위치 (뷰포트 기준)
				const reservationsListRect = reservationsList.getBoundingClientRect();
				const reservationsListBottom = reservationsListRect.bottom;
				
				// step의 상단 위치 (뷰포트 기준)  
				const stepTop = stepElement.getBoundingClientRect().top;
				
				// step의 필요한 높이 = reservations-list 하단 - step 상단
				const requiredStepHeight = reservationsListBottom - stepTop;
				
				// step 높이 설정
				if (stepElement instanceof HTMLElement) {
					stepElement.style.minHeight = `${requiredStepHeight}px`;
				}
			}
		}, 150);
	}

	/**
	 * 컴포넌트 마운트 시 인증 확인 및 초기 데이터 로드
	 */
	onMount(async () => {
		// 인증 상태 확인
		const authResult = await checkAuthStatus();
		
		// 인증되지 않은 경우 메인 페이지로 리다이렉트
		if (!authResult.success) {
			goto(`${base}/`);
			return;
		}
		
		// 인증된 관리자와 현재 페이지 관리자가 다른 경우 해당 관리자 페이지로 리다이렉트
		// 백엔드는 숫자 ID, 프론트엔드는 문자열 ID 사용하므로 변환해서 비교
		const authenticatedStringId = getStringIdFromNumeric(authResult.admin.admin_id);
		const currentNumericId = getNumericIdFromString(adminId);
		
		if (authResult.admin && authResult.admin.admin_id !== currentNumericId) {
			goto(`${base}/${authenticatedStringId}`);
			return;
		}
		
		// 실제 API를 통한 데이터 로드
		// 전체 예약 데이터 먼저 로드 → 첫 카드 기준으로 초기 달력 월 결정 → 월별 데이터 로드
		await loadAllReservations();
		const { year, month } = getTargetMonthForFilter(selectedFilter);
		currentYear = year;
		currentMonth = month;
		await loadMonthlyReservations();

		// 초기 높이 조정
		adjustHeightToLastCard();
		
		// 윈도우 리사이즈 시 높이 재조정
		window.addEventListener('resize', adjustHeightToLastCard);
		
		// FCM 초기화는 반응형으로 처리
		// if ($isAuthenticated) {
		// 	initializeFCMNotifications();
		// }
		
		// 정리
		return () => {
			window.removeEventListener('resize', adjustHeightToLastCard);
		};
	});

	// Reactive statement for FCM initialization
	$: if ($isAuthenticated && typeof window !== 'undefined') {
		initializeFCMNotifications();
	}


	/**
	 * 전체 예약 데이터 로드 (통계용)
	 */
	async function loadAllReservations() {
		try {
			const reservations = await adminAPI.getAllReservations();

			if (!Array.isArray(reservations)) {
				throw new Error('API 응답이 배열이 아닙니다.');
			}
			
			// 예약 데이터를 Date 객체로 변환하고 confirmed_by를 관리자 ID로 매핑
			const today = new Date();
			today.setHours(0, 0, 0, 0); // 오늘 날짜의 시작 시점
			
			allReservations = reservations.map(reservation => {
				const endDate = new Date(reservation.end_date + 'T00:00:00');
				const isPastReservation = endDate < today;
				
				// 과거 예약인 경우 상태를 'expired'로 변경
				const finalStatus = isPastReservation ? 'expired' : reservation.status;
				
				// confirmed_by 처리 - 백엔드에서 관리자 이름을 받아서 ID로 변환
				let confirmedBy = null;
				if (reservation.confirmed_by) {
					confirmedBy = getAdminIdByName(reservation.confirmed_by);
					if (!confirmedBy) {
						// 변환에 실패한 경우, 원본 값을 그대로 사용 (혹시 이미 ID인 경우)
						confirmedBy = reservation.confirmed_by;
					}
				}
				
				return {
					...reservation,
					startDate: new Date(reservation.start_date + 'T00:00:00'),
					endDate,
					status: finalStatus,
					confirmed_by: confirmedBy,
					confirmed_at: reservation.updated_at || reservation.created_at,
					isPastReservation
				};
			});
			
			// console.log('처리된 전체 예약 데이터:', allReservations.length, allReservations);
		} catch (error) {
			console.error('전체 예약 로드 실패:', error);
			allReservations = [];
		}
	}

	/**
	 * 월별 예약 데이터 로드
	 */
	async function loadMonthlyReservations() {
		isLoading = true;

		try {
			const reservations = await adminAPI.getMonthlyReservations(currentYear, currentMonth + 1);

			if (!Array.isArray(reservations)) {
				throw new Error('API 응답이 배열이 아닙니다.');
			}
			
			// 예약 데이터를 Date 객체로 변환하고 confirmed_by를 관리자 ID로 매핑
			const today = new Date();
			today.setHours(0, 0, 0, 0); // 오늘 날짜의 시작 시점
			
			existingReservations = reservations.map(reservation => {
				const endDate = new Date(reservation.end_date + 'T00:00:00');
				const isPastReservation = endDate < today;
				
				// 과거 예약인 경우 상태를 'expired'로 변경
				const finalStatus = isPastReservation ? 'expired' : reservation.status;
				
				// confirmed_by 처리 - 백엔드에서 관리자 이름을 받아서 ID로 변환
				let confirmedBy = null;
				if (reservation.confirmed_by) {
					confirmedBy = getAdminIdByName(reservation.confirmed_by);
					if (!confirmedBy) {
						// 변환에 실패한 경우, 원본 값을 그대로 사용 (혹시 이미 ID인 경우)
						confirmedBy = reservation.confirmed_by;
					}
				}
				
				return {
					...reservation,
					startDate: new Date(reservation.start_date + 'T00:00:00'),
					endDate,
					status: finalStatus,
					confirmed_by: confirmedBy,
					confirmed_at: reservation.updated_at || reservation.created_at,
					isPastReservation
				};
			});
		} catch (error) {
			console.error('월별 예약 로드 실패:', error);
			console.error('Error details:', error.message, error.stack);

			// 로딩 실패 시 빈 배열로 설정
			existingReservations = [];
			
			showErrorFeedback(
				feedbackManager,
				'데이터 로드 오류',
				`예약 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`
			);
		} finally {
			isLoading = false;
		}
	}

	/**
	 * 달 변경 이벤트 처리
	 */
	function handleMonthChange(event) {
		currentMonth = event.detail.month;
		currentYear = event.detail.year;
		loadMonthlyReservations();
	}

	/**
	 * 예약이 있는 날짜 클릭 이벤트 처리
	 */
	function handleReservationDateClick(event) {
		const { reservations } = event.detail;
		// 해당 날짜에 예약이 하나만 있으면 바로 상세보기, 여러 개면 첫 번째 예약 상세보기
		if (reservations && reservations.length > 0) {
			openDetailModal(reservations[0]);
		}
	}





	/**
	 * 예약 정렬 비교자
	 * 1차: 상태(대기 → 확정 → 거절 → 이용종료), 2차: 체크인 날짜 오름차순
	 * @param {any} a
	 * @param {any} b
	 */
	function compareReservations(a, b) {
		/** @type {Record<string, number>} */
		const statusOrder = { pending: 0, confirmed: 1, cancelled: 2, expired: 3 };
		const orderA = statusOrder[a.status] ?? 99;
		const orderB = statusOrder[b.status] ?? 99;
		if (orderA !== orderB) return orderA - orderB;
		const dateA = new Date(a.startDate || a.start_date);
		const dateB = new Date(b.startDate || b.start_date);
		return dateA.getTime() - dateB.getTime();
	}

	/**
	 * 주어진 필터의 첫 번째 카드 날짜가 포함된 달을 계산
	 * 첫 번째 카드가 없으면 오늘 날짜의 달을 반환
	 * @param {string} filter
	 * @returns {{ year: number, month: number }}
	 */
	function getTargetMonthForFilter(filter) {
		if (adminId) {
			const grouped = groupReservationsByCategory(allReservations, adminId);
			const filtered = filterReservations(allReservations, filter, grouped);
			const sorted = [...filtered].sort(compareReservations);
			const first = sorted[0];
			if (first) {
				const checkInDate = first.startDate || new Date(first.start_date);
				return { year: checkInDate.getFullYear(), month: checkInDate.getMonth() };
			}
		}
		const today = new Date();
		return { year: today.getFullYear(), month: today.getMonth() };
	}

	/**
	 * 필터 변경 처리
	 * 필터 변경 후 정렬된 예약목록의 첫 번째 카드 날짜가 포함된 달로 달력 이동
	 * @param {string} filter
	 */
	async function handleFilterChange(filter) {
		selectedFilter = filter;

		const { year, month } = getTargetMonthForFilter(filter);
		if (currentYear !== year || currentMonth !== month) {
			currentYear = year;
			currentMonth = month;
			await loadMonthlyReservations();
		}

		// 필터 변경 후 마지막 카드 하단에 맞춰 높이 재조정
		setTimeout(() => {
			adjustHeightToLastCard();
		}, 100);
		// DOM 완전히 업데이트 후 한 번 더 실행
		setTimeout(() => {
			adjustHeightToLastCard();
		}, 300);
	}

	/**
	 * 상세보기 팝업 열기 (달력 이동 포함)
	 */
	async function openDetailModal(reservation) {
		// 예약의 체크인 날짜로 달력 이동
		const checkInDate = reservation.startDate || new Date(reservation.start_date);
		const targetYear = checkInDate.getFullYear();
		const targetMonth = checkInDate.getMonth(); // 0-based index
		
		// 현재 달력과 다른 년/월이면 달력 이동
		if (currentYear !== targetYear || currentMonth !== targetMonth) {
			currentYear = targetYear;
			currentMonth = targetMonth;
			
			// 해당 월의 예약 데이터 로드
			await loadMonthlyReservations();
		}
		
		// 모달창 표시
		selectedDetailReservation = reservation;
		showDetailModal = true;
	}

	/**
	 * 상세보기 팝업 닫기
	 */
	function closeDetailModal() {
		selectedDetailReservation = null;
		showDetailModal = false;
	}



	/**
	 * 카테고리별 예약 그룹화 (전체 데이터 기준)
	 */
	$: groupedReservations = groupReservationsByCategory(allReservations, adminId);

	/**
	 * 필터링된 예약 목록 (전체 데이터 기준)
	 */
	$: filteredReservations = filterReservations(allReservations, selectedFilter, groupedReservations);

	/**
	 * 상태 순서(대기 → 확정 → 거절 → 이용종료) 우선, 동일 상태 내에서는 체크인 날짜 오름차순
	 */
	$: sortedReservations = [...filteredReservations].sort(compareReservations);

	/**
	 * 정렬된 예약 목록이 변경될 때마다 높이 재조정
	 */
	$: if (sortedReservations && typeof window !== 'undefined') {
		// 데이터 변경 시 즉시 높이 조정
		setTimeout(() => {
			adjustHeightToLastCard();
		}, 100);
		// 렌더링 완료 후 한 번 더 정확히 조정
		setTimeout(() => {
			adjustHeightToLastCard();
		}, 250);
	}



	/**
	 * 예약 상태 변경 시도
	 */
	function attemptStatusChange(newStatus) {
		const currentStatus = selectedDetailReservation.status;
		
		// 상태 변경 유효성 검증
		const validation = validateStatusChange(currentStatus, newStatus);
		if (!validation.isValid) {
			invalidStateMessage = validation.message;
			showInvalidStateModal = true;
			return;
		}
		
		// 확인 모달 표시
		confirmActionText = statusActionNames[newStatus];
		confirmActionType = newStatus;
		confirmAction = () => changeReservationStatus(newStatus);
		showConfirmModal = true;
	}

	/**
	 * 예약 상태 변경 실행
	 */
	async function changeReservationStatus(newStatus) {
		if (!selectedDetailReservation) return;
		
		try {
			// API를 통해 백엔드에서 상태 업데이트
			const adminName = getAdminName(adminId);
			const updatedReservation = await adminAPI.updateReservationStatus(
				selectedDetailReservation.id, 
				newStatus, 
				adminName
			);
			
			// 응답받은 데이터로 로컬 상태 업데이트
			let confirmedBy = null;
			if (updatedReservation.confirmed_by) {
				confirmedBy = getAdminIdByName(updatedReservation.confirmed_by);
				if (!confirmedBy) {
					// 변환에 실패한 경우, 원본 값을 그대로 사용 (혹시 이미 ID인 경우)
					confirmedBy = updatedReservation.confirmed_by;
				}
			}
			
			const updatedReservationData = {
				...selectedDetailReservation,
				status: updatedReservation.status,
				confirmed_by: confirmedBy,
				updated_at: updatedReservation.updated_at
			};
			
			// 전체 예약 목록에서 해당 예약을 찾아 업데이트 (Svelte 반응성을 위해 배열 재할당)
			const allIndex = allReservations.findIndex(r => r.id === selectedDetailReservation.id);
			if (allIndex !== -1) {
				allReservations = allReservations.map((reservation, i) => 
					i === allIndex ? updatedReservationData : reservation
				);
			}
			
			// 현재 월 예약 목록에서도 업데이트 (달력 표시용)
			const monthIndex = existingReservations.findIndex(r => r.id === selectedDetailReservation.id);
			if (monthIndex !== -1) {
				existingReservations = existingReservations.map((reservation, i) => 
					i === monthIndex ? updatedReservationData : reservation
				);
			}
			
			// 모달도 업데이트된 정보로 다시 렌더링되도록 재할당
			selectedDetailReservation = { ...updatedReservationData };
			
			// 달력 새로고침 (상태 변경이 모든 달력에 반영되도록)
			await refreshCalendar();
			
			// 완료 모달 표시
			completionTitle = statusChangeTitles[newStatus];
			completionMessage = statusChangeMessages[newStatus];
			showCompletionModal = true;
			
		} catch (error) {
			console.error('예약 상태 변경 실패:', error);
			showErrorFeedback(feedbackManager, '예약 상태 변경에 실패했습니다.', error);
		}
		
		closeConfirmModal();
	}

	/**
	 * 확인 모달 닫기
	 */
	function closeConfirmModal() {
		showConfirmModal = false;
		confirmAction = null;
		confirmActionText = '';
		confirmActionType = '';
	}

	/**
	 * 유효하지 않은 상태 모달 닫기
	 */
	function closeInvalidStateModal() {
		showInvalidStateModal = false;
		invalidStateMessage = '';
	}

	/**
	 * 완료 모달 닫기
	 */
	function closeCompletionModal() {
		showCompletionModal = false;
		completionMessage = '';
		completionTitle = '';
	}

	/**
	 * 달력 새로고침 - 상태 변경 후 모든 달력 업데이트
	 */
	async function refreshCalendar() {
		try {
			await loadAllReservations(); // 전체 예약 데이터도 새로고침
			await loadMonthlyReservations();
		} catch (error) {
			console.error('달력 새로고침 실패:', error);
		}
	}

	/**
	 * 수동 새로고침 - 사용자가 버튼을 클릭할 때
	 */
	async function handleRefresh() {
		if (isRefreshing) return; // 이미 새로고침 중이면 중단
		
		isRefreshing = true;
		try {
			await loadAllReservations(); // 전체 예약 데이터도 새로고침
			await loadMonthlyReservations();
		} catch (error) {
			console.error('새로고침 실패:', error);
			showErrorFeedback(feedbackManager, '새로고침에 실패했습니다.', error);
		} finally {
			isRefreshing = false;
		}
	}

	/**
	 * 로그아웃 처리
	 */
	async function handleLogout() {
		try {
			await logout();
			// 메인 관리자 페이지로 리다이렉트
			goto(`${base}/`);
		} catch (error) {
			console.error('로그아웃 실패:', error);
			showErrorFeedback(feedbackManager, '로그아웃에 실패했습니다.', error.message);
		}
	}

	/**
	 * FCM 초기화 및 토큰 등록
	 */
	async function initializeFCMNotifications() {
		if (!isFCMSupported()) {
			console.log('FCM이 지원되지 않는 브라우저입니다');
			return;
		}

		try {
			// FCM 초기화
			await initializeFCM();

			// FCM 토큰 요청
			const fcmToken = await requestFCMToken();
			
			if (fcmToken) {
				// 서버에 토큰 등록
				await adminAPI.registerFCMToken(fcmToken);
				// console.log('FCM 토큰이 서버에 성공적으로 등록되었습니다:', fcmToken);

				// 포그라운드 메시지 리스너 설정
				await setupFCMListener((payload) => {
					// console.log('푸시 알림 수신:', payload);

					// 포그라운드 상태에서도 알림 표시
					if (payload.notification) {
						showCustomNotification(payload.notification, payload.data);
					}
					
					// 예약 관련 알림인 경우 데이터 새로고침
					if (payload.data?.type === 'reservation') {
						handleRefresh();
					}
				});
			}
		} catch (error) {
			console.error('FCM 초기화 실패:', error);
			if (error.message.includes('알림 권한이 거부되었습니다')) {
				showErrorFeedback(
					feedbackManager,
					'알림 권한 필요',
					'푸시 알림을 받으려면 브라우저 설정에서 알림 권한을 허용해주세요. 시크릿 모드에서는 알림 기능이 작동하지 않을 수 있습니다.'
				);
			} else {
				showErrorFeedback(
					feedbackManager,
					'FCM 초기화 실패',
					'푸시 알림 서비스 초기화에 실패했습니다. 페이지를 새로고침하거나 다시 시도해주세요.'
				);
			}
		}
	}
</script>

<svelte:head>
	<title>{currentAdmin?.name} 관리자 - Ok's House 관리 시스템</title>
</svelte:head>

<!-- 메인 콘텐츠 -->
<div class="admin-page-header">
	{#if currentAdmin}
		<div class="admin-welcome">
			<span class="admin-emoji">{getAdminEmoji(adminId)}</span> <strong>{currentAdmin.name}</strong>님 환영합니다!
		</div>
	{/if}
	<button class="admin-logout-button" on:click={handleLogout} aria-label="로그아웃">
		Logout
	</button>
</div>
<h1 class="page-title" style="margin-top: 27.5px; font-size: var(--text-3xl);">
	<span class="emoji-normal s-xe9m8xNPUuGQ">🗓️</span> 예약현황
</h1>

<div class="step {sortedReservations.length === 0 ? 'no-reservations' : ''}">
	<div class="calendar-section">
	<!-- 날짜 범위 및 통계 표시 -->
	<div class="date-range-display">
		<div class="stats-summary">
			<button 
				class="summary-item {selectedFilter === '전체' ? 'active' : ''}"
				on:click={() => handleFilterChange('전체')}
				aria-label="전체 예약 보기"
			>
				<span class="summary-number">{allReservations.length}</span>
				<span class="summary-label">전체</span>
			</button>
			<button 
				class="summary-item {selectedFilter === '확정' ? 'active' : ''}"
				on:click={() => handleFilterChange('확정')}
				aria-label="확정된 예약 보기"
			>
				<span class="summary-number confirmed">{allReservations.filter(r => r.status === 'confirmed').length}</span>
				<span class="summary-label">확정</span>
			</button>
			<button 
				class="summary-item {selectedFilter === '대기' ? 'active' : ''}"
				on:click={() => handleFilterChange('대기')}
				aria-label="대기 중인 예약 보기"
			>
				<span class="summary-number pending">{allReservations.filter(r => r.status === 'pending').length}</span>
				<span class="summary-label">대기</span>
			</button>
			<button 
				class="summary-item {selectedFilter === '거절' ? 'active' : ''}"
				on:click={() => handleFilterChange('거절')}
				aria-label="거절된 예약 보기"
			>
				<span class="summary-number cancelled">{allReservations.filter(r => r.status === 'cancelled').length}</span>
				<span class="summary-label">거절</span>
			</button>
			<button 
				class="summary-item {selectedFilter === '이용종료' ? 'active' : ''}"
				on:click={() => handleFilterChange('이용종료')}
				aria-label="이용종료된 예약 보기"
			>
				<span class="summary-number expired">{allReservations.filter(r => r.status === 'expired').length}</span>
				<span class="summary-label">이용종료</span>
			</button>
			<button 
				class="summary-item {selectedFilter === '내 결정' ? 'active' : ''} admin-{adminId}"
				on:click={() => handleFilterChange('내 결정')}
				aria-label="내 결정 예약 보기"
			>
				<span class="summary-number friend admin-{adminId}">{allReservations.filter(r => r.confirmed_by === adminId).length}</span>
				<span class="summary-label">내 결정</span>
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="loading-state">
			<div class="loading-spinner"></div>
			<p>예약 정보를 불러오는 중...</p>
		</div>
	{:else}
		{#key existingReservations.length}
			<AdminCalendar
				{currentMonth}
				{currentYear}
				{existingReservations}
				{isRefreshing}
				onRefresh={handleRefresh}
				on:monthChange={handleMonthChange}
				on:reservationDateClick={handleReservationDateClick}
			/>
		{/key}
	{/if}
	</div>

	<!-- 예약 목록 타이틀 -->
	<div class="reservation-list-title">
		<h4>📝 예약목록</h4>
	</div>

	<!-- 예약자 정보 상세 표시 영역 -->
	{#if sortedReservations.length > 0}
		<div class="reservations-list">
			{#each sortedReservations as reservation}
				<div 
					class="reservation-card clickable {getStatusColor(reservation.status)}"
					on:click={() => openDetailModal(reservation)}
					on:keydown={(e) => e.key === 'Enter' && openDetailModal(reservation)}
					role="button"
					tabindex="0"
					aria-label="{reservation.name} 예약 상세보기"
				>
					<div class="card-content">
						<!-- 첫번째 줄: 이름과 날짜 -->
						<div class="card-row-1">
							<span class="guest-name">👤 {reservation.name}</span>
							<span class="period-dates">{formatKoreanDate(reservation.startDate)} - {formatKoreanDate(reservation.endDate)}</span>
						</div>
						
						<!-- 두번째 줄: 뱃지들 -->
						<div class="card-row-2">
							<div class="status-badge {getStatusColor(reservation.status)}">
								{getReservationStatusText(reservation.status)}
							</div>
							<div class="duration-badge">
								{reservation.duration}박{reservation.duration + 1}일
							</div>
							{#if reservation.confirmed_by}
								<div class="admin-badge admin-theme-{reservation.confirmed_by}">
									{getAdminEmoji(reservation.confirmed_by)} {getAdminName(reservation.confirmed_by)}
								</div>
							{:else if reservation.status === 'confirmed' || reservation.status === 'cancelled'}
								<!-- 확정자 정보가 없는 확정/거절된 예약의 경우 기본 표시 -->
								<div class="admin-badge admin-theme-default">
									👤 관리자
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="no-reservations-message">
			<div class="empty-icon">📅</div>
			<h3>{selectedFilter === '전체' ? '이번 달 예약이 없습니다' : `'${selectedFilter}' 조건에 맞는 예약이 없습니다`}</h3>
			<p>{selectedFilter === '전체' ? '새로운 예약이 들어오면 여기에 표시됩니다.' : '다른 필터를 선택해보세요.'}</p>
		</div>
	{/if}
</div>


<!-- 예약 상세보기 팝업 모달 (상세보기 버튼 클릭 시) -->
{#if showDetailModal && selectedDetailReservation}
	{@const calendarDays = generateReservationCalendar(selectedDetailReservation)}
	<div class="detail-modal">
		<div class="modal-backdrop" on:click={closeDetailModal} role="presentation"></div>
		<div class="modal-content detail-modal-content">
			<div class="modal-header">
				<h3>📋 예약 상세 정보</h3>
				<button class="modal-close" on:click={closeDetailModal} aria-label="닫기">×</button>
			</div>
			
			<div class="modal-body compact">
				<!-- 게스트 정보와 상태 -->
				<div class="guest-status-row">
					<div class="guest-info">
						<h4>👤 {selectedDetailReservation.name}</h4>
						<div class="phone-row">
							<span class="phone-text">📞 {selectedDetailReservation.phone}</span>
						</div>
					</div>
					<div class="status-badge large {getStatusColor(selectedDetailReservation.status)}">
						{getReservationStatusText(selectedDetailReservation.status)}
					</div>
				</div>

				<!-- 달력과 기본 정보를 나란히 배치 -->
				<div class="calendar-info-row">
					<!-- 달력 섹션 -->
					<div class="calendar-section-small">
						<div class="calendar-header">
							<h5>📅 {selectedDetailReservation.startDate.getFullYear()}년 {selectedDetailReservation.startDate.getMonth() + 1}월</h5>
						</div>
						<div class="mini-calendar">
							<div class="calendar-weekdays">
								<div class="weekday">일</div>
								<div class="weekday">월</div>
								<div class="weekday">화</div>
								<div class="weekday">수</div>
								<div class="weekday">목</div>
								<div class="weekday">금</div>
								<div class="weekday">토</div>
							</div>
							<div class="calendar-days">
								{#each calendarDays as day}
									<div class="calendar-day 
										{day.isReserved ? `reserved-${selectedDetailReservation.status}` : ''} 
										{day.isToday ? 'today' : ''} 
										{day.reservationPosition ? `position-${day.reservationPosition}` : ''}
										{!day.isCurrentMonth ? 'other-month' : ''}
										{day.isPrevMonth ? 'prev-month' : ''}
										{day.isNextMonth ? 'next-month' : ''}">
										{day.date}
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- 기본 정보 섹션 -->
					<div class="basic-info-section">
						<div class="info-item">
							<span class="info-label">체크인</span>
							<span class="info-value">{formatKoreanDate(selectedDetailReservation.startDate)}</span>
						</div>
						<div class="info-item">
							<span class="info-label">체크아웃</span>
							<span class="info-value">{formatKoreanDate(selectedDetailReservation.endDate)}</span>
						</div>
						<div class="info-item">
							<span class="info-label">숙박기간</span>
							<span class="info-value">{selectedDetailReservation.duration}박 {selectedDetailReservation.duration + 1}일</span>
						</div>
						<div class="info-item">
							<span class="info-label">신청일시</span>
							<span class="info-value">{new Date(selectedDetailReservation.created_at).toLocaleDateString('ko-KR')}</span>
						</div>
						<!-- 확정/거절 정보 -->
						{#if selectedDetailReservation.status === 'confirmed' || selectedDetailReservation.status === 'cancelled'}
							<div class="confirmed-info {selectedDetailReservation.confirmed_by ? `admin-${selectedDetailReservation.confirmed_by}` : 'admin-default'} {selectedDetailReservation.status === 'cancelled' ? 'rejected-theme' : ''}">
								<span class="confirmed-label">
									{#if selectedDetailReservation.status === 'confirmed'}
										✅ 확정자:
									{:else if selectedDetailReservation.status === 'cancelled'}
										❌ 거절자:
									{/if}
								</span>
								<span class="confirmed-admin">
									{#if selectedDetailReservation.confirmed_by}
										{getAdminEmoji(selectedDetailReservation.confirmed_by)} {getAdminName(selectedDetailReservation.confirmed_by)}
									{:else}
										👤 관리자
									{/if}
								</span>
								{#if selectedDetailReservation.confirmed_at}
									<span class="confirmed-date">
										({new Date(selectedDetailReservation.confirmed_at).toLocaleDateString('ko-KR')})
									</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>

			</div>
			
			<div class="modal-footer action-footer">
				{#if selectedDetailReservation.isPastReservation}
					<div class="past-reservation-notice">
						📅 체크아웃이 완료된 과거 예약입니다.<br>
						상태 변경이 불가능합니다.
					</div>
				{:else}
					<button class="action-button approve-btn" on:click={() => attemptStatusChange('confirmed')}>
						✅ 승인하기
					</button>
					<button class="action-button pending-btn" on:click={() => attemptStatusChange('pending')}>
						⏳ 대기하기
					</button>
					<button class="action-button reject-btn" on:click={() => attemptStatusChange('cancelled')}>
						❌ 거절하기
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- 상태 변경 확인 모달 -->
{#if showConfirmModal}
	<div class="confirm-modal">
		<div class="modal-backdrop" on:click={closeConfirmModal} role="presentation"></div>
		<div class="modal-content confirm-modal-content">
			<div class="modal-header confirm-header confirm-header-{confirmActionType}">
				<h3>⚠️ 예약 상태 변경</h3>
				<button class="modal-close" on:click={closeConfirmModal} aria-label="닫기">×</button>
			</div>
			
			<div class="modal-body confirm-body">
				<div class="confirm-message">
					<p><strong>{selectedDetailReservation?.name}</strong>님의 예약을</p>
					<p class="action-text"><strong>'{confirmActionText}'</strong> 상태로 변경하시겠습니까?</p>
				</div>
			</div>
			
			<div class="modal-footer confirm-footer">
				<button class="modal-button cancel-btn" on:click={closeConfirmModal}>
					취소
				</button>
				<button class="modal-button confirm-btn" on:click={confirmAction}>
					확인
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 유효하지 않은 상태 모달 -->
{#if showInvalidStateModal}
	<div class="invalid-modal">
		<div class="modal-backdrop" on:click={closeInvalidStateModal} role="presentation"></div>
		<div class="modal-content invalid-modal-content">
			<div class="modal-header invalid-header">
				<h3>ℹ️ 알림</h3>
				<button class="modal-close" on:click={closeInvalidStateModal} aria-label="닫기">×</button>
			</div>
			
			<div class="modal-body invalid-body">
				<div class="invalid-message">
					<p>{invalidStateMessage}</p>
				</div>
			</div>
			
			<div class="modal-footer invalid-footer">
				<button class="modal-button" on:click={closeInvalidStateModal}>
					확인
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 상태 변경 완료 모달 -->
{#if showCompletionModal}
	<div class="completion-modal">
		<div class="modal-backdrop" on:click={closeCompletionModal} role="presentation"></div>
		<div class="modal-content completion-modal-content">
			<div class="modal-header completion-header">
				<h3>{completionTitle}</h3>
				<button class="modal-close" on:click={closeCompletionModal} aria-label="닫기">×</button>
			</div>
			
			<div class="modal-body completion-body">
				<div class="completion-message">
					<p>{completionMessage}</p>
				</div>
			</div>
			
			<div class="modal-footer completion-footer">
				<button class="modal-button" on:click={closeCompletionModal}>
					확인
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 피드백 매니저 -->
<FeedbackManager
	bind:show={feedbackManager.show}
	bind:type={feedbackManager.type}
	bind:title={feedbackManager.title}
	bind:message={feedbackManager.message}
/>

