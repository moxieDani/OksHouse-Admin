/**
 * 예약 관련 상수 및 설정
 * 예약 상태, 필터 옵션, 액션 텍스트 등을 관리합니다.
 */

/**
 * 예약 상태 상수
 */
export const reservationStatuses = {
	PENDING: 'pending',
	CONFIRMED: 'confirmed',
	CANCELLED: 'cancelled',
	COMPLETED: 'completed',
	EXPIRED: 'expired'
};

/**
 * 예약 상태 한글 표시 텍스트
 */
export const statusDisplayText = {
	pending: '예약대기',
	confirmed: '예약확정',
	cancelled: '예약거절',
	completed: '이용완료',
	expired: '이용종료'
};

/**
 * 예약 상태별 색상 클래스
 */
export const statusColorClasses = {
	pending: 'status-pending',
	confirmed: 'status-confirmed',
	cancelled: 'status-cancelled',
	completed: 'status-completed',
	expired: 'status-expired'
};

/**
 * 필터 옵션 목록
 */
export const filterOptions = ['전체', '확정', '대기', '거절', '이용종료', '내 결정'];

/**
 * 기본 필터 설정
 */
export const defaultFilter = '전체';

/**
 * 상태 변경 액션 버튼 텍스트
 */
export const statusActionNames = {
	confirmed: '승인하기',
	pending: '대기하기',
	cancelled: '거절하기'
};

/**
 * 상태 변경 완료 메시지
 */
export const statusChangeMessages = {
	confirmed: '예약이 승인되었습니다.',
	pending: '예약이 대기 상태로 변경되었습니다.',
	cancelled: '예약이 거절되었습니다.'
};

/**
 * 상태 변경 제목
 */
export const statusChangeTitles = {
	confirmed: '예약 승인 완료',
	pending: '예약 대기 변경',
	cancelled: '예약 거절 완료'
};