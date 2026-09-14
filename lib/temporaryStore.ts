// Best-effort protection within ONE warm function instance, not shared persistence.
export class TemporaryStore<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  constructor(private readonly capacity = 5000) {}
  get(key: string, now = Date.now()): T | undefined {
    const row = this.entries.get(key);
    if (!row) return undefined;
    if (row.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return row.value;
  }
  set(key: string, value: T, expiresAt: number, now = Date.now()) {
    for (const [id, row] of this.entries) if (row.expiresAt <= now) this.entries.delete(id);
    if (!this.entries.has(key) && this.entries.size >= this.capacity) return false;
    this.entries.set(key, { value, expiresAt });
    return true;
  }
}
