<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { TreeNode } from './types';
	import TreeViewNode from './TreeViewNode.svelte';

	let {
		nodes,
		defaultCollapsed = true,
		selectedId = null,
		onSelect,
		content,
		depth = 0,
		expandedIds: expandedIdsProp,
		onToggle
	}: {
		nodes: TreeNode<unknown>[];
		defaultCollapsed?: boolean;
		selectedId?: string | null;
		onSelect?: (node: TreeNode<unknown>) => void;
		content?: Snippet<[TreeNode<unknown>, number, boolean, boolean]>;
		depth?: number;
		expandedIds?: Set<string>;
		onToggle?: (id: string) => void;
	} = $props();

	let localExpanded = $state(new Set<string>());
	const expanded = $derived(expandedIdsProp ?? localExpanded);

	function childOnToggle(id: string): void {
		const next = new Set(expanded);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		if (onToggle) {
			onToggle(id);
		} else {
			localExpanded = next;
		}
	}

	const effectiveOnToggle = $derived(onToggle ?? childOnToggle);
</script>

{#each nodes as node}
	<TreeViewNode
		{node}
		{depth}
		expandedIds={expanded}
		onToggle={effectiveOnToggle}
		{selectedId}
		{onSelect}
		{content}
		{defaultCollapsed} />
{/each}
