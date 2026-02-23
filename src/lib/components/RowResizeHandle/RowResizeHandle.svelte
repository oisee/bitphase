<script lang="ts">
	import IconCarbonArrowsVertical from '~icons/carbon/arrows-vertical';

	let {
		rowCount,
		onRowCountChange,
		rowHeightPx = 32,
		maxRows = 512
	}: {
		rowCount: number;
		onRowCountChange: (count: number) => void;
		rowHeightPx?: number;
		maxRows?: number;
	} = $props();

	let isResizingRows = $state(false);
	let resizeStartY = $state(0);
	let resizeStartCount = $state(0);

	function beginRowResize(e: MouseEvent) {
		e.preventDefault();
		isResizingRows = true;
		resizeStartY = e.clientY;
		resizeStartCount = rowCount;
	}

	function handleRowResizeMove(e: MouseEvent) {
		if (!isResizingRows) return;
		const deltaY = e.clientY - resizeStartY;
		const deltaRows = Math.round(deltaY / rowHeightPx);
		const targetCount = Math.max(1, Math.min(maxRows, resizeStartCount + deltaRows));
		onRowCountChange(targetCount);
	}

	function endRowResize() {
		isResizingRows = false;
	}

	$effect(() => {
		if (!isResizingRows) return;
		const onMove = (e: MouseEvent) => handleRowResizeMove(e);
		const onUp = () => endRowResize();
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		return () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
	});
</script>

<div
	class="flex cursor-ns-resize items-center justify-center gap-1 py-1 text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)] {isResizingRows
		? 'bg-[var(--color-app-surface-hover)]'
		: ''}"
	role="button"
	tabindex="0"
	aria-label="Drag to add or remove rows"
	title="Drag to add or remove rows"
	onmousedown={beginRowResize}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
		}
	}}>
	<IconCarbonArrowsVertical class="h-3 w-3" />
	<span class="text-[0.65rem]">{rowCount} {rowCount === 1 ? 'row' : 'rows'}</span>
</div>
