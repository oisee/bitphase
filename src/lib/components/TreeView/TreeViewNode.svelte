<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { TreeNode } from './types';
	import IconCarbonChevronRight from '~icons/carbon/chevron-right';
	import IconCarbonChevronDown from '~icons/carbon/chevron-down';
	import TreeView from './TreeView.svelte';

	let {
		node,
		depth = 0,
		expandedIds,
		onToggle,
		selectedId,
		onSelect,
		content,
		defaultCollapsed
	}: {
		node: TreeNode<unknown>;
		depth?: number;
		expandedIds: Set<string>;
		onToggle: (id: string) => void;
		selectedId?: string | null;
		onSelect?: (node: TreeNode<unknown>) => void;
		content?: Snippet<[TreeNode<unknown>, number, boolean, boolean]>;
		defaultCollapsed?: boolean;
	} = $props();

	const INDENT_PX = 16;
	const hasKids = $derived(Array.isArray(node.children) && node.children.length > 0);
	const isExp = $derived(expandedIds.has(node.id));

	function handleRowClick(): void {
		if (hasKids) {
			onToggle(node.id);
		} else {
			onSelect?.(node);
		}
	}
</script>

<div class="flex flex-col">
	<button
		type="button"
		class="flex w-full cursor-pointer items-center gap-1 border-l-2 py-1.5 pr-2 text-left transition-colors {depth === 0
			? 'pl-2'
			: 'pl-1'} {selectedId === node.id
			? 'border-l-[var(--color-app-primary)] bg-[var(--color-app-surface-active)]'
			: 'border-l-transparent hover:bg-[var(--color-app-surface-hover)]'}"
		style="padding-left: {depth * INDENT_PX + (depth === 0 ? 8 : 4)}px"
		onclick={handleRowClick}>
		{#if hasKids}
			<span class="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-app-text-muted)]">
				{#if isExp}
					<IconCarbonChevronDown class="h-3.5 w-3.5" />
				{:else}
					<IconCarbonChevronRight class="h-3.5 w-3.5" />
				{/if}
			</span>
		{:else}
			<span class="h-4 w-4 shrink-0"></span>
		{/if}
		{#if content}
			{@render content(node, depth, isExp, hasKids)}
		{:else}
			<span class="min-w-0 truncate text-xs text-[var(--color-app-text-primary)]">
				{node.label}
			</span>
		{/if}
	</button>
	{#if hasKids && isExp}
		<div class="flex flex-col">
			<TreeView
				nodes={node.children ?? []}
				{defaultCollapsed}
				{selectedId}
				{onSelect}
				{content}
				depth={depth + 1}
				expandedIds={expandedIds}
				{onToggle} />
		</div>
	{/if}
</div>
