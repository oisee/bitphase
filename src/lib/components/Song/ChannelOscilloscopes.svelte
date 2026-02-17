<script lang="ts">
	import { waveformStore } from '../../stores/waveform.svelte';

	const triggerWidth = 0.1;
	const STROKE_COLOR_CACHE_FRAMES = 60;
	const ZERO_SAMPLES = new Float32Array(512);

	let {
		channelLabels = ['A', 'B', 'C'],
		height = 80,
		zoom = 1,
		amplify = 1,
		escapeBoundary = false
	}: {
		channelLabels?: string[];
		height?: number;
		zoom?: number;
		amplify?: number;
		escapeBoundary?: boolean;
	} = $props();

	let canvasEls: (HTMLCanvasElement | null)[] = $state([]);

	function dcAndRange(samples: Float32Array): { dc: number; min: number; max: number } {
		if (samples.length === 0) return { dc: 0, min: 0, max: 0 };
		let min = samples[0];
		let max = samples[0];
		for (let i = 1; i < samples.length; i++) {
			const v = samples[i];
			if (v < min) min = v;
			if (v > max) max = v;
		}
		return { dc: (min + max) / 2, min, max };
	}

	function findFirstDownwardDCCrossingAfterArm(
		samples: Float32Array,
		dc: number,
		armThreshold: number
	): number | null {
		let armed = false;
		for (let i = 0; i < samples.length - 1; i++) {
			if (samples[i] >= armThreshold) armed = true;
			if (!armed) continue;
			const a = samples[i];
			const b = samples[i + 1];
			if (a >= dc && b < dc) {
				const frac = a === b ? 0 : (a - dc) / (a - b);
				return i + frac;
			}
		}
		return null;
	}

	function shiftBufferToDCCrossing(
		samples: Float32Array,
		width: number,
		out: Float32Array
	): Float32Array {
		const { dc, min, max } = dcAndRange(samples);
		const armThreshold = dc + (width * (max - min)) / 2;
		const crossing = findFirstDownwardDCCrossingAfterArm(samples, dc, armThreshold);
		if (crossing === null) {
			out.set(samples);
			return out;
		}
		const n = samples.length;
		const start = (((crossing - n / 2) % n) + n) % n;
		for (let i = 0; i < n; i++) {
			const pos = (start + i) % n;
			const lo = Math.floor(pos);
			const hi = (lo + 1) % n;
			const frac = pos - lo;
			out[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
		}
		return out;
	}

	function resampleToWidth(
		samples: Float32Array,
		outWidth: number,
		out: Float32Array
	): Float32Array {
		if (samples.length < 2 || outWidth < 2) {
			const copy = getScratch(samples.length);
			copy.set(samples);
			return copy;
		}
		const scale = (samples.length - 1) / (outWidth - 1);
		for (let i = 0; i < outWidth; i++) {
			const srcIdx = i * scale;
			const lo = Math.floor(srcIdx);
			const hi = Math.min(lo + 1, samples.length - 1);
			const frac = srcIdx - lo;
			out[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
		}
		return out;
	}

	const scratchByLength = new Map<number, Float32Array>();

	function getScratch(length: number): Float32Array {
		let buf = scratchByLength.get(length);
		if (!buf || buf.length !== length) {
			buf = new Float32Array(length);
			scratchByLength.set(length, buf);
		}
		return buf;
	}

	function drawChannel(
		ctx: CanvasRenderingContext2D,
		samples: Float32Array,
		width: number,
		height: number,
		strokeColor: string
	) {
		if (samples.length === 0) return;
		ctx.clearRect(0, 0, width, height);
		const midY = height / 2;
		const halfHeight = (height / 2) * 0.85;
		const outWidth = Math.max(2, width - 2);
		const aligned = shiftBufferToDCCrossing(
			samples,
			triggerWidth,
			getScratch(samples.length)
		);
		const resampled = resampleToWidth(aligned, outWidth, getScratch(outWidth));
		let min = resampled[0];
		let max = resampled[0];
		for (let i = 1; i < resampled.length; i++) {
			const v = resampled[i];
			if (v < min) min = v;
			if (v > max) max = v;
		}
		const dcOff = (min + max) / 2;
		const stepX = width / (resampled.length - 1);

		ctx.strokeStyle = strokeColor;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i < resampled.length; i++) {
			let val = resampled[i] - dcOff;
			if (val < -0.5) val = -0.5;
			if (val > 0.5) val = 0.5;
			val *= amplify * 2;
			let y = midY - val * halfHeight * zoom;
			if (!escapeBoundary) {
				y = Math.max(0, Math.min(height, y));
			}
			const x = i * stepX;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}

	const defaultStrokeColor = '#89b4fa';

	$effect(() => {
		const canvases = canvasEls;
		if (canvases.length === 0) return;

		let rafId: number;
		let frameCount = 0;
		let cachedStrokeColor = defaultStrokeColor;

		function tick() {
			rafId = requestAnimationFrame(tick);
			frameCount++;
			if (document.hidden) return;

			if (frameCount % STROKE_COLOR_CACHE_FRAMES === 0) {
				const v = getComputedStyle(document.documentElement)
					.getPropertyValue('--color-pattern-note')
					.trim();
				cachedStrokeColor = v || defaultStrokeColor;
			}

			const ch = waveformStore.channels;

			for (let index = 0; index < canvases.length; index++) {
				const canvas = canvases[index];
				if (!canvas) continue;
				const rect = canvas.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) continue;
				const dpr = window.devicePixelRatio ?? 1;
				const w = Math.floor(rect.width * dpr);
				const h = Math.floor(rect.height * dpr);
				if (canvas.width !== w || canvas.height !== h) {
					canvas.width = w;
					canvas.height = h;
				}
				const ctx = canvas.getContext('2d');
				if (!ctx) continue;
				const samples =
					ch.length > 0 && index < ch.length && ch[index]
						? ch[index]
						: ZERO_SAMPLES;
				drawChannel(ctx, samples, w, h, cachedStrokeColor);
			}
		}

		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	});
</script>

<div
	class="flex shrink-0 gap-px border-t border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)]"
	style="height: {height}px">
	{#each channelLabels as label, i}
		<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
			<div class="text-center text-xs text-[var(--color-app-text-muted)]">{label}</div>
			<canvas
				bind:this={canvasEls[i]}
				class="block h-full w-full"
				style="height: {height - 20}px"></canvas>
		</div>
	{/each}
</div>
