const STORAGE = { session: 'mindTestSession', history: 'mindTestHistory', theme: 'mindTestTheme' };
const SESSION_VERSION = 7;
const TOTAL_QUESTIONS = 25;
const MAX_SCORE = 100;
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

function getSession() {
  try {
    localStorage.removeItem(STORAGE.session);
    return JSON.parse(sessionStorage.getItem(STORAGE.session));
  } catch { return null; }
}
function saveSession(data) { sessionStorage.setItem(STORAGE.session, JSON.stringify(data)); }
function startSession() {
  const data = { version: SESSION_VERSION, questions: shuffle(questions).map((question) => ({ ...question, options: shuffle(question.options) })), answers: {}, currentIndex: 0, startedAt: Date.now(), iqUnlocked: false };
  saveSession(data);
  return data;
}
function setupTheme() {
  if (localStorage.getItem(STORAGE.theme) === 'dark') document.body.classList.add('dark');
  document.querySelectorAll('.theme-toggle').forEach((button) => button.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem(STORAGE.theme, document.body.classList.contains('dark') ? 'dark' : 'light');
  }));
}
function validSession(data) { return data?.version === SESSION_VERSION && Array.isArray(data.questions) && data.questions.length === TOTAL_QUESTIONS && data.questions.every((question) => question.questionVisual && question.options?.every((option) => option.id && option.visual)); }

function initTest() {
  let data = getSession();
  if (!validSession(data)) data = startSession();
  const byId = (id) => document.getElementById(id);
  const save = () => saveSession(data);
  function render() {
    const question = data.questions[data.currentIndex];
    const answer = data.answers[data.currentIndex];
    byId('question-number').textContent = `문제 ${String(data.currentIndex + 1).padStart(2, '0')} / ${TOTAL_QUESTIONS}`;
    byId('category-label').textContent = `${question.category} · ${question.difficulty}`;
    byId('question-text').textContent = question.question;
    byId('progress-fill').style.width = `${((data.currentIndex + 1) / TOTAL_QUESTIONS) * 100}%`;
    byId('question-visual').hidden = false;
    byId('question-visual').innerHTML = question.questionVisual;
    byId('previous-button').disabled = data.currentIndex === 0;
    byId('next-button').textContent = data.currentIndex === TOTAL_QUESTIONS - 1 ? '결과 보기 →' : '다음 →';
    byId('selection-message').textContent = '';
    const optionList = byId('options');
    optionList.innerHTML = '';
    question.options.forEach((option, index) => {
      const selected = answer === option.id;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `option visual-option ${selected ? 'selected' : ''}`;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(selected));
      card.setAttribute('aria-label', `선택지 ${String.fromCharCode(65 + index)}`);
      card.innerHTML = `<b>${String.fromCharCode(65 + index)}</b><span class="option-art">${option.visual}</span><i aria-hidden="true">✓</i>`;
      card.addEventListener('click', () => { data.answers[data.currentIndex] = option.id; save(); render(); });
      optionList.append(card);
    });
  }
  byId('previous-button').addEventListener('click', () => { if (data.currentIndex > 0) { data.currentIndex--; save(); render(); } });
  byId('next-button').addEventListener('click', () => {
    if (!data.answers[data.currentIndex]) { byId('selection-message').textContent = '그림 선택지 하나를 고른 뒤 다음 문제로 이동할 수 있어요.'; return; }
    if (data.currentIndex === TOTAL_QUESTIONS - 1) { location.href = 'result.html'; return; }
    data.currentIndex++; save(); render();
  });
  render();
}
function calculateResult(data) {
  const correct = data.questions.filter((question, index) => data.answers[index] === question.answer).length;
  const accuracy = Math.round((correct * 1000) / TOTAL_QUESTIONS) / 10;
  return { correct, wrong: TOTAL_QUESTIONS - correct, score: Math.round((correct * MAX_SCORE) / TOTAL_QUESTIONS), accuracy, duration: Math.max(1, Math.round((Date.now() - data.startedAt) / 60000)) };
}
function formatPercentage(value) { return `${Number.isInteger(value) ? value : value.toFixed(1)}%`; }
function estimateIq(score) { return Math.round(90 + score * 0.33); }
function initResult() {
  const data = getSession();
  if (!validSession(data) || Object.keys(data.answers).length !== TOTAL_QUESTIONS) { location.href = 'test.html'; return; }
  const result = calculateResult(data);
  const byId = (id) => document.getElementById(id);
  byId('review-summary').textContent = `${result.correct} / ${TOTAL_QUESTIONS} 정답`;
  byId('accuracy-value').textContent = `정답률 ${formatPercentage(result.accuracy)}`;
  requestAnimationFrame(() => { byId('result-progress-fill').style.width = `${result.score}%`; });
  let displayedScore = 0;
  const counter = setInterval(() => { displayedScore = Math.min(result.score, displayedScore + 2); byId('score-value').textContent = displayedScore; if (displayedScore === result.score) clearInterval(counter); }, 18);
  const premiumCard = byId('premium-iq-card');
  const lockedPanel = byId('iq-locked');
  const unlockedPanel = byId('iq-unlocked');
  function renderPremium() {
    const unlocked = data.iqUnlocked === true;
    premiumCard.classList.toggle('unlocked', unlocked);
    lockedPanel.hidden = unlocked;
    unlockedPanel.hidden = !unlocked;
    if (unlocked) {
      byId('estimated-iq-value').textContent = estimateIq(result.score);
      byId('premium-score').textContent = `${result.score} / 100점`;
      byId('premium-accuracy').textContent = formatPercentage(result.accuracy);
    }
  }
  byId('test-payment-button').addEventListener('click', () => {
    data.iqUnlocked = true;
    saveSession(data);
    renderPremium();
  });
  renderPremium();
  byId('save-result-button').addEventListener('click', (event) => {
    let history = []; try { history = JSON.parse(localStorage.getItem(STORAGE.history) || '[]'); } catch { history = []; }
    history.unshift({ id: Date.now(), date: new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }), score: result.score, correct: result.correct, total: TOTAL_QUESTIONS, accuracy: result.accuracy, duration: result.duration, iqLocked: data.iqUnlocked !== true });
    localStorage.setItem(STORAGE.history, JSON.stringify(history.slice(0, 20)));
    event.currentTarget.textContent = '저장 완료'; event.currentTarget.disabled = true;
  });
}
function initHistory() {
  let history = []; try { history = JSON.parse(localStorage.getItem(STORAGE.history) || '[]'); } catch { history = []; }
  if (!history.length) { document.getElementById('empty-history').hidden = false; return; }
  document.getElementById('history-list').innerHTML = history.map((item) => `<article class="history-item"><span>${item.date}</span><strong>${item.score}<small>점</small></strong><span>${item.correct ?? Math.round((item.score * (item.total ?? TOTAL_QUESTIONS)) / MAX_SCORE)} / ${item.total ?? TOTAL_QUESTIONS}</span><span>${formatPercentage(item.accuracy)}</span></article>`).join('');
  document.getElementById('history-chart-card').hidden = false;
  const points = history.slice(0, 7).reverse(); const denominator = Math.max(points.length - 1, 1);
  const chartPoints = points.map((item, index) => `${15 + index * 260 / denominator},${118 - item.score}`).join(' ');
  document.getElementById('history-chart').innerHTML = `<svg viewBox="0 0 290 140" aria-label="최근 점수 변화"><path d="M15 118H275M15 68H275M15 18H275"/><polyline points="${chartPoints}"/>${points.map((item, index) => `<circle cx="${15 + index * 260 / denominator}" cy="${118 - item.score}" r="5"><title>${item.score}점</title></circle>`).join('')}</svg>`;
}
document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  document.querySelectorAll('.premium-button').forEach((button) => button.addEventListener('click', () => { button.textContent = '결제 기능은 아직 준비 중입니다'; button.disabled = true; }));
  const page = document.body.dataset.page;
  if (page === 'home') sessionStorage.removeItem(STORAGE.session);
  if (page === 'test') initTest();
  if (page === 'result') initResult();
  if (page === 'history') initHistory();
});