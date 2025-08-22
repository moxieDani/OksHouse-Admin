<script>
	import '../app.css';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	onMount(() => {
		if (browser) {
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

