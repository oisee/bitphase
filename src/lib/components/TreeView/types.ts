export interface TreeNode<T = unknown> {
	id: string;
	label: string;
	children?: TreeNode<T>[];
	data?: T;
}
