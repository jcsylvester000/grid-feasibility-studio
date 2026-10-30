/** Age of a source report's research (no app imports: bundled into the Netlify run worker). */
export const REUSE_RESEARCH_DAYS = 30;

export function sourceAge(intake: Record<string, unknown>, now = new Date()) {
  const at = typeof intake["source.finished_at"] === "string" ? new Date(intake["source.finished_at"] as string) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  const days = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 86_400_000));
  return { days, reuse: days <= REUSE_RESEARCH_DAYS, finishedAt: at };
}

/** Keys added to the intake sent to the pipeline: how old the source research is and whether to reuse it. */
export function sourceRunKeys(intake: Record<string, unknown>, now = new Date()) {
  const age = sourceAge(intake, now);
  return age ? { "source.age_days": age.days, "source.reuse_research": age.reuse } : {};
}
