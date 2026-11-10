export function checkAnswer(answer, config) {
  return Array.isArray(answer) && answer.length === config.correctOrder.length
    && answer.every((id, i) => id === config.correctOrder[i]);
}

export function mount(container, game, onSuccess) {
  const controller = new AbortController();
  const order = [...game.config.correctOrder].reverse();
  let solved = false;
  container.innerHTML = `
    <div class="puzzle-grid">
      <section class="workbench" aria-label="Program instructions">
        <div class="panel-label"><span class="status-dot"></span> Your two-line program</div>
        <ol class="command-list"></ol>
        <button type="button" class="button button-secondary" data-action="swap">↕ Swap commands</button>
      </section>
      <section class="terminal" aria-label="Program output">
        <div class="terminal-bar"><span>● ● ●</span><span>VIC-20 / reconstructed</span></div>
        <pre class="terminal-output">READY.
Waiting for your program…</pre>
        <p class="terminal-note">A safe preview, not a real infinite loop.</p>
      </section>
    </div>
    <p class="feedback" role="status" aria-live="polite"></p>
    <button type="button" class="button button-primary" data-action="run">Run program <span aria-hidden="true">↗</span></button>`;
  const list = container.querySelector('.command-list');
  const output = container.querySelector('.terminal-output');
  const feedback = container.querySelector('.feedback');

  function draw() {
    list.replaceChildren();
    for (const id of order) {
      const command = game.config.commands.find(item => item.id === id);
      const item = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = command.label;
      const description = document.createElement('small');
      description.textContent = command.description;
      item.append(code, description);
      list.append(item);
    }
  }
  draw();
  container.addEventListener('click', event => {
    if (solved) return;
    const action = event.target.closest('button')?.dataset.action;
    if (action === 'swap') {
      order.reverse();
      draw();
      feedback.textContent = '';
      output.textContent = 'READY.\nYour instructions have changed. Run them to see what happens.';
    }
    if (action === 'run') {
      if (!checkAnswer(order, game.config)) {
        output.textContent = 'NO OUTPUT.\nThe first instruction keeps jumping back to itself.';
        feedback.textContent = 'Not quite. Display the message before you go back to the first line. Try again—no points lost.';
        return;
      }
      output.textContent = Array(4).fill(game.config.message).join('\n') + '\n…';
      feedback.textContent = 'It works! The message repeats. Preview stopped after four lines.';
      solved = true;
      container.querySelectorAll('button').forEach(button => { button.disabled = true; });
      onSuccess();
    }
  }, { signal: controller.signal });
  return () => controller.abort();
}
