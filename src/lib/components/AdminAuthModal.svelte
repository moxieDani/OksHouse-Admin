<script>
	import { createEventDispatcher } from 'svelte';
	import { verifyPhoneAndLogin, isLoading } from '../stores/auth.js';
	
	export let show = false;
	
	const dispatch = createEventDispatcher();
	
	let phone = '';
	let error = '';
	let isSubmitting = false;
	
	// Close modal
	function closeModal() {
		show = false;
		phone = '';
		error = '';
		dispatch('close');
	}
	
	// Handle phone input formatting
	function formatPhoneNumber(input) {
		// Remove all non-digits
		const digits = input.replace(/\D/g, '');
		
		// Format as XXX-XXXX-XXXX
		if (digits.length <= 3) {
			return digits;
		} else if (digits.length <= 7) {
			return `${digits.slice(0, 3)}-${digits.slice(3)}`;
		} else {
			return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
		}
	}
	
	function handlePhoneInput(event) {
		phone = formatPhoneNumber(event.target.value);
	}
	
	// Submit phone verification
	async function handleSubmit() {
		if (!phone.trim()) {
			error = '전화번호를 입력해주세요.';
			return;
		}
		
		// Validate phone number format
		const phoneRegex = /^010-\d{4}-\d{4}$/;
		if (!phoneRegex.test(phone)) {
			error = '올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)';
			return;
		}
		
		isSubmitting = true;
		error = '';
		
		try {
			const result = await verifyPhoneAndLogin(phone);
			
			if (result.success) {
				dispatch('success', {
					admin: result.admin
				});
				closeModal();
			} else {
				error = result.error || '인증에 실패했습니다.';
			}
		} catch (err) {
			error = '인증 중 오류가 발생했습니다.';
			console.error('Auth error:', err);
		} finally {
			isSubmitting = false;
		}
	}
	
	// Handle Enter key
	function handleKeydown(event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSubmit();
		}
	}
	
	// Handle backdrop click
	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
</script>

{#if show}
	<div class="auth-modal-backdrop" on:click={handleBackdropClick} role="presentation">
		<div class="auth-modal">
			<div class="modal-header">
				<h2>🔐 관리자 인증</h2>
				<button class="close-button" on:click={closeModal} aria-label="닫기">×</button>
			</div>
			
			<div class="modal-body">
				<p class="auth-description">
					관리자 페이지에 접근하려면 등록된 전화번호를 입력해주세요.
				</p>
				
				<form on:submit|preventDefault={handleSubmit}>
					<div class="input-group">
						<label for="phone">전화번호</label>
						<input
							id="phone"
							type="tel"
							bind:value={phone}
							on:input={handlePhoneInput}
							on:keydown={handleKeydown}
							placeholder="010-1234-5678"
							maxlength="13"
							disabled={isSubmitting || $isLoading}
							autocomplete="tel"
							class:error={error}
						/>
					</div>
					
					{#if error}
						<div class="error-message">
							❌ {error}
						</div>
					{/if}
					
					<div class="button-group">
						<button
							type="button"
							class="cancel-button"
							on:click={closeModal}
							disabled={isSubmitting || $isLoading}
						>
							취소
						</button>
						<button
							type="submit"
							class="submit-button"
							disabled={isSubmitting || $isLoading || !phone.trim()}
						>
							{#if isSubmitting || $isLoading}
								<span class="loading-spinner"></span>
								인증 중...
							{:else}
								인증하기
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.auth-modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}
	
	.auth-modal {
		background: white;
		border-radius: 16px;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
		max-width: 420px;
		width: 90%;
		max-height: 90vh;
		overflow: auto;
		animation: modalSlideIn 0.3s ease-out;
	}
	
	@keyframes modalSlideIn {
		from {
			opacity: 0;
			transform: translateY(-20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 24px 16px;
		border-bottom: 1px solid #e5e7eb;
	}
	
	.modal-header h2 {
		font-size: 20px;
		font-weight: 600;
		color: #1f2937;
		margin: 0;
	}
	
	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		color: #6b7280;
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
		transition: all 0.2s;
	}
	
	.close-button:hover {
		background-color: #f3f4f6;
		color: #374151;
	}
	
	.modal-body {
		padding: 24px;
	}
	
	.auth-description {
		color: #6b7280;
		margin-bottom: 24px;
		line-height: 1.5;
		text-align: center;
	}
	
	.input-group {
		margin-bottom: 20px;
	}
	
	.input-group label {
		display: block;
		margin-bottom: 8px;
		font-weight: 500;
		color: #374151;
		font-size: 14px;
	}
	
	.input-group input {
		width: 100%;
		padding: 12px 16px;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		font-size: 16px;
		transition: all 0.2s;
		background-color: white;
	}
	
	.input-group input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}
	
	.input-group input:disabled {
		background-color: #f9fafb;
		cursor: not-allowed;
	}
	
	.input-group input.error {
		border-color: #ef4444;
		box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
	}
	
	.error-message {
		color: #ef4444;
		font-size: 14px;
		margin-top: 8px;
		margin-bottom: 16px;
		padding: 8px 12px;
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
	}
	
	.button-group {
		display: flex;
		gap: 12px;
	}
	
	.cancel-button,
	.submit-button {
		flex: 1;
		padding: 12px 20px;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 500;
		transition: all 0.2s;
		cursor: pointer;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}
	
	.cancel-button {
		background-color: #f3f4f6;
		color: #6b7280;
	}
	
	.cancel-button:hover:not(:disabled) {
		background-color: #e5e7eb;
		color: #374151;
	}
	
	.submit-button {
		background-color: #3b82f6;
		color: white;
	}
	
	.submit-button:hover:not(:disabled) {
		background-color: #2563eb;
	}
	
	.submit-button:disabled {
		background-color: #9ca3af;
		cursor: not-allowed;
	}
	
	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid transparent;
		border-top: 2px solid currentColor;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	
	/* Mobile responsiveness */
	@media (max-width: 480px) {
		.auth-modal {
			max-width: 95%;
			margin: 20px;
		}
		
		.modal-header,
		.modal-body {
			padding: 20px;
		}
		
		.button-group {
			flex-direction: column;
		}
		
		.cancel-button,
		.submit-button {
			flex: none;
		}
	}
</style>