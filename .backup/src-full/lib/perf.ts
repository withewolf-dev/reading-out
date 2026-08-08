/**
 * TEMPORARY — timing marks for the open-a-book path.
 *
 * Hermes' `console.log` never reaches the native log, so a finished run is
 * stashed in the settings table where it can be read off the simulator with
 * sqlite3. Delete this file and its call sites once the slow step is found.
 */
type Mark = { label: string; at: number };

let marks: Mark[] = [];
const runs: string[] = [];

/** Starts a fresh run. Call at the moment the finger lifts. */
export function markStart(label: string): void {
  marks = [{ label, at: Date.now() }];
}

/**
 * Records a step, reported as a delta from the previous mark. Self-starting, so
 * a run that begins somewhere other than a tap — a deep link, say — still
 * produces a trace instead of silence.
 */
export function mark(label: string): void {
  if (marks.length === 0) {
    markStart(label);
    return;
  }
  const at = Date.now();
  const previous = marks[marks.length - 1].at;
  const first = marks[0].at;
  marks.push({ label, at });
  console.log(`[perf] ${label}: +${at - previous}ms (total ${at - first}ms)`);
}

/**
 * Milliseconds since the run started, or -1 if nothing has started. Lets a
 * screen show its own timings without any storage at all.
 */
export function sinceStart(): number {
  if (marks.length === 0) return -1;
  return Date.now() - marks[0].at;
}

/** Closes the current run and returns every run so far, newest last. */
export function endRun(): string {
  if (marks.length > 0) {
    const first = marks[0].at;
    runs.push(
      marks
        .map((m, i) => `${m.label}=+${i === 0 ? 0 : m.at - marks[i - 1].at}ms(t${m.at - first})`)
        .join(' → ')
    );
    marks = [];
  }
  // Only the last few runs are interesting, and the column should stay small.
  return runs.slice(-5).join('\n');
}
