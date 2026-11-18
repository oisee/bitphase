<script lang="ts">
	import Button from '../Button/Button.svelte';
	import Checkbox from '../Checkbox/Checkbox.svelte';
	import { ModalPanel } from '../ModalPanel';

	let { resolve } = $props<{
		resolve?: (value?: { alphaOpaqueSilence: boolean }) => void;
	}>();

	let alphaOpaqueSilence = $state(false);
</script>

<ModalPanel title="Import options" width="w-[440px]" compact>
	{#snippet children()}
		<p class="mb-3 text-[var(--color-app-text-tertiary)]">
			This project stacks several virtual channels on one hardware channel.
		</p>
		<label class="flex cursor-pointer items-start gap-2 select-none">
			<Checkbox id="import-alpha-opaque" showStatus={false} bind:checked={alphaOpaqueSilence} />
			<span class="text-xs text-[var(--color-app-text-primary)]">
				Opaque silence (alpha F masks lower virtual channels even when silent)
			</span>
		</label>
		<p class="mt-2 text-xs text-[var(--color-app-text-muted)]">
			Off: the first sounding virtual channel wins (default). Can be changed later in Details, AY
			settings, "Opaque silence".
		</p>
	{/snippet}

	{#snippet footer()}
		<Button variant="primary" onclick={() => resolve?.({ alphaOpaqueSilence })}>Import</Button>
	{/snippet}
</ModalPanel>
