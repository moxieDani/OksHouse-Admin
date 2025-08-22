/**
 * 예약 관련 유틸리티 함수들
 * 예약 데이터 처리, 필터링, 포맷팅 등의 기능을 제공합니다.
 */

import { formatKoreanDate } from '../../shared/utils/dateUtils.js';
import { statusDisplayText, statusColorClasses } from '../constants/reservations.js';

/**
 * 예약 상태 한글 텍스트 반환
 * @param {string} status - 예약 상태
 * @returns {string} 한글 상태 텍스트
 */
export function getReservationStatusText(status) {
	return statusDisplayText[status] || status;
}

/**
 * 예약 상태별 CSS 클래스 반환
 * @param {string} status - 예약 상태
 * @returns {string} CSS 클래스명
 */
export function getStatusColor(status) {
	return statusColorClasses[status] || 'status-default';
}

/**
 * 예약 기간 포맷팅
 * @param {Object} reservation - 예약 객체
 * @returns {string} 포맷된 예약 기간
 */
export function formatReservationPeriod(reservation) {
	const startStr = formatKoreanDate(reservation.startDate);
	const endStr = formatKoreanDate(reservation.endDate);
	return `${startStr} ~ ${endStr} (${reservation.duration}박)`;
}

/**
 * 카테고리별 예약 그룹화
 * @param {Array} reservations - 예약 목록
 * @param {string} adminId - 현재 관리자 ID
 * @returns {Object} 그룹화된 예약 객체
 */
export function groupReservationsByCategory(reservations, adminId) {
	return {
		'확정': reservations.filter(r => r.status === 'confirmed'),
		'대기': reservations.filter(r => r.status === 'pending'), 
		'거절': reservations.filter(r => r.status === 'cancelled'),
		'이용종료': reservations.filter(r => r.status === 'expired'),
		'내 결정': reservations.filter(r => r.confirmed_by === adminId)
	};
}

/**
 * 필터에 따른 예약 목록 필터링
 * @param {Array} reservations - 전체 예약 목록
 * @param {string} selectedFilter - 선택된 필터
 * @param {Object} groupedReservations - 그룹화된 예약
 * @returns {Array} 필터링된 예약 목록
 */
export function filterReservations(reservations, selectedFilter, groupedReservations) {
	return selectedFilter === '전체' 
		? reservations 
		: groupedReservations[selectedFilter] || [];
}

/**
 * 예약 상태 검증
 * @param {string} currentStatus - 현재 상태
 * @param {string} newStatus - 새로운 상태
 * @returns {Object} 검증 결과 { isValid, message }
 */
export function validateStatusChange(currentStatus, newStatus) {
	if (currentStatus === newStatus) {
		const statusNames = {
			'confirmed': '승인',
			'pending': '대기',
			'cancelled': '거절'
		};
		return {
			isValid: false,
			message: `이미 ${statusNames[newStatus]} 상태입니다.`
		};
	}
	
	return { isValid: true, message: null };
}