// Firebase 설정
const firebaseConfig = {
	apiKey: "AIzaSyCFUztWmjyDED4ekZx10D3MfQMe2_Qd7q8",
	authDomain: "okshouse.firebaseapp.com",
	projectId: "okshouse",
	storageBucket: "okshouse.firebasestorage.app",
	messagingSenderId: "504348350758",
	appId: "1:504348350758:web:8872c81f802d0a45d0c9e7",
	measurementId: "G-G25N0MDNEB"
};

// Firebase 앱과 메시징 인스턴스 (브라우저에서만 초기화)
let app = null;
let messaging = null;

// 브라우저 환경에서만 Firebase 초기화
async function initializeFirebaseApp() {
	if (typeof window === 'undefined') return null;
	
	if (!app) {
		const { initializeApp } = await import('firebase/app');
		app = initializeApp(firebaseConfig);
	}
	
	return app;
}

/**
 * FCM 초기화 (브라우저 환경에서만)
 */
export async function initializeFCM() {
	if (typeof window === 'undefined') return null;
	
	try {
		const firebaseApp = await initializeFirebaseApp();
		if (!firebaseApp) return null;
		
		const { getMessaging } = await import('firebase/messaging');
		messaging = getMessaging(firebaseApp);
		return messaging;
	} catch (error) {
		console.error('FCM 초기화 실패:', error);
		return null;
	}
}

/**
 * FCM 토큰 요청
 */
export async function requestFCMToken() {
	if (typeof window === 'undefined') {
		throw new Error('브라우저 환경이 아닙니다');
	}
	
	try {
		// FCM 초기화
		if (!messaging) {
			messaging = await initializeFCM();
		}
		
		if (!messaging) {
			throw new Error('FCM이 초기화되지 않았습니다');
		}
		// console.log('초기화:', messaging);
		
		// 현재 알림 권한 확인
		let permission = Notification.permission;
		// console.log('현재 알림 권한:', permission);

		// 권한이 'default'일 경우에만 요청
		if (permission === 'default') {
			permission = await Notification.requestPermission();
			// console.log('요청 후 알림 권한:', permission);
		}
		
		if (permission !== 'granted') {
			throw new Error('알림 권한이 거부되었습니다');
		}
		
		// FCM 토큰 획득
		const { getToken } = await import('firebase/messaging');
		// 실제 운영에서는 Firebase 콘솔에서 생성된 VAPID 키를 사용해야 함
		const token = await getToken(messaging, {vapidKey: import.meta.env.VITE_FCM_VAPID_KEY});
		
		if (!token) {
			throw new Error('FCM 토큰을 받을 수 없습니다');
		}
		
		// console.log('FCM 토큰 획득:', token);
		return token;
		
	} catch (error) {
		console.error('FCM 토큰 요청 실패:', error);
		throw error;
	}
}

/**
 * 포그라운드 메시지 리스너 설정
 */
export async function setupFCMListener(onMessageReceived) {
	if (typeof window === 'undefined') return;
	
	try {
		// FCM 초기화
		if (!messaging) {
			messaging = await initializeFCM();
		}
		
		if (!messaging) {
			console.error('FCM이 초기화되지 않았습니다');
			return;
		}
		
		// 앱이 포그라운드에 있을 때 메시지 수신
		const { onMessage } = await import('firebase/messaging');
		onMessage(messaging, (payload) => {
			console.log('포그라운드 메시지 수신:', payload);
			
			// 커스텀 알림 표시
			if (payload.notification) {
				showCustomNotification(payload.notification, payload.data);
			}
			
			// 콜백 함수 실행
			if (onMessageReceived) {
				onMessageReceived(payload);
			}
		});
	} catch (error) {
		console.error('FCM 리스너 설정 실패:', error);
	}
}

/**
 * 커스텀 알림 표시
 */
export function showCustomNotification(notification, data = {}) {
	// 브라우저 알림 표시
	if (Notification.permission === 'granted') {
		const notificationOptions = {
			body: notification.body,
			icon: '/icons/icon-192x192.png',
			badge: '/icons/badge-72x72.png',
			tag: 'okshouse-reservation-' + Date.now(),
			renotify: true,
			data: data
		};
		
		const notif = new Notification(notification.title, notificationOptions);
		
		// 알림 클릭 이벤트
		notif.onclick = function(event) {
			event.preventDefault();
			
			// 관리자 페이지로 이동
			if (data.click_action) {
				window.open(data.click_action, '_blank');
			} else {
				window.focus();
			}
			
			notif.close();
		};
		
		// 5초 후 자동 닫기
		setTimeout(() => {
			notif.close();
		}, 5000);
	}
}

/**
 * FCM 지원 여부 확인
 */
export function isFCMSupported() {
	return typeof window !== 'undefined' && 
		   'serviceWorker' in navigator && 
		   'Notification' in window &&
		   'PushManager' in window;
}