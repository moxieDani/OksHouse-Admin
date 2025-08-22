<script>
	import { createEventDispatcher } from 'svelte';
	
	const dispatch = createEventDispatcher();
	
	export let show = false;
	export let type = 'info'; // 'success', 'error', 'warning', 'info', 'confirm'
	export let title = '';
	export let message = '';
	export let onClose = null;
	export let onConfirm = null;
	export let onCancel = null;

	const typeConfig = {
		success: { icon: '✅', color: '#059669' },
		error: { icon: '❌', color: '#dc2626' },
		warning: { icon: '⚠️', color: '#d97706' },
		info: { icon: 'ℹ️', color: '#4338ca' },
		confirm: { icon: '❓', color: '#d97706' }
	};

	function handleClose() {
		show = false;
		if (onClose) onClose();
		dispatch('close');
	}

	function handleConfirm() {
		show = false;
		if (onConfirm) onConfirm();
		dispatch('confirm');
	}

	function handleCancel() {
		show = false;
		if (onCancel) onCancel();
		dispatch('cancel');
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') {
			if (type === 'confirm') {
				handleCancel();
			} else {
				handleClose();
			}
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
	<div 
		class="feedback-modal feedback-modal-{type}"
		role="dialog" 
		aria-modal="true"
		aria-labelledby="modal-title"
		aria-describedby="modal-message"
	>
		<div 
			class="feedback-modal-backdrop" 
			on:click={type === 'confirm' ? handleCancel : handleClose}
			role="presentation"
		></div>
		
		<div class="feedback-modal-content">
			<div class="feedback-modal-header">
				<div class="feedback-modal-icon" style="color: {typeConfig[type]?.color}">
					{typeConfig[type]?.icon}
				</div>
				<h3 class="feedback-modal-title" id="modal-title">{title}</h3>
			</div>
			
			<div class="feedback-modal-body">
				<p class="feedback-modal-message" id="modal-message">
					{@html message.replace(/\n/g, '<br>')}
				</p>
			</div>
			
			<div class="feedback-modal-footer {type === 'confirm' ? 'feedback-modal-footer-confirm' : ''}">
				{#if type === 'confirm'}
					<button class="feedback-modal-btn feedback-modal-btn-cancel" on:click={handleCancel}>
						취소
					</button>
					<button class="feedback-modal-btn feedback-modal-btn-confirm" on:click={handleConfirm}>
						확인
					</button>
				{:else}
					<button class="feedback-modal-btn feedback-modal-btn-{type}" on:click={handleClose}>
						확인
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.feedback-modal {
		position: fixed !important;
		top: 0 !important;
		left: 0 !important;
		right: 0 !important;
		bottom: 0 !important;
		z-index: 999999 !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		padding: 20px !important;
		animation: fadeIn 0.3s ease !important;
	}

	.feedback-modal-backdrop {
		position: absolute !important;
		top: 0 !important;
		left: 0 !important;
		right: 0 !important;
		bottom: 0 !important;
		background: rgba(0, 0, 0, 0.7) !important;
		backdrop-filter: blur(4px) !important;
		z-index: 1 !important;
	}

	.feedback-modal-content {
		position: relative !important;
		background: white !important;
		border-radius: 20px !important;
		max-width: 450px !important;
		width: 100% !important;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4) !important;
		animation: slideUp 0.3s ease !important;
		z-index: 10 !important;
		border: 2px solid rgba(255, 255, 255, 0.8) !important;
	}

	.feedback-modal-header {
		padding: 30px 30px 20px !important;
		text-align: center !important;
		border-bottom: 1px solid #f1f5f9 !important;
	}

	.feedback-modal-icon {
		font-size: 3.5rem !important;
		margin-bottom: 20px !important;
		line-height: 1 !important;
	}

	.feedback-modal-title {
		font-size: 1.5rem !important;
		font-weight: 600 !important;
		margin: 0 !important;
		color: #1e293b !important;
		line-height: 1.3 !important;
	}

	.feedback-modal-body {
		padding: 20px 30px 30px !important;
		text-align: center !important;
	}

	.feedback-modal-message {
		font-size: 1.125rem !important;
		color: #475569 !important;
		margin: 0 !important;
		line-height: 1.6 !important;
	}

	.feedback-modal-footer {
		padding: 0 30px 30px !important;
		text-align: center !important;
	}

	.feedback-modal-footer-confirm {
		display: flex !important;
		gap: 12px !important;
		justify-content: center !important;
	}

	.feedback-modal-btn {
		color: white !important;
		border: none !important;
		border-radius: 12px !important;
		padding: 16px 32px !important;
		font-size: 1.125rem !important;
		font-weight: 600 !important;
		cursor: pointer !important;
		transition: all 0.2s ease !important;
		min-width: 120px !important;
		font-family: inherit !important;
	}

	.feedback-modal-btn:hover {
		transform: translateY(-2px) !important;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3) !important;
	}

	.feedback-modal-btn:active {
		transform: translateY(0) !important;
	}

	.feedback-modal-btn-success {
		background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
	}

	.feedback-modal-btn-success:hover {
		background: linear-gradient(135deg, #047857 0%, #059669 100%) !important;
		box-shadow: 0 10px 25px rgba(5, 150, 105, 0.4) !important;
	}

	.feedback-modal-btn-error {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
	}

	.feedback-modal-btn-error:hover {
		background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%) !important;
		box-shadow: 0 10px 25px rgba(220, 38, 38, 0.4) !important;
	}

	.feedback-modal-btn-warning {
		background: linear-gradient(135deg, #d97706 0%, #b45309 100%) !important;
	}

	.feedback-modal-btn-warning:hover {
		background: linear-gradient(135deg, #b45309 0%, #d97706 100%) !important;
		box-shadow: 0 10px 25px rgba(217, 119, 6, 0.4) !important;
	}

	.feedback-modal-btn-info {
		background: linear-gradient(135deg, #4338ca 0%, #312e81 100%) !important;
	}

	.feedback-modal-btn-info:hover {
		background: linear-gradient(135deg, #312e81 0%, #4338ca 100%) !important;
		box-shadow: 0 10px 25px rgba(67, 56, 202, 0.4) !important;
	}

	.feedback-modal-btn-cancel {
		background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%) !important;
		flex: 1 !important;
		max-width: 120px !important;
	}

	.feedback-modal-btn-cancel:hover {
		background: linear-gradient(135deg, #4b5563 0%, #374151 100%) !important;
		box-shadow: 0 10px 25px rgba(107, 114, 128, 0.4) !important;
	}

	.feedback-modal-btn-confirm {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
		flex: 1 !important;
		max-width: 120px !important;
	}

	.feedback-modal-btn-confirm:hover {
		background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%) !important;
		box-shadow: 0 10px 25px rgba(220, 38, 38, 0.4) !important;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(30px) scale(0.9);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (max-width: 480px) {
		.feedback-modal {
			padding: 10px !important;
		}

		.feedback-modal-content {
			max-width: 95% !important;
		}

		.feedback-modal-header {
			padding: 20px 20px 15px !important;
		}

		.feedback-modal-icon {
			font-size: 3rem !important;
		}

		.feedback-modal-title {
			font-size: 1.25rem !important;
		}

		.feedback-modal-body {
			padding: 15px 20px 20px !important;
		}

		.feedback-modal-footer {
			padding: 0 20px 20px !important;
		}

		.feedback-modal-footer-confirm {
			flex-direction: column !important;
		}

		.feedback-modal-btn {
			padding: 14px 24px !important;
			font-size: 1rem !important;
		}

		.feedback-modal-btn-cancel,
		.feedback-modal-btn-confirm {
			max-width: none !important;
		}
	}
</style>