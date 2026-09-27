/** In-memory investigation scratchpad (per-request instance). */
export class NotesMemory {
  private notes: string[] = [];

  write(note: string): { ok: true; count: number } {
    const cleaned = note.trim();
    if (cleaned) this.notes.push(cleaned);
    return { ok: true, count: this.notes.length };
  }

  read(): string[] {
    return [...this.notes];
  }

  list(): string[] {
    return this.read();
  }
}
