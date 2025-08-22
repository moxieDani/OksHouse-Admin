<script>
	import '../app.css';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	
	// SvelteKit이 자동으로 전달하는 params prop을 받아서 경고 제거
	export let params = {};

	// PWA 설치 프롬프트 상태
	let deferredPrompt = null;

	onMount(() => {
		if (browser) {
			// Service Worker 등록
			if ('serviceWorker' in navigator) {
				navigator.serviceWorker.register('/sw.js')
					.then(() => {
						// 성공시에는 로그 출력하지 않음
					})
					.catch((registrationError) => {
						console.log('SW registration failed: ', registrationError);
					});
			} else {
				console.log('Service Worker 지원 안됨');
			}

			// PWA 설치 프롬프트 이벤트 리스너
			window.addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				deferredPrompt = e;
			});

			// PWA 설치 완료 이벤트
			window.addEventListener('appinstalled', () => {
				// 설치 완료시에는 로그 출력하지 않음
			});
		}
	});

</script>

<main class="container">
	<slot />
</main>

