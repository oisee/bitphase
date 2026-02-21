<script lang="ts">
	import { tick } from 'svelte';
	import MenuPanel from './MenuPanel.svelte';
	import type { MenuItem } from './types';

	let {
		position,
		items,
		onAction,
		onClose
	}: {
		position: { x: number; y: number } | null;
		items: MenuItem[];
		onAction?: (data: { action: string }) => void;
		onClose?: () => void;
	} = $props();

	let menuEl = $state<HTMLDivElement | undefined>(undefined);
	let renderUpward = $state(false);

	$effect(() => {
		if (!position) {
			renderUpward = false;
			return;
		}
		renderUpward = false;
		tick().then(() => {
			if (!menuEl) return;
			const rect = menuEl.getBoundingClientRect();
			if (rect.bottom > window.innerHeight) {
				renderUpward = true;
			} else if (rect.top < 0) {
				renderUpward = false;
			}
		});
	});

	function handleClose(): void {
		onClose?.();
	}
</script>

{#if position}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40"
		onclick={handleClose}
		oncontextmenu={(e) => {
			e.preventDefault();
			handleClose();
		}}>
	</div>
	<div
		bind:this={menuEl}
		class="fixed z-50"
		style="left: {position.x}px; top: {position.y}px; transform: {renderUpward
			? 'translateY(-100%)'
			: 'none'};">
		<MenuPanel
			isFirst={true}
			{items}
			{onAction}
			onMenuClose={handleClose} />
	</div>
{/if}
