<script lang="ts">
	import { ROW_SELECTION_STYLES } from '../../utils/row-selection';

	let {
		index,
		selected,
		sizeClass = 'px-2 py-1.5',
		onmousedown
	}: {
		index: number;
		selected: boolean;
		sizeClass?: string;
		onmousedown: (e: MouseEvent) => void;
	} = $props();
</script>

<td
	class="border border-[var(--color-app-border)] {selected
		? ROW_SELECTION_STYLES.rowNumber
		: 'bg-[var(--color-app-surface-secondary)]'} {sizeClass} cursor-pointer select-none text-right hover:bg-[var(--color-app-surface-hover)]"
	role="button"
	tabindex="-1"
	onmousedown={onmousedown}
	title="Click to select, Shift+click for range, Ctrl/Cmd+click to toggle">{index}</td>
