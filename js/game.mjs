export function createRun(gameIds, random = Math.random) {
  const order = [...gameIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, completed: [], score: 0, identityAttempts: 0, finished: false };
}

export function completeGame(run, id) {
  if (run.finished || !id || run.order[run.completed.length] !== id) return false;
  run.completed.push(id);
  run.score += 300 / run.order.length;
  return true;
}

export function answerIdentity(run, choice, expected) {
  if (run.finished || run.completed.length !== run.order.length || !choice?.trim()) return false;
  run.identityAttempts++;
  if (choice !== expected) return false;
  if (run.identityAttempts === 1) run.score += 50;
  run.finished = true;
  return true;
}
