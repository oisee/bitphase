<script lang="ts">
	import Card from '../Card/Card.svelte';
	import FluffPresetControls from './FluffPresetControls.svelte';
	import FluffRoutingDiagram from './FluffRoutingDiagram.svelte';
	import ClipList from './ClipList.svelte';
	import IconCarbonShuffle from '~icons/carbon/shuffle';
	import IconCarbonConnectionSignal from '~icons/carbon/connection-signal';
	import IconCarbonMediaLibrary from '~icons/carbon/media-library';
	import { fluffEditorStore } from '../../stores/fluff-editor.svelte';
</script>

<div class="flex h-full flex-col gap-3 overflow-auto p-4">
	<Card title="Fluff Transform" icon={IconCarbonShuffle} class="flex w-full flex-col gap-2 p-3">
		<FluffPresetControls />
	</Card>

	<Card title="Routing" icon={IconCarbonConnectionSignal} class="w-full p-3">
		<FluffRoutingDiagram patterns={fluffEditorStore.currentPatterns} />
	</Card>

	<Card title="Clips" icon={IconCarbonMediaLibrary} class="flex w-full flex-col gap-2 p-3">
		<ClipList />
	</Card>
</div>
