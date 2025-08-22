/**
 * Shared API Base Service for Ok's House Applications
 * 간단하고 명확한 API 베이스 서비스
 */

// API Configuration
export const API_BASE_URL = 'http://localhost:8000/api/v1';

// 인증 모듈 참조 (동적으로 설정됨)
let authModule = null;

/**
 * 인증 모듈 설정 (auth.js에서 호출)
 */
export function setAuthModule(module) {
	authModule = module;
}

/**
 * 관리자 API 요청인지 확인
 */
function isAdminAPIRequest(endpoint) {
	return endpoint.includes('/admin/') && 
	       !endpoint.includes('/admin/auth/verify-phone') &&
	       !endpoint.includes('/admin/auth/refresh');
}

/**
 * Generic API request handler with automatic token management
 * @param {string} endpoint - API endpoint path
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} API response data
 */
export async function apiRequest(endpoint, options = {}) {
	const url = `${API_BASE_URL}${endpoint}`;
	
	// 관리자 API 요청인 경우 토큰 자동 갱신 체크
	if (isAdminAPIRequest(endpoint) && authModule) {
		try {
			const accessToken = authModule.getAccessToken();
			
			if (accessToken) {
				// 토큰 상태 분석
				const tokenStatus = authModule.analyzeTokenStatus(accessToken);
				
				// 토큰 갱신이 필요한 경우
				if (tokenStatus.needsRefresh) {
					// console.log('API 요청 전 토큰 갱신 필요, 자동 갱신 시도...');
					const refreshResult = await authModule.refreshAccessToken();
					
					if (!refreshResult.success) {
						console.error('API 요청 전 토큰 갱신 실패');
						throw new Error('인증 토큰 갱신에 실패했습니다.');
					}
				}
				
				// 갱신된 토큰으로 헤더 업데이트
				const currentToken = authModule.getAccessToken();
				if (currentToken) {
					options.headers = {
						...options.headers,
						'Authorization': `Bearer ${currentToken}`
					};
				}
			}
		} catch (error) {
			console.error('토큰 갱신 중 오류 발생:', error);
			// 토큰 갱신 실패시에도 원래 요청은 시도
		}
	}
	
	const defaultOptions = {
		credentials: 'include',  // Include cookies with requests
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		}
	};

	try {
		const response = await fetch(url, defaultOptions);
		
		if (response.status === 204) {
			return { success: true };
		}
		
		// 401 Unauthorized 처리
		if (response.status === 401 && isAdminAPIRequest(endpoint) && authModule) {
			console.log('API 요청에서 401 오류 발생, 인증 실패 처리 시작');
			
			// 인증 실패 처리 (로그아웃)
			await authModule.logout();
			
			const errorData = await response.json().catch(() => ({ detail: 'Authentication failed' }));
			throw new Error(errorData.detail || '인증이 만료되었습니다. 다시 로그인해주세요.');
		}
		
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
			
			// Handle different error response formats
			let errorMessage;
			if (errorData.detail) {
				// FastAPI standard format
				errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
			} else if (errorData.message) {
				// Alternative message format
				errorMessage = errorData.message;
			} else if (typeof errorData === 'string') {
				// Direct string error
				errorMessage = errorData;
			} else {
				// Fallback with status
				errorMessage = `HTTP ${response.status}: ${response.statusText}`;
			}
			
			throw new Error(errorMessage);
		}
		
		return await response.json();
	} catch (error) {
		console.error(`API Request failed for ${endpoint}:`, error);
		throw error;
	}
}

/**
 * Format a Date object for API consumption (YYYY-MM-DD)
 */
export function formatDateForAPI(date) {
	if (!date) return null;
	
	const dateObj = date instanceof Date ? date : new Date(date);
	
	if (isNaN(dateObj.getTime())) {
		throw new Error('Invalid date provided to formatDateForAPI');
	}
	
	// Use local date to avoid timezone conversion issues
	const year = dateObj.getFullYear();
	const month = String(dateObj.getMonth() + 1).padStart(2, '0');
	const day = String(dateObj.getDate()).padStart(2, '0');
	
	return `${year}-${month}-${day}`;
}