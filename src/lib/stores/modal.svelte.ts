import type { Component, ComponentProps } from 'svelte';

type ModalInstance<T extends Component<any, any, any>> = {
	component: T;
	props: ComponentProps<T>;
	resolve: (value: any) => void;
	reject: (error?: any) => void;
};

class ModalStore {
	modals = $state<ModalInstance<any>[]>([]);

	open<T extends Component<any, any, any>>(
		component: T,
		props: ComponentProps<T>
	): Promise<any> {
		return new Promise((resolve, reject) => {
			this.modals = [...this.modals, { component, props, resolve, reject }];
		});
	}

	close(index: number, value?: any): void {
		const modal = this.modals[index];
		if (modal) {
			modal.resolve(value);
			this.modals = this.modals.filter((_, i) => i !== index);
		}
	}

	dismiss(index: number, error?: any): void {
		const modal = this.modals[index];
		if (modal) {
			modal.reject(error);
			this.modals = this.modals.filter((_, i) => i !== index);
		}
	}
}

export const modalStore = new ModalStore();
