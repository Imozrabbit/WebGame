export function checkAnswer(answer, config) {
  return Boolean(answer) && Object.entries(config.correct).every(([key, value]) => answer[key] === value);
}

export function mount(container, game, onSuccess) {
  const controller = new AbortController();
  const answer = {};
  let solved = false;
  container.innerHTML = `
    <div class="mascot-workshop">
      <div class="mascot-evidence">
        <section class="design-note"><div class="panel-label">The recovered design note</div><p></p><small>Adapted from a real design discussion.</small></section>
        <form class="mascot-controls"><div class="mascot-options"></div><p class="feedback" role="status" aria-live="polite"></p><button type="submit" class="button button-primary">Check the mascot <span aria-hidden="true">↗</span></button></form>
      </div>
      <figure class="mascot-preview">
        <span class="illustration-label">Suspect sketch / live reconstruction</span>
        <svg viewBox="0 0 260 280" role="img" aria-labelledby="penguin-title">
          <title id="penguin-title">A penguin awaiting your design choices.</title>
          <ellipse cx="130" cy="252" rx="84" ry="10" fill="#163c3520"/>
          <path d="M71 146Q24 159 46 210Q66 211 88 176" fill="#20383b"/>
          <path d="M189 146Q236 159 214 210Q194 211 172 176" fill="#20383b"/>
          <g class="penguin-figure">
            <ellipse class="penguin-body" cx="130" cy="151" rx="54" ry="88" fill="#20383b"/>
            <ellipse class="penguin-belly" cx="130" cy="170" rx="39" ry="62" fill="#fff9e8"/>
            <ellipse cx="112" cy="105" rx="20" ry="26" fill="#fff9e8"/>
            <ellipse cx="148" cy="105" rx="20" ry="26" fill="#fff9e8"/>
            <path class="eye-left" d="M103 102L118 108" stroke="#20383b" stroke-width="4" stroke-linecap="round" fill="none"/>
            <path class="eye-right" d="M142 108L157 102" stroke="#20383b" stroke-width="4" stroke-linecap="round" fill="none"/>
            <path d="M116 123Q130 114 144 123L130 139Z" fill="#e9ab42"/>
          </g>
          <ellipse class="foot-left" cx="91" cy="242" rx="27" ry="12" transform="rotate(-12 91 242)" fill="#e9ab42"/>
          <ellipse class="foot-right" cx="169" cy="242" rx="27" ry="12" transform="rotate(12 169 242)" fill="#e9ab42"/>
        </svg>
        <figcaption>Choose three details to bring the note to life.</figcaption>
        <span class="sketch-stamp" aria-hidden="true">EXHIBIT C</span>
      </figure>
    </div>`;
  container.querySelector('.design-note p').textContent = game.config.note;
  const controls = container.querySelector('.mascot-options');
  const feedback = container.querySelector('.feedback');
  for (const [key, options] of Object.entries(game.config.options)) {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = key[0].toUpperCase() + key.slice(1);
    fieldset.append(legend);
    const choices = document.createElement('div');
    choices.className = 'segmented-options';
    for (const option of options) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = key;
      input.value = option.value;
      const text = document.createElement('span');
      text.textContent = option.label;
      label.append(input, text);
      choices.append(label);
    }
    fieldset.append(choices);
    controls.append(fieldset);
  }
  container.querySelector('form').addEventListener('change', event => {
    if (solved || !event.target.matches('input[type="radio"]')) return;
    answer[event.target.name] = event.target.value;
    const rounded = answer.shape === 'rounded';
    const seated = answer.posture === 'seated';
    const contented = answer.expression === 'contented';
    container.querySelector('.penguin-body').setAttribute('rx', rounded ? '72' : '54');
    container.querySelector('.penguin-belly').setAttribute('rx', rounded ? '54' : '39');
    container.querySelector('.penguin-figure').setAttribute('transform', seated ? 'translate(0 9) scale(1 .97)' : 'translate(0 -8)');
    container.querySelector('.foot-left').setAttribute('rx', seated ? '34' : '27');
    container.querySelector('.foot-right').setAttribute('rx', seated ? '34' : '27');
    container.querySelector('.eye-left').setAttribute('d', contented ? 'M103 103Q110 112 118 103' : 'M103 102L118 108');
    container.querySelector('.eye-right').setAttribute('d', contented ? 'M142 103Q150 112 157 103' : 'M142 108L157 102');
    const details = Object.entries(answer).map(([key, value]) =>
      game.config.options[key].find(option => option.value === value).label.toLowerCase());
    container.querySelector('#penguin-title').textContent = `Penguin: ${details.join(', ')}.`;
    container.querySelector('figcaption').textContent = `${details.length} of 3 details chosen. ${details.join(' · ')}.`;
    feedback.textContent = '';
  }, { signal: controller.signal });
  container.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (solved) return;
    if (!checkAnswer(answer, game.config)) {
      feedback.textContent = 'Not quite. Check all three details against the design note. Try again—no points lost.';
      return;
    }
    solved = true;
    feedback.textContent = 'Friendly, full, and exactly on brief. Your mascot fits the evidence.';
    container.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    onSuccess();
  }, { signal: controller.signal });
  return () => controller.abort();
}
