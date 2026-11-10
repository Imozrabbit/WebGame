export function checkAnswer(answer, config) {
  if (!Array.isArray(answer) || answer.length !== config.target.length
      || new Set(answer).size !== answer.length) return false;
  const lines = [...config.base];
  const changed = new Set();
  for (const id of answer) {
    const card = config.cards.find(item => item.id === id);
    if (!card || changed.has(card.line)) return false;
    changed.add(card.line);
    lines[card.line] = card.text;
  }
  return lines.every((line, i) => line === config.target[i]);
}

export function mount(container, game, onSuccess) {
  const controller = new AbortController();
  const selected = new Set();
  let solved = false;
  container.innerHTML = `
    <div class="revision-documents">
      <section class="document-card"><div class="panel-label">Your recovered document</div><p class="document-preview"></p></section>
      <section class="document-card target-card"><div class="panel-label">Target document</div><p class="document-target"></p></section>
    </div>
    <p class="fiction-label">A fictional document to illustrate version control.</p>
    <div class="change-cards" role="group" aria-label="Available changes"></div>
    <p class="selection-count" aria-live="polite">0 of 2 changes selected</p>
    <p class="feedback" role="status" aria-live="polite"></p>
    <button type="button" class="button button-primary" data-action="submit">Restore document <span aria-hidden="true">↗</span></button>`;
  const cards = container.querySelector('.change-cards');
  const preview = container.querySelector('.document-preview');
  const feedback = container.querySelector('.feedback');
  container.querySelector('.document-target').textContent = game.config.target.join('\n');

  for (const [i, card] of game.config.cards.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'change-card';
    button.dataset.id = card.id;
    button.setAttribute('aria-pressed', 'false');
    const number = document.createElement('span');
    number.className = 'change-number';
    number.textContent = `CHANGE 0${i + 1}`;
    const title = document.createElement('strong');
    title.textContent = card.title;
    const text = document.createElement('span');
    text.className = 'change-text';
    text.textContent = card.text;
    const description = document.createElement('small');
    description.textContent = card.description;
    button.append(number, title, text, description);
    cards.append(button);
  }
  function draw() {
    const lines = [...game.config.base];
    for (const id of selected) {
      const card = game.config.cards.find(item => item.id === id);
      lines[card.line] = card.text;
    }
    preview.textContent = lines.join('\n');
    cards.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(selected.has(button.dataset.id)));
    });
    container.querySelector('.selection-count').textContent = `${selected.size} of 2 changes selected`;
  }
  draw();
  container.addEventListener('click', event => {
    if (solved) return;
    const button = event.target.closest('button');
    if (button?.dataset.id) {
      const id = button.dataset.id;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      feedback.textContent = '';
      draw();
    }
    if (button?.dataset.action === 'submit') {
      if (!checkAnswer([...selected], game.config)) {
        feedback.textContent = 'Not quite. Choose exactly two changes, one for each sentence, and compare your document with the target. Try again—no points lost.';
        return;
      }
      solved = true;
      feedback.textContent = 'A clean restoration. Both changes fit, and the history is preserved.';
      container.querySelectorAll('button').forEach(item => { item.disabled = true; });
      onSuccess();
    }
  }, { signal: controller.signal });
  return () => controller.abort();
}
