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
const refreshPlanner = (snapshot) => { renderer.refresh(snapshot); enhanceMobileCreateActions(); };
renderer.mount(document.querySelector('#planner')); const unsubscribe = session.subscribe(refreshPlanner); refreshPlanner(session.getSnapshot());

const token = document.querySelector('#sync-token'); const gist = document.querySelector('#sync-gist'); const status = document.querySelector('#sync-status'); const createGist = document.querySelector('#sync-create'); token.value = config.token; gist.value = config.gistId;
const updateCreateGistVisibility = () => { createGist.hidden = Boolean(gist.value.trim()); };
gist.addEventListener('input', updateCreateGistVisibility); updateCreateGistVisibility();
const settings = document.querySelector('#sync-settings'); const settingsToggle = document.querySelector('#sync-settings-toggle');
const setSettingsOpen = (open) => { settings.hidden = !open; settingsToggle.setAttribute('aria-expanded', String(open)); if (open) token.focus(); else settingsToggle.focus(); };
settingsToggle.addEventListener('click', () => setSettingsOpen(settings.hidden));
document.querySelector('#sync-settings-close').addEventListener('click', () => setSettingsOpen(false));
const saveConfig = () => { config.token = token.value.trim(); config.gistId = gist.value.trim(); localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); };
document.querySelector('#sync-save').addEventListener('click', () => { saveConfig(); status.textContent = '配置已保存'; setSettingsOpen(false); if (config.token && config.gistId) sync.schedule(0); });
createGist.addEventListener('click', async () => { try { saveConfig(); config.gistId = await sync.createRemote(); gist.value = config.gistId; updateCreateGistVisibility(); localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); status.textContent = '已新建 Secret Gist'; } catch (error) { status.textContent = `新建失败：${error.message}`; } });
document.querySelector('#sync-now').addEventListener('click', async () => { try { saveConfig(); await sync.sync(); } catch {} });
sync.subscribe((value) => { status.textContent = value.state === 'syncing' ? '正在同步…' : value.state === 'error' ? `同步失败：${value.error}` : value.lastSyncedAt ? `${new Date(value.lastSyncedAt).toLocaleString('zh-CN')} 已同步` : '尚未同步'; });
addEventListener('online', () => sync.schedule(200)); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync.schedule(200); });
addEventListener('beforeunload', () => { unsubscribe(); session.dispose(); renderer.dispose(); sync.stop(); dialogHost.dispose(); });
