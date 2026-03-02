<script lang="ts">
	import type { FluffPattern } from '../../fluff/fluff-pattern';
	import type { ChannelKey } from '../../fluff/chip-frame';

	let { patterns }: { patterns: FluffPattern[] } = $props();

	const CHANNEL_LABELS: { key: ChannelKey; label: string; color: string }[] = [
		{ key: 'a', label: 'A', color: 'var(--color-channel-a, #e06c75)' },
		{ key: 'b', label: 'B', color: 'var(--color-channel-b, #61afef)' },
		{ key: 'c', label: 'C', color: 'var(--color-channel-c, #98c379)' },
		{ key: 'e', label: 'E', color: 'var(--color-channel-e, #c678dd)' },
		{ key: 'n', label: 'N', color: 'var(--color-channel-n, #d19a66)' }
	];

	const WIDTH = 240;
	const HEIGHT = 120;
	const LEFT_X = 40;
	const RIGHT_X = WIDTH - 40;
	const Y_START = 12;
	const Y_STEP = 22;

	interface Routing {
		source: ChannelKey;
		sh: number;
		dup: boolean;
		skip: boolean;
	}

	const routings = $derived.by((): Record<ChannelKey, Routing> => {
		const identity: Record<ChannelKey, Routing> = {
			a: { source: 'a', sh: 0, dup: false, skip: false },
			b: { source: 'b', sh: 0, dup: false, skip: false },
			c: { source: 'c', sh: 0, dup: false, skip: false },
			e: { source: 'e', sh: 0, dup: false, skip: false },
			n: { source: 'n', sh: 0, dup: false, skip: false }
		};

		if (patterns.length === 0) return identity;
		const pat = patterns[0];
		if (!pat.fframes || pat.fframes.length === 0) return identity;

		const ff = pat.fframes[0];
		return {
			a: { source: ff.a.s, sh: ff.a.sh, dup: ff.dup, skip: ff.skip },
			b: { source: ff.b.s, sh: ff.b.sh, dup: ff.dup, skip: ff.skip },
			c: { source: ff.c.s, sh: ff.c.sh, dup: ff.dup, skip: ff.skip },
			e: { source: ff.e.s, sh: ff.e.sh, dup: ff.dup, skip: ff.skip },
			n: { source: ff.n.s, sh: 0, dup: ff.dup, skip: ff.skip }
		};
	});

	function channelY(key: ChannelKey): number {
		const idx = CHANNEL_LABELS.findIndex((c) => c.key === key);
		return Y_START + idx * Y_STEP;
	}

	function getColor(key: ChannelKey): string {
		return CHANNEL_LABELS.find((c) => c.key === key)?.color ?? '#888';
	}

	function isIdentity(dest: ChannelKey): boolean {
		return routings[dest].source === dest;
	}
</script>

<svg viewBox="0 0 {WIDTH} {HEIGHT}" class="w-full" style="max-height: 120px;">
	{#each CHANNEL_LABELS as ch, i}
		{@const y = Y_START + i * Y_STEP}
		{@const r = routings[ch.key]}
		{@const srcY = channelY(r.source)}
		{@const identity = isIdentity(ch.key)}
		{@const srcColor = getColor(r.source)}

		<text
			x={LEFT_X - 8}
			y={srcY + 4}
			text-anchor="end"
			class="text-[10px] font-bold"
			fill={getColor(ch.key)}>
			{ch.label}
		</text>

		<text
			x={RIGHT_X + 8}
			y={y + 4}
			text-anchor="start"
			class="text-[10px] font-bold"
			fill={getColor(ch.key)}>
			{ch.label}
		</text>

		{#if r.skip}
			<line
				x1={LEFT_X}
				y1={srcY}
				x2={RIGHT_X}
				y2={y}
				stroke={srcColor}
				stroke-width="1.5"
				stroke-dasharray="4 3"
				opacity="0.5" />
		{:else if identity}
			<line
				x1={LEFT_X}
				y1={y}
				x2={RIGHT_X}
				y2={y}
				stroke={srcColor}
				stroke-width="1"
				opacity="0.3" />
		{:else}
			{@const cp1x = LEFT_X + (RIGHT_X - LEFT_X) * 0.35}
			{@const cp2x = LEFT_X + (RIGHT_X - LEFT_X) * 0.65}
			<path
				d="M {LEFT_X} {srcY} C {cp1x} {srcY}, {cp2x} {y}, {RIGHT_X} {y}"
				fill="none"
				stroke={srcColor}
				stroke-width="1.5"
				opacity="0.8" />
		{/if}

		{#if r.dup && !r.skip}
			<line
				x1={LEFT_X}
				y1={srcY + 2}
				x2={RIGHT_X}
				y2={y + 2}
				stroke={srcColor}
				stroke-width="0.5"
				opacity="0.4" />
		{/if}

		{#if r.sh !== 0}
			{@const mx = (LEFT_X + RIGHT_X) / 2}
			{@const my = (srcY + y) / 2}
			<text
				x={mx}
				y={my - 4}
				text-anchor="middle"
				class="text-[8px]"
				fill={srcColor}
				opacity="0.8">
				{r.sh > 0 ? `+${r.sh}` : r.sh} oct
			</text>
		{/if}
	{/each}
</svg>
