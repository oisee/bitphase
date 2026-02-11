import { settingsStore } from './settings.svelte';

class EditorStateStore {
	octave = $state(4);
	step = $state(1);
	envelopeAsNote = $state(false);
	currentInstrument = $state('01');

	init(): void {
		this.envelopeAsNote = settingsStore.envelopeAsNote;
	}

	setOctave(octave: number): void {
		if (octave >= 0 && octave <= 8) {
			this.octave = octave;
		}
	}

	setStep(step: number): void {
		this.step = step;
	}

	setEnvelopeAsNote(envelopeAsNote: boolean): void {
		if (this.envelopeAsNote === envelopeAsNote) return;
		this.envelopeAsNote = envelopeAsNote;
		settingsStore.set('envelopeAsNote', envelopeAsNote);
	}

	setCurrentInstrument(instrument: string): void {
		this.currentInstrument = instrument;
	}
}

export const editorStateStore = new EditorStateStore();
