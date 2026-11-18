export class VirtualChannelMixer {
	constructor(adapters) {
		this.adapters = adapters;
		this.virtualChannelMap = {};
		this.virtualChannelRoles = {};
		this.hwChannelCount = adapters.defaultHwChannelCount;
		this.groups = [];
		this.hardwareRegisterState = adapters.createHardwareState(this.hwChannelCount);
	}

	configure(virtualChannelMap, hwChannelCount, virtualChannelRoles) {
		this.virtualChannelMap = virtualChannelMap || {};
		this.virtualChannelRoles = virtualChannelRoles || {};
		this.hwChannelCount = hwChannelCount ?? this.adapters.defaultHwChannelCount;
		this.groups = this._buildGroups();
		this.hardwareRegisterState = this.adapters.createHardwareState(this.hwChannelCount);
	}

	_buildGroups() {
		const groups = [];
		let offset = 0;
		for (let hw = 0; hw < this.hwChannelCount; hw++) {
			const count = this.virtualChannelMap[hw] ?? 1;
			const indices = [];
			for (let v = 0; v < count; v++) {
				indices.push(offset + v);
			}
			groups.push({ hwIndex: hw, virtualIndices: indices });
			offset += count;
		}
		return groups;
	}

	getTotalVirtualChannelCount() {
		let total = 0;
		for (let i = 0; i < this.hwChannelCount; i++) {
			total += this.virtualChannelMap[i] ?? 1;
		}
		return total;
	}

	getHardwareChannelIndex(virtualChannelIndex) {
		let offset = 0;
		for (let hw = 0; hw < this.hwChannelCount; hw++) {
			const count = this.virtualChannelMap[hw] ?? 1;
			if (virtualChannelIndex < offset + count) {
				return hw;
			}
			offset += count;
		}
		return Math.max(0, this.hwChannelCount - 1);
	}

	hasVirtualChannels() {
		return Object.values(this.virtualChannelMap).some((count) => count > 1);
	}

	getAudibleVirtualChannelIndices(virtualRegisterState, state) {
		const audible = [];
		for (const group of this.groups) {
			const { voiceIndices } = this._partitionGroup(group);
			if (voiceIndices.length > 1) {
				const picked = this._selectVoice(voiceIndices, virtualRegisterState, state);
				if (this._isChannelActive(picked, virtualRegisterState)) audible.push(picked);
				continue;
			}
			for (const vch of voiceIndices) {
				if (this._isChannelActive(vch, virtualRegisterState)) {
					audible.push(vch);
					break;
				}
			}
		}
		return audible;
	}

	getMergedVirtualChannelIndices(virtualRegisterState, state) {
		const selected = [];
		for (const group of this.groups) {
			const { voiceIndices } = this._partitionGroup(group);
			if (voiceIndices.length === 0) {
				selected.push(-1);
				continue;
			}
			selected.push(this._selectVoice(voiceIndices, virtualRegisterState, state));
		}
		return selected;
	}

	merge(virtualRegisterState, state) {
		this.adapters.resetHardwareState(this.hardwareRegisterState);
		this.adapters.copyGlobals?.(virtualRegisterState, this.hardwareRegisterState, state);

		for (const group of this.groups) {
			const { voiceIndices, roleChannels } = this._partitionGroup(group);
			if (voiceIndices.length === 0) continue;
			const selectedVch = this._selectVoice(voiceIndices, virtualRegisterState, state);
			this.adapters.copyChannel(
				virtualRegisterState,
				selectedVch,
				this.hardwareRegisterState,
				group.hwIndex
			);
			const appliedRoles = new Set();
			for (const side of roleChannels) {
				if (appliedRoles.has(side.roleId)) continue;
				if (!this._isChannelActive(side.vch, virtualRegisterState)) continue;
				this.adapters.applyVirtualChannelRole(
					side.roleId,
					virtualRegisterState,
					side.vch,
					this.hardwareRegisterState,
					group.hwIndex
				);
				appliedRoles.add(side.roleId);
			}
		}

		return this.hardwareRegisterState;
	}

	_roleId(hwIndex, indexInGroup) {
		const groupRoles = this.virtualChannelRoles?.[hwIndex];
		if (!groupRoles) return null;
		const roleId = groupRoles[indexInGroup];
		if (typeof roleId !== 'string' || roleId.length === 0) return null;
		if (typeof this.adapters.claimsVirtualChannelRole !== 'function') return null;
		if (!this.adapters.claimsVirtualChannelRole(roleId)) return null;
		if (typeof this.adapters.applyVirtualChannelRole !== 'function') return null;
		return roleId;
	}

	_partitionGroup(group) {
		const voiceIndices = [];
		const roleChannels = [];
		for (let indexInGroup = 0; indexInGroup < group.virtualIndices.length; indexInGroup++) {
			const vch = group.virtualIndices[indexInGroup];
			const roleId = this._roleId(group.hwIndex, indexInGroup);
			if (roleId) roleChannels.push({ vch, roleId });
			else voiceIndices.push(vch);
		}
		if (voiceIndices.length === 0 && roleChannels.length > 0) {
			const fallback = roleChannels.shift();
			voiceIndices.push(fallback.vch);
		}
		return { voiceIndices, roleChannels };
	}

	_selectVoice(voiceIndices, virtualRegisterState, state) {
		if (voiceIndices.length === 1) return voiceIndices[0];
		const alphaVoice = this._selectVoiceByAlpha(voiceIndices, virtualRegisterState, state);
		if (alphaVoice !== -1) return alphaVoice;
		for (const vch of voiceIndices) {
			if (this._isChannelActive(vch, virtualRegisterState)) return vch;
		}
		return voiceIndices[voiceIndices.length - 1];
	}

	// Alpha mask (chips that expose per-channel alpha through adapters.getChannelAlpha).
	// Applies only while the primary (first) voice plays an instrument row with alpha < 15;
	// otherwise returns -1 and the caller uses the default "first active wins" (alpha 15 = no mask,
	// so every file written without an alpha lane plays exactly as before).
	//   primary alpha < 15: the first lower voice that sounds and has a higher alpha wins,
	//   otherwise the primary stays
	_selectVoiceByAlpha(voiceIndices, virtualRegisterState, state) {
		const getAlpha = this.adapters.getChannelAlpha;
		if (typeof getAlpha !== 'function' || !state) return -1;
		const primary = voiceIndices[0];
		const primaryAlpha = getAlpha(state, primary);
		if (primaryAlpha === null || primaryAlpha === undefined) return -1;
		if (primaryAlpha < 0 || primaryAlpha >= 15) return -1;
		for (let i = 1; i < voiceIndices.length; i++) {
			const vch = voiceIndices[i];
			if (!this._isChannelActive(vch, virtualRegisterState)) continue;
			const alpha = getAlpha(state, vch);
			const underlyingAlpha = alpha === null || alpha === undefined || alpha < 0 ? 15 : alpha;
			if (underlyingAlpha > primaryAlpha) return vch;
		}
		return primary;
	}

	_isChannelActive(vch, registerState) {
		return this.adapters.isChannelActive(vch, registerState);
	}
}

export default VirtualChannelMixer;
