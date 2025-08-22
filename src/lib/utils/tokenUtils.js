/**
 * JWT 토큰 파싱 및 만료 시간 관리 유틸리티
 * 간단하고 효율적인 토큰 분석 기능
 */

/**
 * JWT 토큰 디코딩
 * @param {string} token - JWT 토큰
 * @returns {object|null} - 디코딩된 페이로드 또는 null
 */
export function decodeJWTToken(token) {
	if (!token || typeof token !== 'string') {
		return null;
	}

	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			return null;
		}

		// Base64URL 디코딩
		const payload = parts[1];
		const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
		return JSON.parse(decoded);
	} catch (error) {
		console.error('JWT 토큰 디코딩 실패:', error);
		return null;
	}
}

/**
 * JWT 토큰 만료 시간 가져오기
 * @param {string} token - JWT 토큰
 * @returns {number|null} - 만료 시간(Unix timestamp) 또는 null
 */
export function getTokenExpiration(token) {
	const payload = decodeJWTToken(token);
	return payload?.exp || null;
}

/**
 * JWT 토큰 만료 확인
 * @param {string} token - JWT 토큰
 * @returns {boolean} - 만료 여부
 */
export function isTokenExpired(token) {
	const expiration = getTokenExpiration(token);
	if (!expiration) {
		return true;
	}

	const currentTime = Math.floor(Date.now() / 1000);
	return currentTime >= expiration;
}

/**
 * JWT 토큰 만료까지 남은 시간(초)
 * @param {string} token - JWT 토큰
 * @returns {number} - 남은 시간(초), 만료된 경우 0
 */
export function getTimeUntilExpiration(token) {
	const expiration = getTokenExpiration(token);
	if (!expiration) {
		return 0;
	}

	const currentTime = Math.floor(Date.now() / 1000);
	const timeLeft = expiration - currentTime;
	return Math.max(0, timeLeft);
}

/**
 * 액세스 토큰이 1분 내에 만료되는지 확인
 * @param {string} accessToken - 액세스 토큰
 * @returns {boolean} - 1분 내 만료 여부
 */
export function isAccessTokenExpiringInOneMinute(accessToken) {
	const timeLeft = getTimeUntilExpiration(accessToken);
	return timeLeft <= 60 && timeLeft > 0;
}

/**
 * 토큰 상태 종합 분석
 * @param {string} accessToken - 액세스 토큰
 * @returns {object} - 토큰 상태 분석 결과
 */
export function analyzeTokenStatus(accessToken) {
	if (!accessToken) {
		return {
			isValid: false,
			isExpired: true,
			isExpiringInOneMinute: false,
			timeLeft: 0,
			needsRefresh: true
		};
	}

	const isExpired = isTokenExpired(accessToken);
	const isExpiringInOneMinute = isAccessTokenExpiringInOneMinute(accessToken);
	const timeLeft = getTimeUntilExpiration(accessToken);
	
	return {
		isValid: !isExpired,
		isExpired: isExpired,
		isExpiringInOneMinute: isExpiringInOneMinute,
		timeLeft: timeLeft,
		needsRefresh: isExpired || isExpiringInOneMinute
	};
}