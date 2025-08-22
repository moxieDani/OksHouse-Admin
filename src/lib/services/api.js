/**
 * API Service Layer for Ok's House Admin System
 * Handles all backend API communications for admin interface
 */

import { apiRequest } from '../../shared/services/apiBase.js';

/**
 * Admin API Services - 관리자 전용 API
 */
export const adminAPI = {
	/**
	 * Get monthly reservations for admin view
	 */
	async getMonthlyReservations(year, month) {
		const formattedMonth = month.toString().padStart(2, '0');
		return await apiRequest(`/admin/reservations/monthly/${year}/${formattedMonth}`);
	},

	/**
	 * Get all reservations (admin privilege)
	 */
	async getAllReservations() {
		return await apiRequest('/admin/reservations/');
	},

	/**
	 * Get reservations by date range
	 */
	async getReservationsByDateRange(startDate, endDate) {
		return await apiRequest(`/admin/reservations/range?start_date=${startDate}&end_date=${endDate}`);
	},

	/**
	 * Update reservation status (admin privilege)
	 */
	async updateReservationStatus(reservationId, status, adminName) {
		return await apiRequest(`/admin/reservations/${reservationId}/status`, {
			method: 'PATCH',
			body: JSON.stringify({
				status,
				admin_name: adminName
			})
		});
	},

	/**
	 * Admin Authentication APIs
	 */

	/**
	 * Verify admin phone number and get tokens
	 */
	async verifyPhone(phone) {
		return await apiRequest('/admin/auth/verify-phone', {
			method: 'POST',
			body: JSON.stringify({ phone }),
			credentials: 'include'  // 쿠키 설정을 위해 명시적으로 포함
		});
	},

	/**
	 * Refresh access token using refresh token
	 */
	async refreshToken() {
		return await apiRequest('/admin/auth/refresh', {
			method: 'POST',
			credentials: 'include'  // Include cookies
		});
	},

	/**
	 * Get current admin info
	 */
	async getCurrentAdmin(accessToken) {
		return await apiRequest('/admin/auth/me', {
			headers: {
				'Authorization': `Bearer ${accessToken}`
			}
		});
	},

	/**
	 * Logout admin
	 */
	async logout(accessToken) {
		return await apiRequest('/admin/auth/logout', {
			method: 'POST',
			credentials: 'include',
			headers: accessToken ? {
				'Authorization': `Bearer ${accessToken}`
			} : {}
		});
	},

	/**
	 * FCM 토큰 등록
	 */
	async registerFCMToken(fcmToken) {
		return await apiRequest('/admin/fcm/register-token', {
			method: 'POST',
			body: JSON.stringify({ fcm_token: fcmToken })
		});
	},

	/**
	 * FCM 토큰 해제
	 */
	async unregisterFCMToken(fcmToken) {
		return await apiRequest('/admin/fcm/unregister-token', {
			method: 'DELETE',
			body: JSON.stringify({ fcm_token: fcmToken })
		});
	},

	/**
	 * FCM 테스트 알림 전송
	 */
	async testFCMNotification() {
		return await apiRequest('/admin/fcm/test-notification', {
			method: 'POST'
		});
	}
};

/**
 * User API Services - 관리자가 사용자 예약을 조회할 때 사용
 */
export const userAPI = {
	/**
	 * Get monthly reservations
	 */
	async getMonthlyReservations(year, month) {
		const formattedMonth = month.toString().padStart(2, '0');
		return await apiRequest(`/user/reservations/monthly/${year}/${formattedMonth}`);
	},

	/**
	 * Get all reservations for a user (by name and phone)
	 */
	async getUserReservations(name, phone) {
		return await apiRequest('/user/reservations/user', {
			method: 'POST',
			body: JSON.stringify({ name, phone })
		});
	}
};

