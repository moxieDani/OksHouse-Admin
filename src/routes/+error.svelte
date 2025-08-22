<script>
	import { page } from '$app/stores';
	
	// params prop을 받아서 경고 제거
	export let params = {};
</script>

<svelte:head>
	<title>오류 - Ok's House 관리 시스템</title>
</svelte:head>

<div class="error-page">
	<div class="error-content">
		<h1>{$page.status}</h1>
		<h2>페이지를 찾을 수 없습니다</h2>
		<p>{$page.error?.message || '요청하신 페이지가 존재하지 않습니다.'}</p>
		
		<div class="actions">
			<a href="/admin" class="btn btn-primary">관리자 선택으로 돌아가기</a>
		</div>
	</div>
</div>

<style>
	.error-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
	}

	.error-content {
		text-align: center;
		max-width: 500px;
	}

	h1 {
		font-size: 6rem;
		font-weight: 800;
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
		-webkit-text-fill-color: transparent;
		margin-bottom: var(--space-4);
		line-height: 1;
	}

	h2 {
		font-size: var(--text-2xl);
		font-weight: 700;
		color: var(--neutral-800);
		margin-bottom: var(--space-4);
	}

	p {
		font-size: var(--text-lg);
		color: var(--neutral-600);
		margin-bottom: var(--space-8);
		line-height: 1.6;
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: var(--space-4);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-3) var(--space-6);
		border-radius: var(--radius-lg);
		font-size: var(--text-base);
		font-weight: 600;
		text-decoration: none;
		transition: var(--transition-all);
		border: none;
		cursor: pointer;
	}

	.btn-primary {
		background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
		color: white;
		box-shadow: var(--shadow-md);
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-lg);
	}

	.btn-primary:active {
		transform: translateY(0);
		box-shadow: var(--shadow-sm);
	}

	/* 모바일 대응 */
	@media (max-width: 640px) {
		h1 {
			font-size: 4rem;
		}

		h2 {
			font-size: var(--text-xl);
		}

		p {
			font-size: var(--text-base);
		}

		.actions {
			flex-direction: column;
			align-items: center;
		}

		.btn {
			width: 100%;
			max-width: 300px;
		}
	}
</style>