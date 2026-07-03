const ghost = document.getElementById('ghost');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text');

const MOODS = ['nag', 'sigh', 'cheer', 'neutral', 'stretch'];
const SHOW_MS = 8500; // main의 bubbleMs(9초)보다 살짝 짧게 — 퇴장 애니메이션 시간 확보

let hideTimer = null;

function show({ mood, message }) {
  clearTimeout(hideTimer);

  ghost.classList.remove('hidden', ...MOODS);
  ghost.classList.add(MOODS.includes(mood) ? mood : 'neutral');

  bubbleText.textContent = message;
  bubble.classList.remove('hidden');

  hideTimer = setTimeout(hide, SHOW_MS);
}

function hide() {
  ghost.classList.add('hidden');
  bubble.classList.add('hidden');
}

window.deskghost.onGhost((data) => {
  if (data && data.should_appear && data.message) show(data);
});
