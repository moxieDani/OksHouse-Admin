import { writable } from 'svelte/store';
import { adminAPI } from '../services/api.js';
import { setAuthModule } from '../../shared/services/apiBase.js';
import { analyzeTokenStatus } from '../utils/tokenUtils.js';
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { setCookie, getCookie, eraseCookie } from '../utils/cookieUtils.js';

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
let isLoggingOut = false; // 로그아웃 진행 상태 플래그

/**
 * 액세스 토큰 설정 및 세션 저장
 */
export function setAccessToken(token) {
	currentAccessToken = token;
	accessToken.set(token);
	
	if (typeof window !== 'undefined') {
		try {
			if (token) {
				localStorage.setItem('admin_access_token', token);
			} else {
				localStorage.removeItem('admin_access_token');
			}
		} catch (error) {
			console.error('localStorage 접근 실패:', error);
		}
	}
}

/**
 * 현재 액세스 토큰 가져오기
 */
export function getAccessToken() {
	if (!currentAccessToken && typeof window !== 'undefined') {
		try {
			currentAccessToken = localStorage.getItem('admin_access_token');
		} catch (error) {
			console.error('localStorage 접근 실패:', error);
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

		// 쿠키가 없을 때만 전화번호 쿠키에 저장 (365일)
		const existingPhone = getCookie('admin_phone');
		if (!existingPhone) {
			setCookie('admin_phone', btoa(phone), 365);
		}
		
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
	if (isLoggingOut) {
		return { success: false, error: "Logout in progress." };
	}

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
		if (isLoggingOut) {
			return { success: false, error: "Logout in progress." };
		}
		// 토큰 갱신 실패 시 쿠키에 저장된 전화번호로 재로그인 시도
		const encodedPhone = getCookie('admin_phone');
		if (encodedPhone) {
			const storedPhone = atob(encodedPhone);
			// 재시도 전에 기존 액세스 토큰을 삭제합니다.
			setAccessToken(null);
			return await verifyPhoneAndLogin(storedPhone);
		} else {
			// 저장된 전화번호가 없으면 로그아웃 처리
			await logout();
			return {
				success: false,
				error: error.message || '토큰 갱신에 실패했고, 재로그인할 정보가 없습니다.'
			};
		}
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
	
	// 전화번호 쿠키 삭제
	eraseCookie('admin_phone');
	
	// 관리자 페이지 메인으로 리다이렉트
	if (typeof window !== 'undefined') {
		goto(`${base}/`);
	}
}

// 토큰 모니터링 인터벌 ID
let tokenMonitorInterval = null;

/**
 * 토큰 모니터링 시작
 */
function startTokenMonitoring() {
	if (typeof window === 'undefined' || isLoggingOut) return;
	
	// 기존 인터벌 정리
	if (tokenMonitorInterval) {
		clearInterval(tokenMonitorInterval);
	}
	
	// 30초마다 토큰 상태 체크
	tokenMonitorInterval = setInterval(async () => {
		const token = getAccessToken();
		if (!token || isLoggingOut) return;
		
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
	isLoggingOut = false; // 로그인 시도 시 로그아웃 상태 해제
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
	if (isLoggingOut) return;
	isLoggingOut = true;

	// 토큰 모니터링 중지
	stopTokenMonitoring();
	
	// 기존 로그아웃 로직 실행
	await baseLogout();

	// isLoggingOut 플래그는 페이지 전환 후 초기화되므로 별도 리셋 불필요
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
	const existingToken = localStorage.getItem('admin_access_token');
	if (existingToken) {
		// 토큰 유효성 확인 후 모니터링 시작
		const tokenStatus = analyzeTokenStatus(existingToken);
		if (tokenStatus.isValid) {
			startTokenMonitoring();
		}
	}
}
