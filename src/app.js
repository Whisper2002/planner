import '../../src/styles/styles.css';
import './web.css';
import { PlannerStore } from '../../src/planner/planner-store.js';
import { PlannerSession } from '../../src/planner/planner-session.js';
import { PlannerRenderer } from '../../src/planner/planner-renderer.js';
import { GistPlannerRemote, PlannerSyncService } from '../../src/planner/planner-sync.js';
import { normalizePlannerSnapshot } from '../../src/planner/planner-contract.js';
import { createPresentation } from '../../src/presentation/presentation.js';
import { DialogHost } from '../../src/shell/dialog-host.js';

const DATA_KEY = 'dresearch-planner-web-data'; const CONFIG_KEY = 'dresearch-planner-web-sync'; const STATE_KEY = 'dresearch-planner-web-envelope'; const CLIENT_KEY = 'dresearch-planner-web-client';
const parse = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; } };
class BrowserStorage { async load() { return normalizePlannerSnapshot(parse(DATA_KEY, undefined)); } async save(value) { localStorage.setItem(DATA_KEY, JSON.stringify(value)); } }
const config = parse(CONFIG_KEY, { token: '', gistId: '' });
let clientId = localStorage.getItem(CLIENT_KEY); if (!clientId) { clientId = crypto.randomUUID(); localStorage.setItem(CLIENT_KEY, clientId); }
const store = new PlannerStore({ storage: new BrowserStorage() }); await store.load();
const remote = new GistPlannerRemote({ token: () => config.token, gistId: () => config.gistId });
const sync = new PlannerSyncService({ store, remote, clientId, configured: () => Boolean(config.token && config.gistId), stateStorage: { async load() { return parse(STATE_KEY, undefined); }, async save(value) { localStorage.setItem(STATE_KEY, JSON.stringify(value)); } } });
await sync.start();
const presentation = createPresentation('zh-CN');
const dialogHost = new DialogHost({ adapter: {
  captureFocus: () => document.activeElement,
  createDialog(id) { const backdrop = document.querySelector('.planner-web').appendChild(Object.assign(document.createElement('div'), { className: 'dr-dialog-backdrop' })); const dialog = backdrop.appendChild(document.createElement('section')); dialog.dataset.dialogId = id; dialog.tabIndex = -1; return dialog; },
  setAttributes(dialog, attributes) { for (const [name, value] of Object.entries(attributes)) dialog.setAttribute(name, value); },
  addKeyListener(listener) { document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener); },
  addBackdropListener(dialog, listener) { dialog.parentElement.addEventListener('click', listener); return () => dialog.parentElement?.removeEventListener('click', listener); },
  focus: (dialog) => dialog.focus(), removeDialog: (dialog) => dialog.parentElement?.remove(), restoreFocus: (target) => target?.focus?.(),
} });
const session = new PlannerSession({ store, initialUi: parse('dresearch-planner-web-ui', {}), onUiChanged: (ui) => localStorage.setItem('dresearch-planner-web-ui', JSON.stringify(ui)) });
const renderer = new PlannerRenderer({ session, store, dialogHost, presentation, syncService: sync, allowPointerScheduling: false });
const enhanceMobileCreateActions = () => {
  const actions = document.querySelector('#planner .dr-planner-actions');
  if (!actions || actions.querySelector('.planner-web-mobile-create')) return;
  const taskAction = actions.querySelector('.dr-planner-create-action:not(.is-schedule)');
  const scheduleAction = actions.querySelector('.dr-planner-create-action.is-schedule');
  if (!taskAction || !scheduleAction) return;
  const mobile = actions.appendChild(Object.assign(document.createElement('div'), { className: 'planner-web-mobile-create' }));
  const trigger = mobile.appendChild(Object.assign(document.createElement('button'), { className: 'planner-web-create-trigger', type: 'button', textContent: '＋ 新建' }));
  trigger.setAttribute('aria-expanded', 'false');
  const menu = mobile.appendChild(Object.assign(document.createElement('div'), { className: 'planner-web-create-menu', hidden: true }));
  const addChoice = (title, description, source) => {
    const choice = menu.appendChild(Object.assign(document.createElement('button'), { className: 'planner-web-create-choice', type: 'button' }));
    choice.appendChild(Object.assign(document.createElement('strong'), { textContent: title }));
    choice.appendChild(Object.assign(document.createElement('small'), { textContent: description }));
    choice.addEventListener('click', () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); source.click(); });
  };
  addChoice('添加任务', '记录需要完成的事项', taskAction);
  addChoice('安排日程', '安排明确的时间段', scheduleAction);
  trigger.addEventListener('click', () => { menu.hidden = !menu.hidden; trigger.setAttribute('aria-expanded', String(!menu.hidden)); });
};
const enhancePageHeader = () => {
  const pageHeader = document.querySelector('#planner > .dr-page-header');
  const heading = pageHeader?.querySelector('.dr-page-heading');
  const refresh = pageHeader?.querySelector('.dr-header-actions > .dr-icon-button:not(.dr-planner-sync)');
  const contextSlot = document.querySelector('#planner-page-context');
  const refreshSlot = document.querySelector('#planner-refresh-slot');
  if (heading) contextSlot.replaceChildren(heading);
  if (refresh) refreshSlot.replaceChildren(refresh);
  pageHeader?.remove();
};
const parsePlannerDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const plannerDateKey = (date) => {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const startOfPlannerWeek = (date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() || 7) - 1));
  return start;
};
const formatPlannerPeriod = (view, selected) => {
  if (view === 'day') return `${selected.getMonth() + 1}月${selected.getDate()}日 · 周${'日一二三四五六'[selected.getDay()]}`;
  if (view === 'month') return `${selected.getFullYear()}年${selected.getMonth() + 1}月`;
  const start = startOfPlannerWeek(selected);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  if (start.getFullYear() !== end.getFullYear()) return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日—${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`;
  if (start.getMonth() === end.getMonth()) return `${start.getMonth() + 1}月${start.getDate()}日—${end.getDate()}日`;
  return `${start.getMonth() + 1}月${start.getDate()}日—${end.getMonth() + 1}月${end.getDate()}日`;
};
const enhancePeriodNavigation = (snapshot) => {
  const controls = document.querySelector('#planner .dr-planner-controls');
  const nav = controls?.querySelector(':scope > .dr-planner-nav');
  const period = controls?.querySelector(':scope > .dr-planner-period-picker') ?? nav?.querySelector(':scope > .dr-planner-period-picker');
  const today = nav?.querySelector(':scope > .dr-planner-nav-button.is-today');
  const arrows = nav ? [...nav.querySelectorAll(':scope > .dr-planner-nav-button:not(.is-today)')] : [];
  const [previous, next] = arrows;
  if (!controls || !nav || !period || !today || !previous || !next) return;

  nav.classList.add('is-period-integrated');
  period.classList.add('is-period-integrated');
  if (previous.nextElementSibling !== period) previous.after(period);
  if (period.nextElementSibling !== next) period.after(next);
  if (next.nextElementSibling !== today) next.after(today);

  const selected = parsePlannerDate(snapshot.ui.selectedDate);
  const now = new Date(snapshot.now);
  const current = snapshot.ui.view === 'day'
    ? plannerDateKey(selected) === plannerDateKey(now)
    : snapshot.ui.view === 'week'
      ? plannerDateKey(startOfPlannerWeek(selected)) === plannerDateKey(startOfPlannerWeek(now))
      : selected.getFullYear() === now.getFullYear() && selected.getMonth() === now.getMonth();
  const shortcut = snapshot.ui.view === 'day' ? '今天' : snapshot.ui.view === 'week' ? '本周' : '本月';
  const label = formatPlannerPeriod(snapshot.ui.view, selected);
  const trigger = period.querySelector('.dr-planner-period-label');
  if (trigger && trigger.textContent !== label) trigger.textContent = label;
  if (trigger) trigger.setAttribute('aria-label', `选择日期，当前${label}`);
  if (today.textContent !== shortcut) today.textContent = shortcut;
  today.hidden = current;
};
let latestPlannerSnapshot = session.getSnapshot();
const refreshPlanner = (snapshot) => {
  latestPlannerSnapshot = snapshot;
  renderer.refresh(snapshot);
  enhancePageHeader();
  enhancePeriodNavigation(snapshot);
  enhanceMobileCreateActions();
};
const plannerRoot = document.querySelector('#planner');
renderer.mount(plannerRoot);
const plannerObserver = new MutationObserver(() => { enhancePageHeader(); enhancePeriodNavigation(latestPlannerSnapshot); enhanceMobileCreateActions(); });
plannerObserver.observe(plannerRoot, { childList: true });
const unsubscribe = session.subscribe(refreshPlanner); refreshPlanner(session.getSnapshot());

const token = document.querySelector('#sync-token'); const gist = document.querySelector('#sync-gist'); const status = document.querySelector('#sync-status'); const statusDetail = document.querySelector('#sync-status-detail'); const syncNow = document.querySelector('#sync-now'); const syncAction = document.querySelector('#sync-action'); const createGist = document.querySelector('#sync-create'); token.value = config.token; gist.value = config.gistId;
const setSyncStatus = ({ summary, detail = summary, state = 'idle', action = '同步' }) => {
  status.textContent = summary;
  statusDetail.textContent = detail;
  syncAction.textContent = action;
  syncAction.hidden = !action;
  syncNow.className = `planner-web-sync-button is-${state}`;
  statusDetail.parentElement.className = `planner-web-sync-detail is-${state}`;
  syncNow.title = detail;
  syncNow.setAttribute('aria-label', `${summary}。${action || detail}`);
};
const updateCreateGistVisibility = () => { createGist.hidden = Boolean(gist.value.trim()); };
gist.addEventListener('input', updateCreateGistVisibility); updateCreateGistVisibility();
const settings = document.querySelector('#sync-settings'); const settingsToggle = document.querySelector('#sync-settings-toggle');
const setSettingsOpen = (open) => { settings.hidden = !open; settingsToggle.setAttribute('aria-expanded', String(open)); if (open) token.focus(); else settingsToggle.focus(); };
settingsToggle.addEventListener('click', () => setSettingsOpen(settings.hidden));
document.querySelector('#sync-settings-close').addEventListener('click', () => setSettingsOpen(false));
const saveConfig = () => { config.token = token.value.trim(); config.gistId = gist.value.trim(); localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); };
document.querySelector('#sync-save').addEventListener('click', () => { saveConfig(); setSyncStatus({ summary: '配置已保存', detail: '同步配置已保存在当前浏览器', state: 'idle' }); setSettingsOpen(false); if (config.token && config.gistId) sync.schedule(0); });
createGist.addEventListener('click', async () => { try { saveConfig(); config.gistId = await sync.createRemote(); gist.value = config.gistId; updateCreateGistVisibility(); localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); setSyncStatus({ summary: 'Gist 已创建', detail: '已新建 Secret Gist', state: 'success' }); } catch (error) { setSyncStatus({ summary: '创建失败', detail: `新建失败：${error.message}`, state: 'error', action: '重试' }); } });
syncNow.addEventListener('click', async () => {
  saveConfig();
  if (!config.token || !config.gistId) { setSettingsOpen(true); return; }
  try { await sync.sync(); } catch {}
});
sync.subscribe((value) => {
  if (value.state === 'syncing') setSyncStatus({ summary: '正在同步', detail: '正在同步 Planner 数据…', state: 'syncing', action: '' });
  else if (value.state === 'error') setSyncStatus({ summary: '同步失败', detail: `同步失败：${value.error}`, state: 'error', action: '重试' });
  else if (value.lastSyncedAt) {
    const syncedAt = new Date(value.lastSyncedAt).toLocaleString('zh-CN');
    setSyncStatus({ summary: '已同步', detail: `${syncedAt} 已同步`, state: 'success' });
  } else if (!config.token || !config.gistId) setSyncStatus({ summary: '未配置同步', detail: '填写 Token 和 Gist ID 后即可同步', state: 'idle', action: '配置' });
  else setSyncStatus({ summary: '尚未同步', detail: '同步配置已就绪，尚未完成首次同步', state: 'idle' });
});
addEventListener('online', () => sync.schedule(200)); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync.schedule(200); });
addEventListener('beforeunload', () => { plannerObserver.disconnect(); unsubscribe(); session.dispose(); renderer.dispose(); sync.stop(); dialogHost.dispose(); });
