// Firebase SDK import
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const SW_VERSION = "2.1"; // 서비스 워커 버전
console.log(`[Service Worker] Running version ${SW_VERSION}.`);

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

// Firebase 앱 초기화
firebase.initializeApp(firebaseConfig);

// FCM 메시징 인스턴스
const messaging = firebase.messaging();

// 모든 푸시 메시지를 여기서 처리
self.addEventListener('push', function(event) {
	console.log(`[Service Worker v${SW_VERSION}] Push Received.`);
	
	try {
		const payload = event.data.json();
		console.log(`[Service Worker v${SW_VERSION}] Push Payload: `, payload);

		// payload.data 에서 알림 정보를 가져옵니다.
		const notificationTitle = payload.data?.title || '새로운 알림';
		const notificationOptions = {
			body: payload.data?.body || '새로운 예약 알림이 있습니다.',
			icon: payload.data?.icon || '/OksHouse-Admin/icons/icon-192x192.png',
			badge: payload.data?.badge || '/OksHouse-Admin/icons/badge-72x72.png',
			tag: 'okshouse-reservation-' + Date.now(),
			renotify: true,
			data: payload.data || {},
			actions: [
				{
					action: 'view',
					title: '확인하기'
				},
				{
					action: 'close',
					title: '닫기'
				}
			]
		};

		event.waitUntil(self.registration.showNotification(notificationTitle, notificationOptions));
	} catch (error) {
		console.error(`[Service Worker v${SW_VERSION}] Error handling push event:`, error);
	}
});

// 알림 클릭 이벤트 처리
self.addEventListener('notificationclick', (event) => {
	console.log(`[Service Worker v${SW_VERSION}] Notification click received.`);
	
	event.notification.close();
	
	const clickAction = event.notification.data?.click_action || '/OksHouse-Admin/';

	if (event.action === 'view') {
		event.waitUntil(clients.openWindow(clickAction));
	} else if (event.action === 'close') {
		// 알림만 닫기
		return;
	} else {
		// 기본 클릭 동작
		event.waitUntil(clients.openWindow(clickAction));
	}
});
