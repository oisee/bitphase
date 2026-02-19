const STORAGE_KEY = 'bitphase-alpha-notice-seen';

class AlphaNoticeStore {
	hasSeen = $state(false);

	init(): void {
		try {
			this.hasSeen = localStorage.getItem(STORAGE_KEY) === 'true';
		} catch {
			this.hasSeen = false;
		}
	}

	markSeen(): void {
		try {
			localStorage.setItem(STORAGE_KEY, 'true');
		} catch {
			// ignore storage errors
		}
		this.hasSeen = true;
	}
}

export const alphaNoticeStore = new AlphaNoticeStore();
