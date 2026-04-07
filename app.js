(function () {
  'use strict';

  const BANKS_REGISTRY_KEY = 'quiz_banks_registry';
  const BANK_DATA_PREFIX = 'quiz_bank_';
  const STATE_PREFIX = 'quiz_state_';
  const ACTIVE_BANK_KEY = 'quiz_active_bank';
  const RUN_CHATS_PREFIX = 'quiz_run_chats_';
  const MAX_REPORT_ITEMS = 80;
  const MAX_JUST_LEN = 800;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let activeBankSlug = null;
  let allQuestions = [];
  let domains = [];
  let storageKey = '';
  let state = defaultState();
  let activeQuestions = [];
  let currentIndex = 0;

  const builtinBankData = {};

  let chatHistory = [];
  let chatAbortController = null;
  let currentChatQuestion = null;

  const AI_CHAT_TOGGLE_EXPLAIN = 'Ask AI to Explain';
  const AI_CHAT_TOGGLE_ANYTHING = 'Ask AI anything';

  marked.setOptions({ breaks: true, gfm: true });

  // --- Utilities ---

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  function defaultState() {
    return {
      answers: {},
      missed: [],
      score: 0,
      totalAnswered: 0,
      domain: 'all',
      mode: 'sequential',
      currentIndex: 0,
      reviewMode: false,
      shuffleOrder: null,
      runId: null,
      runAnswers: {},
      skipAnswered: true,
      wrongOnly: false,
      wrongOnlyIds: null,
    };
  }

  function questionIdKey(id) {
    return String(id);
  }

  function hasSavedAnswer(q) {
    const key = questionIdKey(q.id);
    return Object.prototype.hasOwnProperty.call(state.answers, key);
  }

  function wasAnsweredWrong(q) {
    const rec = state.answers[questionIdKey(q.id)];
    return Boolean(rec && rec.correct === false);
  }

  function clearAnswerRecordById(id) {
    const key = questionIdKey(id);
    if (!Object.prototype.hasOwnProperty.call(state.answers, key)) return;
    const ans = state.answers[key];
    delete state.answers[key];
    state.totalAnswered = Math.max(0, state.totalAnswered - 1);
    if (ans.correct) {
      state.score = Math.max(0, state.score - 1);
    } else {
      state.missed = state.missed.filter((mid) => questionIdKey(mid) !== key);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...defaultState(), ...JSON.parse(raw) };
    } catch (_) {}
    return defaultState();
  }

  function saveState() {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function runChatsStorageKey() {
    return RUN_CHATS_PREFIX + activeBankSlug;
  }

  function clearRunChatStorage() {
    if (!activeBankSlug) return;
    localStorage.removeItem(runChatsStorageKey());
  }

  function loadRunChatStore() {
    if (!activeBankSlug || !state.runId) return null;
    try {
      const raw = localStorage.getItem(runChatsStorageKey());
      if (!raw) return { runId: state.runId, chatsByQuestionId: {} };
      const parsed = JSON.parse(raw);
      if (parsed.runId !== state.runId) return { runId: state.runId, chatsByQuestionId: {} };
      if (!parsed.chatsByQuestionId || typeof parsed.chatsByQuestionId !== 'object') {
        return { runId: state.runId, chatsByQuestionId: {} };
      }
      return parsed;
    } catch (_) {
      return { runId: state.runId, chatsByQuestionId: {} };
    }
  }

  function saveRunChatStore(store) {
    if (!activeBankSlug || !state.runId) return;
    localStorage.setItem(runChatsStorageKey(), JSON.stringify(store));
  }

  function flushRunChatToStorage(questionId) {
    if (!questionId || !state.runId || chatHistory.length === 0) return;
    const store = loadRunChatStore() || { runId: state.runId, chatsByQuestionId: {} };
    store.runId = state.runId;
    store.chatsByQuestionId[questionId] = JSON.parse(JSON.stringify(chatHistory));
    saveRunChatStore(store);
  }

  function loadRunChatMessages(questionId) {
    if (!questionId || !state.runId) return null;
    const store = loadRunChatStore();
    if (!store) return null;
    const msgs = store.chatsByQuestionId[questionId];
    return msgs && msgs.length ? msgs : null;
  }

  function beginNewQuizRun() {
    state.runId = String(Date.now());
    state.runAnswers = {};
    clearRunChatStorage();
    updateSessionReportButtons();
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // --- Bank Management ---


  function getBanksRegistry() {
    try {
      const raw = localStorage.getItem(BANKS_REGISTRY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function saveBanksRegistry(registry) {
    localStorage.setItem(BANKS_REGISTRY_KEY, JSON.stringify(registry));
  }

  function registerBuiltinBank(data) {
    const title = data.meta.title;
    const slug = slugify(title);
    builtinBankData[slug] = data;
    const registry = getBanksRegistry();
    if (!registry.find((b) => b.slug === slug)) {
      registry.push({ slug, title, builtin: true });
      saveBanksRegistry(registry);
    }
    return slug;
  }

  function registerCustomBank(data) {
    const title = data.meta.title;
    const slug = slugify(title);
    const registry = getBanksRegistry();

    const existing = registry.find((b) => b.slug === slug);
    if (existing) {
      existing.title = title;
      existing.builtin = false;
    } else {
      registry.push({ slug, title, builtin: false });
    }
    saveBanksRegistry(registry);
    localStorage.setItem(BANK_DATA_PREFIX + slug, JSON.stringify(data));
    return slug;
  }

  function removeBank(slug) {
    let registry = getBanksRegistry();
    const bank = registry.find((b) => b.slug === slug);
    if (!bank || bank.builtin) return false;

    registry = registry.filter((b) => b.slug !== slug);
    saveBanksRegistry(registry);
    localStorage.removeItem(BANK_DATA_PREFIX + slug);
    localStorage.removeItem(STATE_PREFIX + slug);
    localStorage.removeItem(RUN_CHATS_PREFIX + slug);
    return true;
  }

  function getBankData(slug) {
    const registry = getBanksRegistry();
    const bank = registry.find((b) => b.slug === slug);
    if (!bank) return null;

    if (bank.builtin) return builtinBankData[slug] || null;

    try {
      const raw = localStorage.getItem(BANK_DATA_PREFIX + slug);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function activateBank(slug) {
    const data = getBankData(slug);
    if (!data) return false;

    activeBankSlug = slug;
    storageKey = STATE_PREFIX + slug;
    allQuestions = data.questions;
    domains = data.meta.domains;
    state = loadState();
    if (!state.wrongOnly) {
      state.wrongOnlyIds = null;
    }

    $('#appTitle').textContent = data.meta.title;
    document.title = data.meta.title;

    populateDomainSelect();
    $('#domainSelect').value = state.domain;
    $('#modeSelect').value = state.mode;
    const skipEl = $('#skipAnsweredCheck');
    if (skipEl) skipEl.checked = state.skipAnswered !== false;
    const wrongEl = $('#wrongOnlyCheck');
    if (wrongEl) wrongEl.checked = state.wrongOnly === true;
    updateScoreDisplay();
    updateMissedButton();
    updateRemoveBankButton();
    updateSessionReportButtons();

    localStorage.setItem(ACTIVE_BANK_KEY, slug);
    return true;
  }

  function parseQuestionsFile(text) {
    try {
      const fn = new Function(text + '\nreturn QUESTIONS_DATA;');
      return fn();
    } catch (_) {
      return null;
    }
  }

  function validateBankData(data) {
    if (!data || typeof data !== 'object') return 'File did not produce valid data.';
    if (!data.meta || typeof data.meta !== 'object') return 'Missing "meta" section.';
    if (!data.meta.title || typeof data.meta.title !== 'string') return 'Missing "meta.title".';
    if (!Array.isArray(data.meta.domains) || data.meta.domains.length === 0) return 'Missing or empty "meta.domains".';
    if (!Array.isArray(data.questions) || data.questions.length === 0) return 'Missing or empty "questions" array.';
    const sample = data.questions[0];
    if (!sample.id || !sample.question || !sample.options || !sample.correctAnswer) {
      return 'Questions are missing required fields (id, question, options, correctAnswer).';
    }
    return null;
  }

  function migrateOldState() {
    const old = localStorage.getItem('aaia_quiz_state');
    if (!old) return;
    const slug = slugify('ISACA AAIA QAE Database');
    const newKey = STATE_PREFIX + slug;
    if (!localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, old);
    }
    localStorage.removeItem('aaia_quiz_state');
  }

  // --- UI: Bank selector ---

  function populateBankSelect() {
    const sel = $('#bankSelect');
    const registry = getBanksRegistry();
    sel.innerHTML = '';

    registry.forEach((bank) => {
      const data = getBankData(bank.slug);
      const count = data ? data.questions.length : '?';
      const opt = document.createElement('option');
      opt.value = bank.slug;
      opt.textContent = `${bank.title} (${count} questions)`;
      sel.appendChild(opt);
    });

    if (activeBankSlug) {
      sel.value = activeBankSlug;
    }
  }

  function updateRemoveBankButton() {
    const registry = getBanksRegistry();
    const bank = registry.find((b) => b.slug === activeBankSlug);
    $('#removeBankBtn').disabled = !bank || bank.builtin;
  }

  function handleBankChange() {
    const slug = $('#bankSelect').value;
    if (slug && slug !== activeBankSlug) {
      activateBank(slug);
    }
  }

  function handleBankFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const data = parseQuestionsFile(evt.target.result);
      const error = validateBankData(data);
      if (error) {
        alert('Invalid question bank file:\n' + error);
        return;
      }

      const slug = registerCustomBank(data);
      populateBankSelect();
      activateBank(slug);
      $('#bankSelect').value = slug;
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleRemoveBank() {
    const registry = getBanksRegistry();
    const bank = registry.find((b) => b.slug === activeBankSlug);
    if (!bank || bank.builtin) return;

    if (!confirm(`Remove "${bank.title}"? This will also delete your progress for this bank.`)) return;

    removeBank(activeBankSlug);
    const firstBuiltin = registry.find((b) => b.builtin && b.slug !== activeBankSlug);
    const fallbackSlug = firstBuiltin ? firstBuiltin.slug : getBanksRegistry()[0]?.slug;
    populateBankSelect();
    if (fallbackSlug) {
      activateBank(fallbackSlug);
      $('#bankSelect').value = fallbackSlug;
    }
  }

  // --- UI: Domain selector ---

  function populateDomainSelect() {
    const sel = $('#domainSelect');
    sel.innerHTML = '<option value="all">All Domains</option>';

    domains.forEach((d) => {
      const count = allQuestions.filter((q) => q.domain === d).length;
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `${d} (${count})`;
      sel.appendChild(opt);
    });
  }

  // --- Screens ---

  function showScreen(name) {
    $$('.screen').forEach((s) => (s.hidden = true));
    $(`#${name}Screen`).hidden = false;
  }

  // --- Quiz Logic ---

  function getBaseFilteredQuestions() {
    let qs = allQuestions;
    if (state.domain !== 'all') {
      qs = qs.filter((q) => q.domain === state.domain);
    }
    if (state.reviewMode) {
      qs = qs.filter((q) => state.missed.includes(q.id));
    } else if (state.wrongOnly) {
      const ids = state.wrongOnlyIds;
      if (ids && ids.length > 0) {
        const idSet = new Set(ids.map((id) => questionIdKey(id)));
        qs = qs.filter((q) => idSet.has(questionIdKey(q.id)));
      } else {
        qs = qs.filter((q) => wasAnsweredWrong(q));
      }
    }
    return qs;
  }

  function getFilteredQuestions() {
    let qs = getBaseFilteredQuestions();
    if (state.skipAnswered && !state.reviewMode && !state.wrongOnly) {
      qs = qs.filter((q) => !hasSavedAnswer(q));
    }
    return qs;
  }

  function buildActiveQuestions() {
    let qs = getFilteredQuestions();
    if (state.mode === 'random') {
      if (state.shuffleOrder && state.shuffleOrder.length === qs.length) {
        const idMap = new Map(qs.map((q) => [questionIdKey(q.id), q]));
        qs = state.shuffleOrder
          .map((id) => idMap.get(questionIdKey(id)))
          .filter(Boolean);
      } else {
        qs = shuffle([...qs]);
        state.shuffleOrder = qs.map((q) => q.id);
      }
    } else {
      state.shuffleOrder = null;
    }
    return qs;
  }

  function startQuiz() {
    const newDomain = $('#domainSelect').value;
    const newMode = $('#modeSelect').value;
    const skipEl = $('#skipAnsweredCheck');
    const wrongEl = $('#wrongOnlyCheck');
    state.skipAnswered = skipEl ? skipEl.checked : true;
    const newWrongOnly = wrongEl ? wrongEl.checked : false;

    let domainQs = allQuestions;
    if (newDomain !== 'all') {
      domainQs = domainQs.filter((q) => q.domain === newDomain);
    }

    let wrongIdsForRun = null;
    if (newWrongOnly) {
      wrongIdsForRun = domainQs.filter(wasAnsweredWrong).map((q) => q.id);
      if (wrongIdsForRun.length === 0) {
        alert(
          'No incorrectly answered questions in this domain. Answer questions or import progress first, or try another domain.'
        );
        return;
      }
      for (const id of wrongIdsForRun) {
        clearAnswerRecordById(id);
      }
    }

    if (newDomain !== state.domain || newMode !== state.mode || newWrongOnly !== state.wrongOnly || newWrongOnly) {
      state.currentIndex = 0;
    }
    state.domain = newDomain;
    state.mode = newMode;
    state.wrongOnly = newWrongOnly;
    state.wrongOnlyIds = newWrongOnly ? wrongIdsForRun : null;
    state.reviewMode = false;
    state.shuffleOrder = null;
    saveState();

    activeQuestions = buildActiveQuestions();
    if (activeQuestions.length === 0) {
      const base = getBaseFilteredQuestions();
      if (state.wrongOnly && domainQs.length > 0) {
        alert(
          'No incorrectly answered questions in this domain. Answer questions or import progress first, or try another domain.'
        );
      } else if (base.length > 0) {
        alert(
          'No unanswered questions for this bank and domain. Turn off "Skip questions I\'ve already answered" to review them, or use Reset to clear progress.'
        );
      } else {
        alert('No questions available for the selected filters.');
      }
      return;
    }

    beginNewQuizRun();
    currentIndex = state.currentIndex < activeQuestions.length ? state.currentIndex : 0;
    showScreen('quiz');
    saveState();
    renderQuestion();
  }

  function startMissedReview() {
    if (state.missed.length === 0) return;
    state.domain = $('#domainSelect').value;
    state.mode = $('#modeSelect').value;
    state.reviewMode = true;
    state.wrongOnlyIds = null;
    state.shuffleOrder = null;
    saveState();

    activeQuestions = buildActiveQuestions();
    if (activeQuestions.length === 0) {
      alert('No missed questions to review.');
      state.reviewMode = false;
      return;
    }
    beginNewQuizRun();
    currentIndex = 0;
    showScreen('quiz');
    saveState();
    renderQuestion();
  }

  function renderQuestion() {
    if (currentIndex >= activeQuestions.length) {
      const last = activeQuestions[currentIndex - 1];
      if (last) flushRunChatToStorage(last.id);
      showSummary();
      return;
    }

    resetChat();

    const q = activeQuestions[currentIndex];
    const answered = state.answers[q.id];

    $('#questionText').textContent = q.question;
    $('#domainBadge').textContent = q.domain;
    $('#questionCounter').textContent = `Question ${currentIndex + 1} of ${activeQuestions.length}`;

    const answeredCount = activeQuestions.filter((aq) => state.answers[aq.id]).length;
    const pct = activeQuestions.length > 0 ? (answeredCount / activeQuestions.length) * 100 : 0;
    $('#progressBar').style.width = pct + '%';

    const container = $('#optionsContainer');
    container.innerHTML = '';

    ['A', 'B', 'C', 'D'].forEach((letter) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.letter = letter;

      const letterSpan = document.createElement('span');
      letterSpan.className = 'option-letter';
      letterSpan.textContent = letter;

      const textSpan = document.createElement('span');
      textSpan.textContent = q.options[letter];

      btn.appendChild(letterSpan);
      btn.appendChild(textSpan);

      if (answered) {
        btn.disabled = true;
        if (letter === q.correctAnswer) {
          btn.classList.add(answered.selected === letter ? 'correct' : 'neutral-correct');
        } else if (letter === answered.selected && !answered.correct) {
          btn.classList.add('wrong');
        }
      } else {
        btn.addEventListener('click', () => selectAnswer(q, letter));
      }

      container.appendChild(btn);
    });

    if (answered) {
      showFeedback(q, answered);
    } else {
      $('#feedbackContainer').hidden = true;
    }

    $('#prevBtn').disabled = currentIndex === 0;
    const clearBtn = $('#clearAnswerBtn');
    if (clearBtn) clearBtn.disabled = !answered;

    updateScoreDisplay();
    updateMissedButton();
    saveState();
  }

  function clearCurrentAnswer() {
    if (currentIndex < 0 || currentIndex >= activeQuestions.length) return;
    const q = activeQuestions[currentIndex];
    const ans = state.answers[q.id];
    if (!ans) return;

    delete state.answers[q.id];
    if (state.runId && state.runAnswers) {
      delete state.runAnswers[q.id];
    }
    state.totalAnswered = Math.max(0, state.totalAnswered - 1);
    if (ans.correct) {
      state.score = Math.max(0, state.score - 1);
    } else {
      state.missed = state.missed.filter((id) => id !== q.id);
    }

    if (activeBankSlug && state.runId) {
      const store = loadRunChatStore();
      if (store?.chatsByQuestionId) {
        const key = String(q.id);
        if (store.chatsByQuestionId[key] !== undefined) {
          delete store.chatsByQuestionId[key];
          saveRunChatStore(store);
        }
      }
    }

    saveState();
    updateSessionReportButtons();
    renderQuestion();
  }

  function selectAnswer(q, letter) {
    const isCorrect = letter === q.correctAnswer;
    state.answers[q.id] = { selected: letter, correct: isCorrect };
    if (state.runId) {
      state.runAnswers[q.id] = { selected: letter, correct: isCorrect };
    }
    state.totalAnswered++;
    if (isCorrect) {
      state.score++;
      if (state.missed.includes(q.id)) {
        state.missed = state.missed.filter((id) => id !== q.id);
      }
    } else {
      if (!state.missed.includes(q.id)) {
        state.missed.push(q.id);
      }
    }

    saveState();
    updateSessionReportButtons();
    renderQuestion();
  }

  function showFeedback(q, answered) {
    $('#feedbackContainer').hidden = false;

    const banner = $('#feedbackBanner');
    if (answered.correct) {
      banner.className = 'feedback-banner correct';
      banner.textContent = 'Correct!';
    } else {
      banner.className = 'feedback-banner wrong';
      banner.textContent = `Incorrect. The correct answer is ${q.correctAnswer}.`;
    }

    const list = $('#justificationsList');
    list.innerHTML = '';

    ['A', 'B', 'C', 'D'].forEach((letter) => {
      const justText = q.justifications[letter];
      if (!justText) return;

      const item = document.createElement('div');
      item.className = 'justification-item';
      if (letter === q.correctAnswer) item.classList.add('is-correct');

      const letterSpan = document.createElement('span');
      letterSpan.className = 'justification-letter';
      letterSpan.textContent = letter + '.';

      item.appendChild(letterSpan);
      item.appendChild(document.createTextNode(' ' + justText));
      list.appendChild(item);
    });

    resetChat();
    $('#aiChatSection').hidden = false;
    $('#aiChatToggle').hidden = false;
    $('#aiChatToggle').textContent = answered.correct ? AI_CHAT_TOGGLE_ANYTHING : AI_CHAT_TOGGLE_EXPLAIN;
    currentChatQuestion = { q, selected: answered.selected, correct: answered.correct };
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      const leaving = activeQuestions[currentIndex];
      if (leaving) flushRunChatToStorage(leaving.id);
      currentIndex--;
      state.currentIndex = currentIndex;
      renderQuestion();
    }
  }

  function nextQuestion() {
    const leaving = activeQuestions[currentIndex];
    if (leaving) flushRunChatToStorage(leaving.id);
    currentIndex++;
    state.currentIndex = currentIndex;
    if (currentIndex >= activeQuestions.length) {
      showSummary();
    } else {
      renderQuestion();
    }
  }

  function getBankWideCorrectStats() {
    const total = allQuestions.length;
    if (total === 0) return { correct: 0, total: 0, pct: null };
    let correct = 0;
    for (const q of allQuestions) {
      if (state.answers[q.id]?.correct) correct++;
    }
    return { correct, total, pct: Math.round((correct / total) * 100) };
  }

  function updateScoreDisplay() {
    const total = state.totalAnswered;
    const correct = state.score;
    $('#scoreText').textContent = `${correct}/${total} correct`;

    const pctEl = $('#scorePercent');
    if (total > 0) {
      pctEl.textContent = `\u2014 ${Math.round((correct / total) * 100)}%`;
    } else {
      pctEl.textContent = '';
    }

    const bankWrap = $('#bankWideScore');
    const bankText = $('#bankWideScoreText');
    const bankPct = $('#bankWideScorePercent');
    if (!bankWrap || !bankText || !bankPct) return;

    const bw = getBankWideCorrectStats();
    if (bw.total === 0) {
      bankWrap.hidden = true;
      bankText.textContent = '';
      bankPct.textContent = '';
    } else {
      bankWrap.hidden = false;
      bankText.textContent = `${bw.correct}/${bw.total} correct`;
      bankPct.textContent = `\u2014 ${bw.pct}%`;
    }
  }

  function updateMissedButton() {
    const count = state.missed.length;
    $('#missedCount').textContent = count;
    $('#missedBtn').dataset.count = count;
  }

  function updateSessionReportButtons() {
    const ra = state.runAnswers;
    const n = ra && typeof ra === 'object' ? Object.keys(ra).length : 0;
    const enabled = n > 0;
    const quizBtn = $('#sessionReportBtn');
    const sumBtn = $('#sessionReportSummaryBtn');
    if (quizBtn) quizBtn.disabled = !enabled;
    if (sumBtn) sumBtn.disabled = !enabled;
  }

  function showSummary() {
    showScreen('summary');

    const total = state.totalAnswered;
    const correct = state.score;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    $('#summaryScore').innerHTML =
      `${correct} / ${total}` +
      `<span class="summary-pct">${pct}% correct</span>`;

    const breakdown = $('#summaryBreakdown');
    breakdown.innerHTML = '';

    for (const domain of domains) {
      const domainQs = allQuestions.filter((q) => q.domain === domain);
      const domainAnswered = domainQs.filter((q) => state.answers[q.id]);
      const domainCorrect = domainAnswered.filter((q) => state.answers[q.id]?.correct).length;
      const domainTotal = domainAnswered.length;
      const domainPct = domainTotal > 0 ? Math.round((domainCorrect / domainTotal) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'summary-domain-row';
      row.innerHTML =
        `<span class="summary-domain-name">${domain}</span>` +
        `<span class="summary-domain-score">${domainCorrect}/${domainTotal} (${domainPct}%)</span>`;
      breakdown.appendChild(row);
    }

    if (state.missed.length > 0) {
      const missedRow = document.createElement('div');
      missedRow.className = 'summary-missed-row';
      missedRow.innerHTML =
        `<span>Missed Questions</span>` +
        `<span>${state.missed.length}</span>`;
      breakdown.appendChild(missedRow);
    }

    $('#retryMissedBtn').disabled = state.missed.length === 0;
    updateSessionReportButtons();
  }

  function retryAll() {
    state.answers = {};
    state.score = 0;
    state.totalAnswered = 0;
    state.currentIndex = 0;
    state.reviewMode = false;
    state.wrongOnly = false;
    state.wrongOnlyIds = null;
    state.shuffleOrder = null;
    const wrongReset = $('#wrongOnlyCheck');
    if (wrongReset) wrongReset.checked = false;
    beginNewQuizRun();
    activeQuestions = buildActiveQuestions();
    currentIndex = 0;
    showScreen('quiz');
    saveState();
    renderQuestion();
  }

  function retryMissed() {
    const missedIds = [...state.missed];
    for (const id of missedIds) {
      delete state.answers[id];
    }
    state.currentIndex = 0;
    state.reviewMode = true;
    state.shuffleOrder = null;
    beginNewQuizRun();
    activeQuestions = buildActiveQuestions();
    currentIndex = 0;
    showScreen('quiz');
    saveState();
    renderQuestion();
  }

  function backToSetup() {
    state.currentIndex = 0;
    state.reviewMode = false;
    state.wrongOnlyIds = null;
    currentIndex = 0;
    saveState();
    showScreen('setup');
  }

  function resetProgress() {
    if (!confirm('Reset all progress? This will clear your score, answers, and missed questions list.')) return;
    state = defaultState();
    currentIndex = 0;
    clearRunChatStorage();
    saveState();
    const skipReset = $('#skipAnsweredCheck');
    if (skipReset) skipReset.checked = state.skipAnswered !== false;
    const wrongReset = $('#wrongOnlyCheck');
    if (wrongReset) wrongReset.checked = state.wrongOnly === true;
    updateScoreDisplay();
    updateMissedButton();
    updateSessionReportButtons();
    showScreen('setup');
  }

  function triggerProgressDownload() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBankSlug}-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveProgress() {
    triggerProgressDownload();
  }

  function saveProgressAndExit() {
    saveState();
    triggerProgressDownload();
    setTimeout(() => backToSetup(), 50);
  }

  function importProgress(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const imported = JSON.parse(evt.target.result);
        state = { ...defaultState(), ...imported };
        saveState();
        updateScoreDisplay();
        updateMissedButton();
        updateSessionReportButtons();
        const skipImp = $('#skipAnsweredCheck');
        if (skipImp) skipImp.checked = state.skipAnswered !== false;
        const wrongImp = $('#wrongOnlyCheck');
        if (wrongImp) wrongImp.checked = state.wrongOnly === true;
        alert('Progress imported successfully.');
      } catch (_) {
        alert('Invalid file. Please select a valid progress JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // --- AI Chat ---

  function resetChat() {
    chatHistory = [];
    currentChatQuestion = null;
    if (chatAbortController) {
      chatAbortController.abort();
      chatAbortController = null;
    }
    $('#aiChatSection').hidden = true;
    $('#aiChatPanel').hidden = true;
    $('#aiChatMessages').innerHTML = '';
    $('#aiChatInput').value = '';
    $('#aiChatToggle').textContent = AI_CHAT_TOGGLE_EXPLAIN;
  }

  function buildSystemPrompt(q, selectedAnswer, wasCorrect) {
    const optionsText = ['A', 'B', 'C', 'D']
      .map((l) => `${l}. ${q.options[l]}`)
      .join('\n');
    const justText = ['A', 'B', 'C', 'D']
      .filter((l) => q.justifications[l])
      .map((l) => `${l}. ${q.justifications[l]}`)
      .join('\n');

    const context = wasCorrect
      ? 'The student answered correctly. Help them deepen their understanding of the concept.'
      : 'The student answered incorrectly. Help them understand why their answer was wrong and why the correct answer is right.';

    return [
      'You are a helpful tutor for the ISACA AAIA (Artificial Intelligence Audit) certification exam.',
      context,
      'Be concise but thorough. Use simple language. If helpful, give real-world analogies.',
      '',
      `Domain: ${q.domain}`,
      '',
      `Question: ${q.question}`,
      '',
      'Options:',
      optionsText,
      '',
      `Correct answer: ${q.correctAnswer}`,
      `Student selected: ${selectedAnswer}`,
      '',
      'Justifications provided:',
      justText,
    ].join('\n');
  }

  function removeAiChatHint() {
    $('#aiChatMessages')?.querySelector('.ai-chat-hint')?.remove();
  }

  function appendCorrectAnswerChatHint() {
    const container = $('#aiChatMessages');
    const hint = document.createElement('p');
    hint.className = 'ai-chat-hint';
    hint.textContent = 'Ask anything about this question.';
    container.appendChild(hint);
    container.scrollTop = container.scrollHeight;
  }

  function appendChatMessage(role, text) {
    const container = $('#aiChatMessages');
    const bubble = document.createElement('div');
    bubble.className = `ai-chat-bubble ai-chat-${role}`;
    if (role === 'assistant' && text) {
      bubble.innerHTML = marked.parse(text);
    } else {
      bubble.textContent = text;
    }
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function setInputEnabled(enabled) {
    $('#aiChatInput').disabled = !enabled;
    $('#aiChatSend').disabled = !enabled;
  }

  async function streamChatResponse() {
    const systemPrompt = buildSystemPrompt(currentChatQuestion.q, currentChatQuestion.selected, currentChatQuestion.correct);
    const bubble = appendChatMessage('assistant', '');
    bubble.classList.add('loading');
    setInputEnabled(false);

    chatAbortController = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, systemPrompt }),
        signal: chatAbortController.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = JSON.parse(line.slice(6));

          if (payload.type === 'text') {
            fullText += payload.text;
            bubble.innerHTML = marked.parse(fullText);
            bubble.classList.remove('loading');
            $('#aiChatMessages').scrollTop = $('#aiChatMessages').scrollHeight;
          } else if (payload.type === 'error') {
            bubble.textContent = 'Error: ' + payload.error;
            bubble.classList.remove('loading');
            bubble.classList.add('ai-chat-error');
          }
        }
      }

      if (fullText) {
        chatHistory.push({ role: 'assistant', content: fullText });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        bubble.textContent = 'Failed to connect. Is the server running?';
        bubble.classList.remove('loading');
        bubble.classList.add('ai-chat-error');
      }
    } finally {
      chatAbortController = null;
      setInputEnabled(true);
      $('#aiChatInput').focus();
    }
  }

  function openAiChat() {
    const { q, selected, correct } = currentChatQuestion;
    const saved = loadRunChatMessages(q.id);

    $('#aiChatPanel').hidden = false;
    $('#aiChatMessages').innerHTML = '';
    $('#aiChatToggle').hidden = true;

    if (saved && saved.length > 0) {
      chatHistory = saved.map((m) => ({ role: m.role, content: m.content }));
      for (const m of chatHistory) {
        appendChatMessage(m.role, m.content);
      }
      $('#aiChatInput').focus();
      return;
    }

    chatHistory = [];

    if (correct) {
      appendCorrectAnswerChatHint();
      $('#aiChatInput').focus();
      return;
    }

    const userMsg = `I chose ${selected} but the correct answer is ${q.correctAnswer}. Can you explain why ${q.correctAnswer} is correct and why ${selected} is wrong?`;

    chatHistory.push({ role: 'user', content: userMsg });
    appendChatMessage('user', userMsg);
    streamChatResponse();
  }

  function sendChatMessage() {
    const input = $('#aiChatInput');
    const text = input.value.trim();
    if (!text || !currentChatQuestion) return;

    removeAiChatHint();
    input.value = '';
    chatHistory.push({ role: 'user', content: text });
    appendChatMessage('user', text);
    streamChatResponse();
  }

  function trimJustificationsForReport(justifications) {
    const out = {};
    ['A', 'B', 'C', 'D'].forEach((letter) => {
      const t = justifications[letter];
      if (!t) return;
      out[letter] =
        t.length > MAX_JUST_LEN ? t.slice(0, MAX_JUST_LEN) + '\n[truncated]' : t;
    });
    return out;
  }

  function buildSessionReportPayload() {
    const bankTitle = getBankData(activeBankSlug)?.meta?.title || document.title;
    const ids = Object.keys(state.runAnswers || {});
    // Object.keys are strings; bank question ids may be numbers — Map must use one canonical key type.
    const idMap = new Map(allQuestions.map((qq) => [questionIdKey(qq.id), qq]));
    const store = loadRunChatStore();
    const chatsByQuestionId = store?.chatsByQuestionId || {};
    let items = ids
      .map((id) => {
        const key = questionIdKey(id);
        const q = idMap.get(key);
        if (!q) return null;
        const ans = state.runAnswers[id];
        const aiMessages = chatsByQuestionId[key] || [];
        return {
          id,
          domain: q.domain,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          selected: ans.selected,
          correct: ans.correct,
          justifications: trimJustificationsForReport(q.justifications || {}),
          aiMessages,
        };
      })
      .filter(Boolean);
    const truncated = items.length > MAX_REPORT_ITEMS;
    if (truncated) {
      items = items.slice(0, MAX_REPORT_ITEMS);
    }
    const runCorrect = ids.filter((id) => state.runAnswers[id]?.correct).length;
    return {
      bankTitle,
      runId: state.runId,
      generatedAt: new Date().toISOString(),
      progress: {
        runQuestionsAnswered: ids.length,
        runCorrect,
        runIncorrect: ids.length - runCorrect,
        domainFilter: state.domain === 'all' ? 'All domains' : state.domain,
        reviewMode: state.reviewMode,
      },
      items,
      truncated,
      truncatedNote: truncated
        ? `Only the first ${MAX_REPORT_ITEMS} questions in this run were sent (size limit).`
        : undefined,
    };
  }

  async function downloadSessionReportMd() {
    if (!state.runId || Object.keys(state.runAnswers || {}).length === 0) {
      alert(
        'No questions in this quiz run yet. Start or continue a quiz and answer at least one question, then try again.'
      );
      return;
    }
    const payload = buildSessionReportPayload();
    if (!payload.items || payload.items.length === 0) {
      alert(
        'Could not match this run to question data (try reloading the page). If the problem continues, start a new quiz run.'
      );
      return;
    }
    const buttons = [$('#sessionReportBtn'), $('#sessionReportSummaryBtn')].filter(Boolean);
    const overlay = $('#sessionReportWaitOverlay');
    if (overlay) {
      overlay.hidden = false;
      document.body.classList.add('session-report-wait-active');
    }
    buttons.forEach((b) => {
      b.disabled = true;
      b.classList.add('btn-loading');
    });
    try {
      const res = await fetch('/api/generate-session-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || `Could not generate report (${res.status}).`);
        return;
      }
      if (!data.markdown) {
        alert('Unexpected response from server.');
        return;
      }
      const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeBankSlug}-session-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      alert('Failed to connect. Is the server running?');
    } finally {
      if (overlay) {
        overlay.hidden = true;
        document.body.classList.remove('session-report-wait-active');
      }
      buttons.forEach((b) => b.classList.remove('btn-loading'));
      updateSessionReportButtons();
    }
  }

  // --- Init ---

  async function loadBuiltinBanks() {
    try {
      const res = await fetch('/api/question-banks');
      const banks = await res.json();

      for (const bank of banks) {
        const fileRes = await fetch(`/questions/${bank.filename}`);
        const text = await fileRes.text();
        const data = parseQuestionsFile(text);
        if (data && !validateBankData(data)) {
          registerBuiltinBank(data);
        }
      }
    } catch (err) {
      console.error('Failed to load question banks from server:', err);
    }
  }

  async function init() {
    migrateOldState();
    await loadBuiltinBanks();

    const registry = getBanksRegistry();
    const lastActive = localStorage.getItem(ACTIVE_BANK_KEY);
    const startSlug = registry.find((b) => b.slug === lastActive)
      ? lastActive
      : registry[0]?.slug;

    populateBankSelect();
    if (startSlug) {
      activateBank(startSlug);
      $('#bankSelect').value = activeBankSlug;
    }

    $('#bankSelect').addEventListener('change', handleBankChange);
    $('#loadBankBtn').addEventListener('click', () => $('#bankFile').click());
    $('#bankFile').addEventListener('change', handleBankFileLoad);
    $('#removeBankBtn').addEventListener('click', handleRemoveBank);

    const skipAnsweredEl = $('#skipAnsweredCheck');
    if (skipAnsweredEl) {
      skipAnsweredEl.addEventListener('change', () => {
        if (!storageKey) return;
        state.skipAnswered = skipAnsweredEl.checked;
        saveState();
      });
    }

    const wrongOnlyEl = $('#wrongOnlyCheck');
    if (wrongOnlyEl) {
      wrongOnlyEl.addEventListener('change', () => {
        if (!storageKey) return;
        state.wrongOnly = wrongOnlyEl.checked;
        saveState();
      });
    }

    $('#startBtn').addEventListener('click', startQuiz);
    $('#prevBtn').addEventListener('click', prevQuestion);
    $('#nextBtn').addEventListener('click', nextQuestion);
    $('#clearAnswerBtn').addEventListener('click', clearCurrentAnswer);
    $('#resetBtn').addEventListener('click', resetProgress);
    $('#saveBtn').addEventListener('click', saveProgress);
    $('#saveExitBtn').addEventListener('click', saveProgressAndExit);
    $('#exitBtn').addEventListener('click', backToSetup);
    $('#sessionReportBtn').addEventListener('click', downloadSessionReportMd);
    $('#sessionReportSummaryBtn').addEventListener('click', downloadSessionReportMd);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', importProgress);
    $('#missedBtn').addEventListener('click', startMissedReview);
    $('#retryAllBtn').addEventListener('click', retryAll);
    $('#retryMissedBtn').addEventListener('click', retryMissed);
    $('#backToSetupBtn').addEventListener('click', backToSetup);

    $('#aiChatToggle').addEventListener('click', () => {
      if (currentChatQuestion) {
        openAiChat();
      }
    });
    $('#aiChatSend').addEventListener('click', sendChatMessage);
    $('#aiChatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });

    showScreen('setup');
  }

  init();
})();
