<script lang="ts">
	import { modalStore } from '../../stores/modal.svelte';
	import Modal from './Modal.svelte';

	const modals = $derived(modalStore.modals);
</script>

{#each modals as modal, index}
	{@const Component = modal.component}
	{@const resolve = (value?: any) => modalStore.close(index, value)}
	{@const baseDismiss = (error?: any) => modalStore.dismiss(index, error)}
	{@const onCloseRef = { current: null as (() => void) | null }}
	{@const props = {
		...modal.props,
		resolve,
		dismiss: baseDismiss,
		onCloseRef
	} as typeof modal.props & {
		resolve: (value?: any) => void;
		dismiss: (error?: any) => void;
		onCloseRef?: { current: (() => void) | null };
	}}
	{@const onCloseHandler = () => {
		if (onCloseRef.current) {
			onCloseRef.current();
		} else {
			baseDismiss();
		}
	}}
	<Modal onClose={onCloseHandler} isActive={index === modals.length - 1}>
		<Component {...props} />
	</Modal>
{/each}
