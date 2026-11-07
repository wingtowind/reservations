((root) => {
  const PREPARATION_MS = 5000;
  const START_CLOCK_MS = (13 * 3600 + 59 * 60 + 55) * 1000;

  class ReservationSimulation {
    constructor(now = () => performance.now()) {
      this.now = now;
      this.reset();
    }

    reset() {
      this.startedAt = null;
      this.openAt = null;
      this.selectedElapsedMs = null;
      this.slot = null;
      this.finishedElapsedMs = null;
      this.result = null;
    }

    start() {
      this.reset();
      this.startedAt = this.now();
      this.openAt = this.startedAt + PREPARATION_MS;
    }

    get running() {
      return this.startedAt !== null && this.finishedElapsedMs === null;
    }

    get canReserve() {
      return this.running && this.now() >= this.openAt;
    }

    clockText() {
      const elapsed = this.startedAt === null ? 0 : this.finishedElapsedMs ?? this.now() - this.startedAt;
      const milliseconds = START_CLOCK_MS + Math.max(0, Math.floor(elapsed));
      const pad = (value, length = 2) => String(value).padStart(length, "0");
      return `${pad(Math.floor(milliseconds / 3600000) % 24)}:${pad(Math.floor(milliseconds / 60000) % 60)}:${pad(Math.floor(milliseconds / 1000) % 60)}.${pad(milliseconds % 1000, 3)}`;
    }

    selectSlot(slot) {
      if (!this.canReserve || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slot.time)) return false;
      const hour = Number(slot.time.slice(0, 2));
      if (hour < 10 || hour > 21) return false;
      this.slot = { date: slot.date, time: slot.time };
      this.selectedElapsedMs = Math.floor(this.now() - this.startedAt);
      return true;
    }

    finish() {
      if (this.result) return this.result;
      if (!this.running || !this.slot || this.selectedElapsedMs === null) return null;
      // Use the same millisecond resolution as the displayed clock for additive splits.
      this.finishedElapsedMs = Math.floor(this.now() - this.startedAt);
      const totalMs = this.finishedElapsedMs - PREPARATION_MS;
      const slotMs = this.selectedElapsedMs - PREPARATION_MS;
      const captchaMs = this.finishedElapsedMs - this.selectedElapsedMs;
      const limitMs = Number(this.slot.time.slice(0, 2)) <= 16 ? 5000 : 7000;
      this.result = Object.freeze({
        ...this.slot,
        totalMs,
        slotMs,
        captchaMs,
        limitMs,
        success: totalMs <= limitMs
      });
      return this.result;
    }
  }

  root.ReservationSimulation = ReservationSimulation;
  if (typeof module !== "undefined" && module.exports) module.exports = ReservationSimulation;
})(typeof window !== "undefined" ? window : globalThis);
