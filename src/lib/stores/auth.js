import { writable } from 'svelte/store';
import { adminAPI } from '../services/api.js';
import { setAuthModule } from '../../shared/services/apiBase.js';
import { analyzeTokenStatus } from '../utils/tokenUtils.js';
import { goto } from '$app/navigation';
import { base } from '$app/paths';

/**
 * 관리자 인증 상태 관리
 * 간단하고 명확한 JWT 토큰 관리 시스템
 */

// 인증 상태
export const isAuthenticated = writable(false);
export const currentAdmin = writable(null);
export const accessToken = writable(null);
export const isLoading = writable(false);

// 내부 토큰 저장소
let currentAccessToken = null;

/**
 * 액세스 토큰 설정 및 세션 저장
 */
export function setAccessToken(token) {
	currentAccessToken = token;
	accessToken.set(token);
	
	if (typeof window !== 'undefined') {
		try {
			if (token) {
				sessionStorage.setItem('admin_access_token', token);
			} else {
				sessionStorage.removeItem('admin_access_token');
			}
		} catch (error) {
			console.error('sessionStorage 접근 실패:', error);
		}
	}
}

/**
 * 현재 액세스 토큰 가져오기
 */
export function getAccessToken() {
	if (!currentAccessToken && typeof window !== 'undefined') {
		try {
			currentAccessToken = sessionStorage.getItem('admin_access_token');
		} catch (error) {
			console.error('sessionStorage 접근 실패:', error);
		}
	}
	return currentAccessToken;
}

/**
 * 관리자 전화번호 인증 및 로그인
 */
async function baseVerifyPhoneAndLogin(phone) {
	isLoading.set(true);
	
	try {
		const response = await adminAPI.verifyPhone(phone);
		
		// 액세스 토큰 설정
		setAccessToken(response.access_token);
		
		// 관리자 정보 설정
		const adminInfo = {
			admin_id: response.admin_id,
			name: response.admin_name,
			phone: phone
		};
		
		currentAdmin.set(adminInfo);
		isAuthenticated.set(true);
		
		return {
			success: true,
			admin: adminInfo
		};
		
	} catch (error) {
		console.error('전화번호 인증 실패:', error);
		return {
			success: false,
			error: error.message || '전화번호 인증에 실패했습니다.'
		};
	} finally {
		isLoading.set(false);
	}
}

/**
 * 리프레시 토큰으로 액세스 토큰 갱신
 */
export async function refreshAccessToken() {
	try {
		const response = await adminAPI.refreshToken();
		
		// 새 액세스 토큰 설정
		setAccessToken(response.access_token);
		
		// 관리자 정보 업데이트
		const adminInfo = {
			admin_id: response.admin_id,
			name: response.admin_name
		};
		
		currentAdmin.set(adminInfo);
		isAuthenticated.set(true);
		
		return {
			success: true,
			admin: adminInfo
		};
		
	} catch (error) {
		console.error('토큰 갱신 실패:', error);
		// 갱신 실패시 로그아웃 처리
		await logout();
		return {
			success: false,
			error: error.message || '토큰 갱신에 실패했습니다.'
		};
	}
}

/**
 * 현재 관리자 정보 조회
 */
export async function getCurrentAdminInfo() {
	const token = getAccessToken();
	if (!token) {
		return { success: false, error: '액세스 토큰이 없습니다.' };
	}
	
	try {
		const adminInfo = await adminAPI.getCurrentAdmin(token);
		
		currentAdmin.set(adminInfo);
		isAuthenticated.set(true);
		
		return {
			success: true,
			admin: adminInfo
		};
		
	} catch (error) {
		console.error('관리자 정보 조회 실패:', error);
		// 실패시 토큰 갱신 시도
		return await refreshAccessToken();
	}
}

/**
 * 인증 상태 확인 및 자동 로그인
 */
async function baseCheckAuthStatus() {
	isLoading.set(true);
	
	try {
		// 먼저 기존 액세스 토큰으로 시도
		const token = getAccessToken();
		if (token) {
			const result = await getCurrentAdminInfo();
			if (result.success) {
				return result;
			}
		}
		
		// 액세스 토큰이 작동하지 않으면 리프레시 토큰으로 시도
		const refreshResult = await refreshAccessToken();
		return refreshResult;
		
	} catch (error) {
		console.error('인증 상태 확인 실패:', error);
		await baseLogout();
		return { success: false };
	} finally {
		isLoading.set(false);
	}
}

/**
 * 로그아웃
 */
async function baseLogout() {
	const token = getAccessToken();
	
	try {
		// 로그아웃 API 호출
		await adminAPI.logout(token);
	} catch (error) {
		console.error('로그아웃 API 실패:', error);
		// API 실패해도 로컬 정리는 계속
	}
	
	// 로컬 상태 정리
	setAccessToken(null);
	currentAdmin.set(null);
	isAuthenticated.set(false);
	
	// 관리자 페이지 메인으로 리다이렉트
	if (typeof window !== 'undefined') {
		goto(`${base}/`);
	}
}

// 토큰 모니터링 인터벌 ID
let tokenMonitorInterval = null;

/**
 * 토큰 모니터링 시작
 * 30초마다 토큰 상태를 체크하고 필요시 자동 갱신
 */
function startTokenMonitoring() {
	if (typeof window === 'undefined') return;
	
	// 기존 인터벌 정리
	if (tokenMonitorInterval) {
		clearInterval(tokenMonitorInterval);
	}
	
	// 30초마다 토큰 상태 체크
	tokenMonitorInterval = setInterval(async () => {
		const token = getAccessToken();
		if (!token) return;
		
		const tokenStatus = analyzeTokenStatus(token);
		
		// 토큰이 만료되었거나 1분 내 만료 예정인 경우
		if (tokenStatus.needsRefresh) {
			// console.log('백그라운드 토큰 갱신 필요 감지, 자동 갱신 시도...');
			try {
				await refreshAccessToken();
				// console.log('백그라운드 토큰 갱신 성공');
			} catch (error) {
				console.error('백그라운드 토큰 갱신 실패:', error);
				// 갱신 실패시 모니터링 중지 (logout이 호출됨)
				stopTokenMonitoring();
			}
		}
	}, 30 * 1000); // 30초마다 체크
	
	// console.log('토큰 모니터링 시작됨');
}

/**
 * 토큰 모니터링 중지
 */
function stopTokenMonitoring() {
	if (tokenMonitorInterval) {
		clearInterval(tokenMonitorInterval);
		tokenMonitorInterval = null;
		// console.log('토큰 모니터링 중지됨');
	}
}

/**
 * 관리자 전화번호 인증 및 로그인 (모니터링 포함)
 */
export async function verifyPhoneAndLogin(phone) {
	const result = await baseVerifyPhoneAndLogin(phone);
	
	if (result.success) {
		// 로그인 성공시 토큰 모니터링 시작
		startTokenMonitoring();
	}
	
	return result;
}

/**
 * 인증 상태 확인 및 자동 로그인 (모니터링 포함)
 */
export async function checkAuthStatus() {
	const result = await baseCheckAuthStatus();
	
	if (result.success) {
		// 인증 성공시 토큰 모니터링 시작
		startTokenMonitoring();
	}
	
	return result;
}

/**
 * 로그아웃 (모니터링 중지 포함)
 */
export async function logout() {
	// 토큰 모니터링 중지
	stopTokenMonitoring();
	
	// 기존 로그아웃 로직 실행
	return await baseLogout();
}

// API 인터셉터에 인증 모듈 등록 (브라우저에서만)
if (typeof window !== 'undefined') {
	setAuthModule({
		getAccessToken,
		analyzeTokenStatus,
		refreshAccessToken,
		logout
	});
	
	// 페이지 로드시 기존 토큰이 있으면 모니터링 시작
	const existingToken = sessionStorage.getItem('admin_access_token');
	if (existingToken) {
		// 토큰 유효성 확인 후 모니터링 시작
		const tokenStatus = analyzeTokenStatus(existingToken);
		if (tokenStatus.isValid) {
			startTokenMonitoring();
		}
	}
}