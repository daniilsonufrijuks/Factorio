export function noteProgress(state, kind, amount = 1) {
  const missions = state.daily?.missions;
  if (!missions || amount <= 0) return;
  for (const mission of missions) {
    if (mission.kind !== kind || mission.claimed) continue;
    mission.progress = Math.min(mission.goal, (mission.progress || 0) + amount);
  }
}
