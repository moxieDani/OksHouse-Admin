/**
 * 에러 처리 관련 유틸리티 함수들
 * 일관성 있는 에러 처리와 사용자 친화적인 메시지 제공
 */

// 에러 타입 정의
export const ERROR_TYPES = {
	NETWORK: 'NETWORK',
	VALIDATION: 'VALIDATION', 
	AUTHENTICATION: 'AUTHENTICATION',
	AUTHORIZATION: 'AUTHORIZATION',
	NOT_FOUND: 'NOT_FOUND',
	SERVER: 'SERVER',
	UNKNOWN: 'UNKNOWN'
};

// 기본 에러 메시지
export const DEFAULT_ERROR_MESSAGES = {
	[ERROR_TYPES.NETWORK]: '네트워크 연결을 확인해주세요.',
	[ERROR_TYPES.VALIDATION]: '입력하신 정보를 다시 확인해주세요.',
	[ERROR_TYPES.AUTHENTICATION]: '인증에 실패했습니다. 정보를 다시 확인해주세요.',
	[ERROR_TYPES.AUTHORIZATION]: '접근 권한이 없습니다.',
	[ERROR_TYPES.NOT_FOUND]: '요청하신 정보를 찾을 수 없습니다.',
	[ERROR_TYPES.SERVER]: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
	[ERROR_TYPES.UNKNOWN]: '알 수 없는 오류가 발생했습니다.'
};

/**
 * HTTP 상태 코드를 기반으로 에러 타입 결정
 * @param {number} status - HTTP 상태 코드
 * @returns {string} 에러 타입
 */
export function getErrorTypeFromStatus(status) {
	if (status >= 500) return ERROR_TYPES.SERVER;
	if (status === 404) return ERROR_TYPES.NOT_FOUND;
	if (status === 403) return ERROR_TYPES.AUTHORIZATION;
	if (status === 401) return ERROR_TYPES.AUTHENTICATION;
	if (status >= 400) return ERROR_TYPES.VALIDATION;
	return ERROR_TYPES.UNKNOWN;
}

/**
 * 에러 객체에서 사용자 친화적인 메시지 추출
 * @param {Error | Object} error - 에러 객체
 * @param {string} context - 에러 발생 컨텍스트
 * @returns {{type: string, message: string, originalError: any}} 처리된 에러 정보
 */
export function parseError(error, context = '') {
	let errorType = ERROR_TYPES.UNKNOWN;
	let userMessage = DEFAULT_ERROR_MESSAGES[ERROR_TYPES.UNKNOWN];
	
	// 네트워크 에러 확인
	if (!navigator.onLine) {
		errorType = ERROR_TYPES.NETWORK;
		userMessage = DEFAULT_ERROR_MESSAGES[ERROR_TYPES.NETWORK];
	}
	// HTTP 응답 에러
	else if (error?.response?.status) {
		errorType = getErrorTypeFromStatus(error.response.status);
		userMessage = error.response.data?.message || DEFAULT_ERROR_MESSAGES[errorType];
	}
	// Fetch API 에러
	else if (error?.status) {
		errorType = getErrorTypeFromStatus(error.status);
		userMessage = error.message || DEFAULT_ERROR_MESSAGES[errorType];
	}
	// 일반 에러 객체
	else if (error instanceof Error) {
		// TypeError는 주로 네트워크 관련
		if (error.name === 'TypeError' && error.message.includes('fetch')) {
			errorType = ERROR_TYPES.NETWORK;
			userMessage = DEFAULT_ERROR_MESSAGES[ERROR_TYPES.NETWORK];
		} else {
			userMessage = error.message || DEFAULT_ERROR_MESSAGES[ERROR_TYPES.UNKNOWN];
		}
	}
	// 문자열 에러
	else if (typeof error === 'string') {
		userMessage = error;
	}
	
	// 컨텍스트가 있으면 메시지에 포함
	if (context) {
		userMessage = `${context}: ${userMessage}`;
	}
	
	return {
		type: errorType,
		message: userMessage,
		originalError: error
	};
}

/**
 * 에러를 로깅하고 사용자에게 표시
 * @param {Error | Object} error - 에러 객체
 * @param {string} context - 에러 발생 컨텍스트
 * @param {Function} showAlertFn - 알림 표시 함수
 */
export function handleError(error, context = '', showAlertFn) {
	const parsedError = parseError(error, context);
	
	// 개발 환경에서는 상세 로깅
	if (process.env.NODE_ENV === 'development') {
		console.group(`🚨 Error in ${context || 'Unknown Context'}`);
		console.error('Original Error:', parsedError.originalError);
		console.error('Error Type:', parsedError.type);
		console.error('User Message:', parsedError.message);
		console.groupEnd();
	} else {
		// 프로덕션에서는 간단한 로깅
		console.error(`Error in ${context}:`, parsedError.message);
	}
	
	// 사용자에게 알림 표시
	if (showAlertFn) {
		showAlertFn(parsedError.message, 'error');
	}
	
	return parsedError;
}

/**
 * 비동기 함수 실행 시 에러 처리를 자동화하는 래퍼
 * @param {Function} asyncFn - 실행할 비동기 함수
 * @param {string} context - 에러 발생 컨텍스트
 * @param {Function} showAlertFn - 알림 표시 함수
 * @returns {Promise<any>} 실행 결과 또는 null (에러 시)
 */
export async function safeAsync(asyncFn, context = '', showAlertFn) {
	try {
		return await asyncFn();
	} catch (error) {
		handleError(error, context, showAlertFn);
		return null;
	}
}

/**
 * 재시도 로직이 포함된 비동기 함수 실행
 * @param {Function} asyncFn - 실행할 비동기 함수
 * @param {Object} options - 옵션
 * @param {number} options.maxRetries - 최대 재시도 횟수
 * @param {number} options.delay - 재시도 간격 (ms)
 * @param {string} options.context - 에러 발생 컨텍스트
 * @param {Function} options.showAlertFn - 알림 표시 함수
 * @returns {Promise<any>} 실행 결과 또는 null (실패 시)
 */
export async function retryAsync(asyncFn, options = {}) {
	const {
		maxRetries = 3,
		delay = 1000,
		context = '',
		showAlertFn
	} = options;
	
	let lastError;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await asyncFn();
		} catch (error) {
			lastError = error;
			
			if (attempt === maxRetries) {
				// 마지막 시도 실패 시 에러 처리
				handleError(error, `${context} (${maxRetries}회 재시도 후 실패)`, showAlertFn);
				return null;
			}
			
			// 재시도 전 대기
			await new Promise(resolve => setTimeout(resolve, delay * attempt));
		}
	}
	
	return null;
}

/**
 * FeedbackManager용 에러 피드백 표시 함수
 * @param {Object} feedbackManager - 피드백 매니저 객체
 * @param {string} title - 에러 제목
 * @param {string} message - 에러 메시지
 */
export function showErrorFeedback(feedbackManager, title, message) {
	feedbackManager.type = 'error';
	feedbackManager.title = title;
	feedbackManager.message = message;
	feedbackManager.show = true;
}

/**
 * FeedbackManager용 성공 피드백 표시 함수
 * @param {Object} feedbackManager - 피드백 매니저 객체
 * @param {string} title - 성공 제목
 * @param {string} message - 성공 메시지
 */
export function showSuccessFeedback(feedbackManager, title, message) {
	feedbackManager.type = 'success';
	feedbackManager.title = title;
	feedbackManager.message = message;
	feedbackManager.show = true;
}