export function checkAnswer(answer, config) {
  return Boolean(answer) && typeof answer === 'object' && !Array.isArray(answer)
    && Object.keys(answer).length === config.jobs.length
    && config.jobs.every(job => Object.hasOwn(answer, job.id) && answer[job.id] === job.part);
}

export function mount(container, game, onSuccess) {
  const controller = new AbortController();
  let solved = false;
  container.innerHTML = `
    <form aria-label="System matching">
      <div class="revision-documents">
        <section class="document-card"><div class="panel-label">Recovered parts guide</div><dl class="system-parts"></dl></section>
        <section class="document-card"><div class="panel-label">Three jobs waiting for a part</div><div class="system-jobs"></div></section>
      </div>
      <p class="fiction-label">A simplified system diagram, not a complete list of everything an operating system needs.</p>
      <p class="feedback" role="status" aria-live="polite"></p>
      <button type="submit" class="button button-primary">Check the system <span aria-hidden="true">↗</span></button>
    </form>`;
  const form = container.querySelector('form');
  const feedback = container.querySelector('.feedback');
  for (const part of game.config.parts) {
    const term = document.createElement('dt');
    term.textContent = part.label;
    const description = document.createElement('dd');
    description.textContent = part.description;
    container.querySelector('.system-parts').append(term, description);
  }
  for (const [index, job] of game.config.jobs.entries()) {
    const label = document.createElement('label');
    label.className = 'system-job';
    label.htmlFor = `system-job-${index}`;
    label.textContent = job.label;
    const select = document.createElement('select');
    select.id = label.htmlFor;
    select.name = job.id;
    select.append(new Option('Choose a part', ''));
    for (const part of game.config.parts) select.append(new Option(part.label, part.id));
    container.querySelector('.system-jobs').append(label, select);
  }
  form.addEventListener('change', () => {
    if (!solved) feedback.textContent = '';
  }, { signal: controller.signal });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (solved) return;
    if (!checkAnswer(Object.fromEntries(new FormData(form)), game.config)) {
      feedback.textContent = 'Not quite. Match all three jobs with the parts guide. Try again—no points lost.';
      return;
    }
    solved = true;
    feedback.textContent = 'Every job has the right part. The kernel is one part of a bigger system.';
    form.querySelectorAll('select, button').forEach(control => { control.disabled = true; });
    onSuccess();
  }, { signal: controller.signal });
  return () => controller.abort();
}
