import { validateFeedback } from './validation.js';
import { createApi, resolveMode, SDK_URL } from './api.js';

const cfg = window.FEEDBACK_CONFIG || {};
const byId = (id) => document.getElementById(id);

const els = {
  form: byId('feedback-form'),
  content: byId('content'),
  name: byId('name'),
  course: byId('course'),
  website: byId('website'),
  counter: byId('content-count'),
  submit: byId('submit-btn'),
  formMessage: byId('form-message'),
  setupNotice: byId('setup-notice'),
  status: byId('status-pill'),
  refresh: byId('refresh-btn'),
  body: byId('board-body'),
  empty: byId('board-empty'),
  error: byId('board-error'),
  errorText: byId('board-error-text'),
  retry: byId('retry-btn'),
  modeText: byId('mode-text'),
};

const NAME_KEY = 'feedback-wall:name';
const LAST_SUBMIT_KEY = 'feedback-wall:last-submit';
const COOLDOWN_MS = 15000;

const MODE_TEXT = {
  local: '本机 JSON 文件（仅预览）',
  cloudbase: '腾讯云开发 CloudBase',
  unconfigured: '尚未配置',
};

const state = {
  mode: 'unconfigured',
  api: null,
  items: [],
  loading: false,
  sending: false,
  timer: null,
  messageTimer: null,
};

function setStatus(text, tone) {
  els.status.textContent = text;
  els.status.className = tone ? `pill pill--${tone}` : 'pill';
}

function showFormMessage(text, tone) {
  els.formMessage.textContent = text;
  els.formMessage.dataset.tone = tone || '';
  clearTimeout(state.messageTimer);
  if (tone === 'success') {
    state.messageTimer = setTimeout(() => {
      els.formMessage.textContent = '';
      els.formMessage.dataset.tone = '';
    }, 6000);
  }
}

function updateCounter() {
  els.counter.textContent = String(els.content.value.length);
}

function focusField(field) {
  const map = { name: els.name, course: els.course, content: els.content };
  const el = map[field];
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && '$date' in value) return toDate(value.$date);
  return null;
}

function formatTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function makeCell(text, label, className) {
  const td = document.createElement('td');
  td.textContent = text;
  td.dataset.label = label;
  if (className) td.className = className;
  return td;
}

function renderRows() {
  const frag = document.createDocumentFragment();
  state.items.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.append(
      makeCell(String(index + 1), '序号', 'cell-index'),
      makeCell(item.name || '—', '姓名', 'cell-name'),
      makeCell(item.course || '—', '课程', 'cell-course'),
      makeCell(item.content || '', '内容', 'cell-content'),
      makeCell(formatTime(item.createdAt), '时间', 'cell-time'),
    );
    frag.append(tr);
  });
  els.body.replaceChildren(frag);
  els.empty.hidden = state.items.length > 0;
  els.empty.textContent = '还没有人提交，来当第一个吧。';
}

function showBoardError(err) {
  const message = err?.message || '加载失败，请稍后重试。';
  els.errorText.textContent = message;
  els.error.hidden = false;
}

function clearBoardError() {
  els.error.hidden = true;
  els.errorText.textContent = '';
}

function applyModeUI() {
  els.modeText.textContent = MODE_TEXT[state.mode] || '未知';
  if (state.mode === 'unconfigured') {
    els.setupNotice.hidden = false;
    els.submit.disabled = true;
    els.submit.textContent = '等待云端配置';
    setStatus('未配置云端', 'warn');
    els.empty.hidden = false;
    els.empty.textContent = '云端数据库尚未配置，公示栏暂无数据。';
    return;
  }
  els.setupNotice.hidden = true;
  els.submit.textContent = '提交反馈';
}

async function loadFeedback({ silent = false } = {}) {
  if (!state.api || state.loading) return;
  state.loading = true;
  els.refresh.disabled = true;
  if (!silent) setStatus('加载中…');

  try {
    state.items = await state.api.list();
    renderRows();
    clearBoardError();
    setStatus(state.mode === 'local' ? '本机预览' : '云端已连接', 'ok');
  } catch (err) {
    showBoardError(err);
    setStatus(state.mode === 'local' ? '本机服务异常' : '云端连接失败', 'error');
  } finally {
    state.loading = false;
    els.refresh.disabled = false;
  }
}

function setSending(flag) {
  state.sending = flag;
  els.submit.disabled = flag;
  els.submit.textContent = flag ? '提交中…' : '提交反馈';
}

async function onSubmit(event) {
  event.preventDefault();
  if (state.sending) return;

  if (!state.api) {
    showFormMessage('云端尚未配置，暂时无法提交。', 'error');
    return;
  }
  if (els.website.value.trim()) {
    showFormMessage('提交失败，请稍后再试。', 'error');
    return;
  }

  const checked = validateFeedback({
    name: els.name.value,
    course: els.course.value,
    content: els.content.value,
  });
  if (!checked.ok) {
    showFormMessage(checked.message, 'error');
    focusField(checked.field);
    return;
  }

  const last = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
  const wait = COOLDOWN_MS - (Date.now() - last);
  if (wait > 0) {
    showFormMessage(`刚刚提交过了，请 ${Math.ceil(wait / 1000)} 秒后再试。`, 'error');
    return;
  }

  setSending(true);
  try {
    await state.api.submit(checked.value);
    localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
    localStorage.setItem(NAME_KEY, checked.value.name);
    els.content.value = '';
    updateCounter();
    showFormMessage('提交成功，已出现在下方公示栏。', 'success');
    await loadFeedback({ silent: true });
  } catch (err) {
    showFormMessage(err?.message || '提交失败，请稍后重试。', 'error');
    if (err?.field) focusField(err.field);
  } finally {
    setSending(false);
  }
}

function startPolling() {
  const interval = Math.max(10000, Number(cfg.pollMs) || 30000);
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (document.visibilityState === 'visible') loadFeedback({ silent: true });
  }, interval);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.api) loadFeedback({ silent: true });
  });
}

function loadSdk() {
  if (window.cloudbase) return Promise.resolve(window.cloudbase);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error('SDK 加载超时'));
    }, 15000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.cloudbase) resolve(window.cloudbase);
      else reject(new Error('SDK 未暴露 cloudbase'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('SDK 脚本加载失败'));
    };
    document.head.appendChild(script);
  });
}

async function init() {
  els.content.addEventListener('input', updateCounter);
  els.form.addEventListener('submit', onSubmit);
  els.refresh.addEventListener('click', () => loadFeedback());
  els.retry.addEventListener('click', () => loadFeedback());

  const savedName = localStorage.getItem(NAME_KEY);
  if (savedName && !els.name.value) els.name.value = savedName;

  state.mode = resolveMode(cfg, window.location);
  applyModeUI();

  if (state.mode === 'cloudbase') {
    setStatus('连接云端…');
    try {
      const sdk = await loadSdk();
      state.api = createApi({ mode: 'cloudbase', config: cfg, sdk });
    } catch (err) {
      state.mode = 'error';
      els.modeText.textContent = '初始化失败';
      els.submit.disabled = true;
      els.submit.textContent = '暂不可提交';
      setStatus('SDK 加载失败', 'error');
      showBoardError(new Error('CloudBase SDK 加载失败：请检查网络后刷新页面。'));
      return;
    }
  } else if (state.mode === 'local') {
    state.api = createApi({ mode: 'local', config: cfg });
  } else {
    return;
  }

  await loadFeedback();
  startPolling();
}

init();
