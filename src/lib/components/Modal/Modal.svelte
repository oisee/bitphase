<script lang="ts">
	import type { Snippet } from 'svelte';
	import Portal from './Portal.svelte';

	let { onClose, children, isActive = true } = $props<{
		onClose?: () => void;
		children: Snippet;
		isActive?: boolean;
	}>();

	let modalElement: HTMLElement | null = $state(null);

	$effect(() => {
		if (modalElement && isActive) {
			modalElement.focus();
		}
	});

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose?.();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose?.();
			event.preventDefault();
		}
	}
</script>

<Portal>
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleKeyDown}>
		<div
			bind:this={modalElement}
			class="max-h-[90vh] max-w-[90vw] overflow-x-auto overflow-y-hidden rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-xs shadow-xl transition-transform duration-200"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					onClose?.();
					e.preventDefault();
				}
				e.stopPropagation();
			}}
			role="presentation"
			tabindex="-1"
			style="animation: slideUp 0.2s ease-out;">
			{@render children?.()}
		</div>
	</div>
</Portal>

<style>
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
