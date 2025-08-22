// Firebase SDK import
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

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

// 백그라운드 메시지 처리
messaging.onBackgroundMessage((payload) => {
	// console.log('백그라운드 메시지 수신:', payload);
	
	const notificationTitle = payload.notification?.title || '새로운 알림';
	const notificationOptions = {
		body: payload.notification?.body || '새로운 예약 알림이 있습니다.',
		icon: '/icons/icon-192x192.png',
		badge: '/icons/badge-72x72.png',
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

	return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 이벤트 처리
self.addEventListener('notificationclick', (event) => {
	// console.log('알림 클릭:', event);
	
	event.notification.close();
	
	if (event.action === 'view') {
		// 관리자 페이지로 이동
		event.waitUntil(
			clients.openWindow('/')
		);
	} else if (event.action === 'close') {
		// 알림만 닫기
		return;
	} else {
		// 기본 클릭 동작 - 관리자 페이지로 이동
		event.waitUntil(
			clients.openWindow('/')
		);
	}
});