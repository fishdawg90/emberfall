import { ACTIVITIES, EQUIPMENT_SLOTS, METALS, RECIPES, TOWN_PROJECTS, UPGRADES } from './game-catalog.js';
import { chooseCaveCardReward, endExploreTurn, getCaveCardDraft, getCombatView, playExploreCard, skipCaveCardReward, startExploreCombat } from './combat-services.js';
import { createActivityVisuals } from './activity-visuals.js';
import { cardArtMarkup, combatSceneryMarkup, enemyFigureMarkup, playerWeaponMarkup } from './combat-visuals.js';
import { canChallengeMineGate, getActiveMission, getGreyfenTasks, getInterfaceUnlocks, getMetalUnlockState, getMissionJournal, getMineGateLocation, pinMission, recordTradeCoins } from './journey-services.js';
import {
  buyUpgrade,
  equipItem,
  forgeItem,
  getCycleSeconds,
  getEquipment,
  getMaterialRows,
  getOpportunitySeconds,
  getProductionEfficiency,
  getRadiantChance,
  getSmelterMultiplier,
  getTownCost,
  getTownLevel,
  getUpgradeCost,
  restoreTown,
  runOpportunity,
  runWorkCycle,
  selectActivity,
  selectMineDepth,
  selectSmeltMetal,
  sellGear,
  sellMaterial,
  simulateOfflineWork,
  skillXpNeeded
} from './gameplay-services.js';

const TAB_LABELS = Object.freeze({ work: 'Work', forge: 'Forge', gear: 'Gear', town: 'Greyfen', market: 'Market', journal: 'Journal' });
const ACTIVITY_UNLOCK_KEYS = Object.freeze({ mining: 'mining', smelting: 'smelting', combat: 'training' });
const TAB_UNLOCK_HINTS = Object.freeze({ forge: 'Find Greyfen’s smithy to unlock Forge.', gear: 'Forge your first item to unlock Gear.', market: 'Find Greyfen’s market to unlock Trade.' });
const ACTIVITY_UNLOCK_HINTS = Object.freeze({ mining: 'Find Greyfen’s town mine.', smelting: 'Find Greyfen’s smelter.', combat: 'Find Greyfen’s smithy to unlock training.' });

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statText(item) {
  const values = [];
  if (item.atk) values.push(`+${item.atk} ATK`);
  if (item.def) values.push(`+${item.def} DEF`);
  return values.join(' · ') || 'Cosmetic';
}

function button(label, action, value = '', disabled = false, className = '') {
  return `<button class="${className}" data-action="${action}" data-value="${escapeHtml(value)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

export function createGameUI({ getState, commit, onJourneyAction = () => false, onBuildingUpgrade = () => false, onVisualStyle = () => false, getVisualStyle = () => 'realistic', onReset = () => false, debug = window.EmberDebug }) {
  const panel = document.getElementById('gamePanel');
  const body = document.getElementById('gamePanelBody');
  const title = document.getElementById('gamePanelTitle');
  const toast = document.getElementById('gameToast');
  const hud = document.getElementById('gameMenuButton');
  const gameDock = document.getElementById('gameDock');
  const worldHint = document.getElementById('worldHint');
  const combatPanel = document.getElementById('combatPanel');
  const missionTracker = document.getElementById('missionTracker');
  const missionTitle = document.getElementById('missionTitle');
  const missionRoute = document.getElementById('missionRoute');
  const introOverlay = document.getElementById('introOverlay');
  const activityVisuals = createActivityVisuals({
    canvas: document.getElementById('activityCanvas'),
    container: document.getElementById('activityStage'),
    caption: document.getElementById('activityCaption'),
    gain: document.getElementById('activityGain'),
    getState,
    debug
  });
  let activeTab = 'work';
  let forgeMetal = METALS.find(metal => metal.id === RECIPES.find(recipe => recipe.id === getState().selectedRecipe)?.m)?.id || 'iron';
  let toastTimer = 0;
  let lastTick = performance.now();
  let combatFx = { enemy: '', player: '', weapon: '', impact: '' };
  let combatFxTimer = 0;
  let combatOutro = null;
  let currentMission = null;
  let resetRequested = false;

  function showCombatEffect({ enemy = '', player = '', weapon = '', impact = '', outro = null, duration = 560 } = {}) {
    combatFx = { enemy, player, weapon, impact };
    if (outro) combatOutro = outro;
    clearTimeout(combatFxTimer);
    combatFxTimer = setTimeout(() => {
      combatFx = { enemy: '', player: '', weapon: '', impact: '' };
      if (outro) combatOutro = null;
      renderCombat();
    }, duration);
  }

  function outroSnapshot(view, { type, log }) {
    return {
      type,
      playerHp: type === 'defeat' ? 0 : null,
      view: {
        ...view,
        combat: { ...view.combat, hp: type === 'victory' ? 0 : view.combat.hp, energy: 0, hand: [], resolving: true, log },
        cards: []
      }
    };
  }

  function notify(message, tone = 'normal') {
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
  }

  function commitAction(action, preserveScroll = false) {
    const saved = commit(action);
    if (saved?.errors?.length) notify('Progress changed, but this browser could not save it.', 'bad');
    render(preserveScroll);
    return saved;
  }

  function applyResult(result, action, successMessage) {
    if (!result?.ok) {
      notify(result?.message || 'That action is not available.', 'bad');
      return false;
    }
    commitAction(action);
    if (successMessage) notify(typeof successMessage === 'function' ? successMessage(result) : successMessage, result.critical || result.quality === 'Masterwork' ? 'gold' : 'normal');
    return true;
  }

  function renderHud() {
    const state = getState();
    const heroLevel = state.hero?.level || 1;
    hud.innerHTML = `<span>${Number(state.coins || 0).toLocaleString()}c</span><i>Hero ${heroLevel}</i>${state.explore?.combat ? '<b>BATTLE</b>' : state.running ? '<b>ACTIVE</b>' : ''}`;
    refreshNavigation();
    worldHint?.classList.toggle('hide', Boolean(state.journey?.introSeen));
    renderJourney();
  }

  function refreshNavigation() {
    const state = getState();
    const unlocks = getInterfaceUnlocks(state);
    const selected = activeTab === 'market' ? 'town' : activeTab;
    gameDock?.querySelectorAll('[data-open-game-tab]').forEach(element => {
      const tab = element.dataset.openGameTab;
      const locked = !unlocks[tab];
      element.hidden = false;
      element.classList.toggle('locked', locked);
      element.setAttribute('aria-disabled', locked ? 'true' : 'false');
      element.classList.toggle('active', panel.classList.contains('show') && tab === selected);
      element.classList.toggle('running', tab === 'work' && state.running);
    });
  }

  function renderJourney() {
    const state = getState();
    const caveFind = state.explore?.lastCaveFind;
    if (caveFind?.type === 'coins') {
      state.explore.lastCaveFind = null;
      notify(`Found an old wayfarer cache · +${caveFind.amount} coin`, 'gold');
    }
    currentMission = getActiveMission(state);
    if (!missionTracker) return;
    missionTracker.classList.toggle('empty', !currentMission);
    missionTracker.dataset.mission = currentMission?.id || '';
    missionTitle.textContent = currentMission?.title || 'All missions complete';
    missionRoute.textContent = currentMission?.action?.button || 'OPEN';
    missionRoute.disabled = !currentMission || Boolean(state.explore?.combat);
  }

  function showIntro(force = false) {
    if (!introOverlay || getState().explore?.combat || (!force && getState().journey?.introSeen)) return false;
    close();
    introOverlay.classList.add('show');
    introOverlay.setAttribute('aria-hidden', 'false');
    return true;
  }

  function hideIntro(save = false) {
    if (!introOverlay) return;
    introOverlay.classList.remove('show');
    introOverlay.setAttribute('aria-hidden', 'true');
    if (save && !getState().journey?.introSeen) {
      getState().journey.introSeen = true;
      commitAction('complete quick introduction');
    }
  }

  function skillStrip(id) {
    const state = getState();
    const skill = state.skills[id];
    const needed = skillXpNeeded(skill.l);
    return `<div class="skillStrip"><span>Lv ${skill.l}</span><div><i style="width:${Math.min(100, skill.x / needed * 100)}%"></i></div><small>${skill.x} / ${needed} XP</small></div>`;
  }

  function pluralMaterial(name, count) {
    if (count === 1 || /ore$/i.test(name)) return name;
    return `${name}s`;
  }

  function activityMetal(state, mode) {
    if (mode === 'forging') return METALS.find(metal => metal.id === forgeMetal) || METALS[0];
    if (mode === 'smelting') return METALS.find(metal => metal.id === state.smelt) || METALS[0];
    if (mode === 'mining') return METALS[state.depth] || METALS[0];
    return null;
  }

  function activityStack(state, mode, selectedMetal = activityMetal(state, mode)) {
    if (!selectedMetal || mode === 'combat') return { stackCount: null, stackLabel: '' };
    const kind = mode === 'mining' ? 'Ore' : 'Bar';
    const count = Number(state.inv?.[`${selectedMetal.id}${kind}`]) || 0;
    const name = mode === 'mining' ? selectedMetal.ore : selectedMetal.bar;
    return { stackCount: count, stackLabel: pluralMaterial(name, count) };
  }

  function showWorkReward(result) {
    if (!result?.ok || !result.metal || result.amount < 1) {
      activityVisuals.pulse(620);
      return;
    }
    const state = getState();
    const kind = result.kind || (result.activity === 'mining' ? 'ore' : 'bar');
    const stackOptions = activityStack(state, result.activity, result.metal);
    activityVisuals.reward({
      kind,
      amount: result.amount,
      label: kind === 'ore' ? pluralMaterial(result.metal.ore, result.amount) : pluralMaterial(result.metal.bar, result.amount),
      metalColor: result.metal.color,
      ...stackOptions
    });
  }

  function syncActivityVisuals() {
    const state = getState();
    if (!panel.classList.contains('show') || state.explore?.combat || !['work', 'forge'].includes(activeTab)) {
      activityVisuals.hide();
      return;
    }
    const mode = activeTab === 'forge' ? 'forging' : state.active;
    const selectedMetal = activityMetal(state, mode);
    activityVisuals.show(mode, {
      running: activeTab === 'work' && state.running,
      progress: activeTab === 'work' ? state.p : 0,
      metalColor: selectedMetal?.color,
      ...activityStack(state, mode, selectedMetal)
    });
  }

  function compactHelp(title, text) {
    return `<details class="compactHelp"><summary>${title}</summary><p>${text}</p></details>`;
  }

  function lockedPanel(icon, titleText, hint, serviceId) {
    return `<section class="lockedPanel"><i>${icon}</i><div><small>NOT YET DISCOVERED</small><h3>${titleText}</h3><p>${hint}</p></div>${button('Route', 'route-service', serviceId, false, 'primary')}</section>`;
  }

  function lockedAction(label, hint, className = '') {
    return button(label, 'locked-hint', hint, false, `${className} locked`);
  }

  function metalLockHint(progress, mode) {
    if (!progress.opened) return `${progress.metal.name}: ${progress.requirement}.`;
    const required = mode === 'mining' ? progress.metal.mine : progress.metal.smelt;
    const label = mode === 'mining' ? 'Mining' : 'Smelting';
    return `Reach ${label} Lv ${required} for ${progress.metal.name}.`;
  }

  function metalChoice(progress, mode, selected) {
    const ready = mode === 'mining' ? progress.miningReady : progress.smeltingReady;
    const status = mode === 'mining' ? progress.miningStatus : progress.smeltingStatus;
    const action = ready ? (mode === 'mining' ? 'select-depth' : 'select-smelt') : 'locked-hint';
    const value = ready ? (mode === 'mining' ? progress.index : progress.metal.id) : metalLockHint(progress, mode);
    return button(`<i>${ready ? progress.metal.icon : '🔒'}</i><span><strong>${progress.metal.name}</strong><small>${status}</small></span>`, action, value, false, `metalChoice ${selected ? 'active' : ''} ${ready ? '' : 'locked'}`);
  }

  function renderWork() {
    const state = getState();
    const unlocks = getInterfaceUnlocks(state);
    if (!unlocks.mining) return lockedPanel('⛏', 'Find Greyfen’s mine', 'Walk to the mine to unlock production.', 'mine');
    const activity = ACTIVITIES[state.active];
    const cycle = getCycleSeconds(state);
    const material = state.active === 'mining'
      ? METALS[state.depth]
      : METALS.find(metal => metal.id === state.smelt) || METALS[0];
    const activityButtons = Object.entries(ACTIVITIES).map(([id, item]) => {
      const unlocked = unlocks[ACTIVITY_UNLOCK_KEYS[id]];
      return button(
      `<b>${unlocked ? item.icon : '🔒'}</b><span>${id === 'combat' ? 'Training' : item.name}</span>`,
      unlocked ? 'select-activity' : 'locked-hint',
      unlocked ? id : ACTIVITY_UNLOCK_HINTS[id],
      false,
      `activityChoice ${state.active === id ? 'active' : ''} ${unlocked ? '' : 'locked'}`
    );
    }).join('');
    const metalProgress = METALS.map((_, index) => getMetalUnlockState(state, index));
    const selectors = state.active === 'mining'
      ? `<section class="resourcePicker"><div class="sectionHeading"><strong>Choose mine</strong><span>${state.open + 1}/${METALS.length} open</span></div><div class="unlockGrid">${metalProgress.map(progress => metalChoice(progress, 'mining', progress.index === state.depth)).join('')}</div></section>`
      : state.active === 'smelting'
        ? `<section class="resourcePicker"><div class="sectionHeading"><strong>Choose metal</strong><span>Ore → bars</span></div><div class="unlockGrid">${metalProgress.map(progress => metalChoice(progress, 'smelting', progress.metal.id === state.smelt)).join('')}</div></section>`
        : '';
    const facilityMultiplier = state.active === 'smelting' ? getSmelterMultiplier(state, material.id) : 1;
    const productionEfficiency = getProductionEfficiency(state);
    const materialLine = state.active === 'mining'
      ? `${state.inv[`${material.id}Ore`]} ${material.ore}`
      : state.active === 'smelting'
        ? `${state.inv[`${material.id}Ore`]} ore → ${state.inv[`${material.id}Bar`]} bars${facilityMultiplier > 1 ? ` · regional foundry ×${facilityMultiplier.toFixed(2)}` : ''}`
        : 'Combat skill XP improves mine-gate battles';
    const upgrades = Object.entries(UPGRADES).map(([id, upgrade]) => {
      const rank = state.up[state.active][id];
      const cost = getUpgradeCost(state, state.active, id);
      const maxed = !Number.isFinite(cost);
      const available = upgrade.currency === 'coin' ? state.coins : state.skills[state.active].s;
      return `<div class="serviceRow"><div><strong>${upgrade.name} <em>${rank}/${upgrade.cap}</em></strong><small>${upgrade.desc}</small></div>${button(maxed ? 'MAX' : `${cost} ${upgrade.currency}`, 'buy-upgrade', id, maxed || available < cost)}</div>`;
    }).join('');
    const totalRanks = Object.values(state.up[state.active] || {}).reduce((total, rank) => total + rank, 0);
    const affordableUpgrades = Object.keys(UPGRADES).filter(id => {
      const cost = getUpgradeCost(state, state.active, id);
      return Number.isFinite(cost) && (UPGRADES[id].currency === 'coin' ? state.coins : state.skills[state.active].s) >= cost;
    }).length;
    const nextDepth = Math.min(METALS.length - 1, state.open + 1);
    const gateMetal = state.open < METALS.length - 1 ? METALS[nextDepth] : null;
    const atGate = canChallengeMineGate(state, nextDepth);
    const gateReady = gateMetal && atGate && state.skills.mining.l >= gateMetal.mine;
    const gateCard = gateMetal && nextDepth > 1 && state.active === 'mining' && atGate ? `<section class="gameCard gateCard"><div><small>MINE GATE</small><strong>${gateMetal.icon} ${gateMetal.gate.name}</strong><p>${gateReady ? `${gateMetal.name} is within reach.` : `Mining Lv ${state.skills.mining.l}/${gateMetal.mine}`}</p></div>${button(gateReady ? 'Challenge' : 'Locked', 'challenge-gate', nextDepth, !gateReady, gateReady ? 'primary' : '')}</section>` : '';

    return `<div class="activityGrid">${activityButtons}</div>
      ${selectors}
      <section class="gameCard heroCard" style="--metal:${material.color}">
        <div><small>CURRENT WORK</small><h3>${activity.icon} ${activity.name}</h3><p>${materialLine}</p></div>
        <span>${cycle.toFixed(1)}s cycle${productionEfficiency < .98 ? ` · ${Math.round(productionEfficiency * 100)}% yield` : ''}</span>
        <div class="productionTrack"><i id="productionProgress"></i></div>
        <div class="gameActions">
          ${button(state.running ? 'Stop work' : `Start ${activity.name}`, 'toggle-production', '', false, state.running ? 'danger' : 'primary')}
          ${button(state.rad ? 'Radiant opportunity!' : 'Work opportunity', 'opportunity', '', state.op < 1, state.rad ? 'radiant' : '')}
        </div>
      </section>
      ${skillStrip(state.active)}
      ${gateCard}
      <details class="compactDetails"><summary>Upgrades <b>${affordableUpgrades ? `${affordableUpgrades} ready` : `${totalRanks} ranks`}</b></summary><div class="serviceList">${upgrades}</div></details>
      ${compactHelp('How work connects', productionEfficiency < .98 ? 'Your stockpile is crowded, so passive yield is slowing. Forge or sell materials to restore full output.' : 'Ore becomes bars, bars become gear. Work keeps running while you explore.')}`;
  }

  function renderForge() {
    const state = getState();
    const unlocks = getInterfaceUnlocks(state);
    if (!unlocks.forge) return lockedPanel('⚒', 'Find Greyfen’s smithy', 'The smithy unlocks forging and combat training.', 'forge');
    const knownMetals = METALS.filter((_, index) => index <= state.open);
    if (!knownMetals.some(metal => metal.id === forgeMetal)) forgeMetal = knownMetals.at(-1)?.id || 'iron';
    const metalChoices = METALS.map((metal, index) => {
      const progress = getMetalUnlockState(state, index);
      return progress.opened
        ? button(`<i>${metal.icon}</i><span>${metal.name}</span>`, 'forge-filter', metal.id, false, `forgeMetalChoice ${metal.id === forgeMetal ? 'active' : ''}`)
        : lockedAction(`<i>🔒</i><span>${metal.name}</span>`, `${metal.name}: ${progress.requirement}.`, 'forgeMetalChoice');
    }).join('');
    const allRecipes = RECIPES.filter(recipe => recipe.m === forgeMetal);
    const recipeMarkup = recipe => {
      const metal = METALS.find(entry => entry.id === recipe.m);
      const locked = state.skills.forging.l < recipe.req;
      const bars = state.inv[`${metal.id}Bar`];
      const short = bars < recipe.bars;
      const control = locked
        ? lockedAction(`🔒 Lv ${recipe.req}`, `Reach Forging Lv ${recipe.req} for ${recipe.name}.`, 'forgeButton')
        : button(short ? `Need ${recipe.bars - bars}` : 'Forge', 'forge', recipe.id, short, 'forgeButton');
      return `<div class="recipeCard ${locked ? 'locked' : ''}" style="--metal:${metal.color}">
        <div><small>${recipe.type.toUpperCase()}${locked ? ` · LV ${recipe.req}` : ''}</small><strong>${recipe.name}</strong><span>${recipe.atk ? `+${recipe.atk} ATK` : `+${recipe.def} DEF`} · ${recipe.bars} bars</span></div>
        ${control}
      </div>`;
    };
    const readyRecipes = allRecipes.filter(recipe => state.skills.forging.l >= recipe.req).map(recipeMarkup).join('');
    const lockedRecipes = allRecipes.filter(recipe => state.skills.forging.l < recipe.req).map(recipeMarkup).join('');
    const metal = knownMetals.find(entry => entry.id === forgeMetal) || knownMetals[0];
    return `<div class="forgeSummary"><span>${metal.icon} ${state.inv[`${metal.id}Bar`]} bars</span>${skillStrip('forging')}</div><div class="forgeMetalGrid">${metalChoices}</div><div class="recipeList">${readyRecipes}</div>${lockedRecipes ? `<details class="compactDetails"><summary>Locked recipes <b>${allRecipes.length - allRecipes.filter(recipe => state.skills.forging.l >= recipe.req).length}</b></summary><div class="recipeList">${lockedRecipes}</div></details>` : ''}${compactHelp('Gear and cards', 'Weapons improve attacks. Armour adds HP, Block, and per-hit damage reduction; four Iron armour pieces grant a set bonus.')}`;
  }

  function renderGear() {
    const state = getState();
    const equipment = getEquipment(state);
    const slots = EQUIPMENT_SLOTS.map(slot => {
      const item = equipment[slot.id];
      return `<div class="slotCard"><i>${slot.icon}</i><div><small>${slot.name}</small><strong>${escapeHtml(item?.name || 'Empty')}</strong><span>${item ? statText(item) : 'No item equipped'}</span></div>${item ? button('Remove', 'unequip', slot.id) : ''}</div>`;
    }).join('');
    const inventory = state.gear.length
      ? [...state.gear].reverse().map(item => `<div class="inventoryCard ${state.eq[item.type] === item.id ? 'equipped' : ''}"><div><small>${escapeHtml(item.q || 'Standard')} · ${escapeHtml(item.type)}</small><strong>${escapeHtml(item.name)}</strong><span>${statText(item)} · ${item.val}c</span></div>${button(state.eq[item.type] === item.id ? 'Equipped' : 'Equip', 'equip', item.id, state.eq[item.type] === item.id)}</div>`).join('')
      : '<div class="emptyState">Forge equipment at Greyfen’s Smithy to build your loadout.</div>';
    return `<div class="combatTotals"><span><small>ATK</small><b>${equipment.atk}</b></span><span><small>DEF</small><b>${equipment.def}</b></span></div><h3 class="sectionTitle">Equipped</h3><div class="slotGrid">${slots}</div><h3 class="sectionTitle">Inventory</h3><div class="inventoryList">${inventory}</div>${compactHelp('Loadout', 'Your equipped weapon and armour directly change the combat deck.')}`;
  }

  function renderTown() {
    const state = getState();
    const unlocks = getInterfaceUnlocks(state);
    const tasks = getGreyfenTasks(state);
    const taskCount = tasks.filter(task => task.complete).length;
    const projectHint = id => ({ forge: 'Find Greyfen’s smithy.', smelter: 'Find Greyfen’s smelter.', market: 'Find Greyfen’s market.', inn: 'Reach Frostmere on the north road.' }[id]);
    const projects = Object.entries(TOWN_PROJECTS).map(([id, project]) => {
      const unlocked = unlocks.projects[id];
      const level = getTownLevel(state, id);
      const maxed = level >= project.max;
      const cost = getTownCost(state, id);
      const control = unlocked ? button(maxed ? 'Restored' : `${cost} coin`, 'restore', id, maxed || state.coins < cost, maxed ? '' : 'primary') : lockedAction('🔒 Locked', projectHint(id));
      return `<div class="townCard ${unlocked ? '' : 'locked'}"><div class="townLevel"><i style="width:${unlocked ? level / project.max * 100 : 0}%"></i></div><div><small>${unlocked ? `LEVEL ${level}/${project.max}` : 'LOCKED'}</small><strong>${project.name}</strong><span>${unlocked ? project.desc : projectHint(id)}</span></div>${control}</div>`;
    }).join('');
    const trade = unlocks.market ? button('Trade', 'open-market') : lockedAction('🔒 Trade', 'Find Greyfen’s market.');
    return `<section class="townProgress"><div><small>TOWN ORIENTATION</small><strong>${taskCount}/${tasks.length} complete</strong><span>${taskCount === tasks.length ? 'North road ready' : 'Follow the active mission'}</span></div><div>${trade}${button('Journal', 'open-journal')}</div></section><h3 class="sectionTitle">Restoration</h3><div class="townList">${projects}</div>${compactHelp('Restoring Greyfen', 'Each level improves its matching system and changes the building in the world.')}`;
  }

  function renderJournal() {
    const state = getState();
    const active = getActiveMission(state);
    const missions = getMissionJournal(state);
    const missionMarkup = (mission, detailed = false) => {
      const status = mission.complete ? 'complete' : !mission.unlocked ? 'locked' : mission.id === active?.id ? 'active' : 'available';
      const controls = mission.complete || !mission.unlocked
        ? ''
        : `<div class="missionActions">${mission.id === active?.id ? '<b>ACTIVE</b>' : button('Set active', 'mission-pin', mission.id)}${button(mission.action?.button || 'OPEN', 'mission-go', mission.id, false, mission.id === active?.id ? 'primary' : '')}</div>`;
      return `<article class="missionCard ${status} ${detailed ? 'featured' : ''}"><i>${mission.complete ? '✓' : mission.unlocked ? mission.icon : '◇'}</i><div><small>${mission.optional ? 'OPTIONAL · ' : ''}${mission.chapter}</small><strong>${escapeHtml(mission.title)}</strong>${detailed ? `<span>${escapeHtml(mission.detail)}</span>` : ''}<em>${escapeHtml(mission.progress)}</em></div>${controls}</article>`;
    };
    const available = missions.filter(mission => mission.unlocked && !mission.complete && mission.id !== active?.id);
    const completed = missions.filter(mission => mission.complete);
    const locked = missions.filter(mission => !mission.unlocked);
    const visualStyle = getVisualStyle();
    const reset = resetRequested
      ? `<section class="resetConfirm"><strong>Start Emberfall over?</strong><p>This permanently clears inventory, equipment, town restoration, discoveries, missions, and combat progress on this device.</p><div>${button('Cancel', 'reset-cancel')}${button('Erase and restart', 'reset-confirm', '', false, 'danger')}</div></section>`
      : '';
    return `<div class="journalLead"><small>ACTIVE MISSION</small>${active ? missionMarkup(active, true) : '<div class="emptyState compact">All current missions complete.</div>'}</div>${available.length ? `<h3 class="sectionTitle">Available</h3><div class="missionList compact">${available.map(mission => missionMarkup(mission)).join('')}</div>` : ''}${completed.length ? `<details class="journalGroup"><summary>Completed <b>${completed.length}</b></summary><div class="missionList compact">${completed.map(mission => missionMarkup(mission)).join('')}</div></details>` : ''}${locked.length ? `<details class="journalGroup"><summary>Undiscovered <b>${locked.length}</b></summary><div class="missionList compact">${locked.map(mission => missionMarkup(mission)).join('')}</div></details>` : ''}<details class="journalGroup settings"><summary>Settings</summary><div class="displaySetting"><span>World lighting</span><div>${button('Natural', 'visual-style', 'realistic', false, visualStyle === 'realistic' ? 'active' : '')}${button('Dramatic', 'visual-style', 'dramatic', false, visualStyle === 'dramatic' ? 'active' : '')}</div></div><div class="journalSettings"><div><strong>Start over</strong><span>Erase this device’s progress.</span></div>${button('Reset…', 'reset-request')}</div></details>${reset}`;
  }

  function renderMarket() {
    const state = getState();
    const materials = getMaterialRows(state).filter(row => row.tier <= state.open && row.count > 0).map(row => `<div class="marketRow" style="--metal:${row.metal.color}"><i>${row.metal.icon}</i><div><strong>${row.name}</strong><span>${row.count} × ${row.value}c</span></div>${button('1', 'sell-material', `${row.key}|${row.value}|1`)}${button('All', 'sell-material', `${row.key}|${row.value}|all`)}</div>`).join('');
    const gear = state.gear.filter(item => !Object.values(state.eq).includes(item.id)).map(item => `<div class="marketRow"><i>⚒</i><div><strong>${escapeHtml(item.name)}</strong><span>${statText(item)} · ${item.val}c base</span></div>${button('Sell', 'sell-gear', item.id)}</div>`).join('');
    const marketMultiplier = 1 + (Math.max(1, getTownLevel(state, 'market')) - 1) * 0.05;
    return `<div class="marketBanner">Market Lv ${getTownLevel(state, 'market')} <span>×${marketMultiplier.toFixed(2)} prices</span></div><h3 class="sectionTitle">Goods</h3><div class="marketList">${materials || '<div class="emptyState compact">No materials to sell.</div>'}</div>${gear ? `<h3 class="sectionTitle">Spare gear</h3><div class="marketList">${gear}</div>` : ''}${compactHelp('Trading', 'Sell surplus goods to fund Greyfen’s restoration.')}`;
  }

  function renderCombat() {
    const state = getState();
    const liveView = getCombatView(state);
    const view = liveView || combatOutro?.view;
    const draft = !combatOutro && getCaveCardDraft(state);
    if (!view) {
      if (draft) {
        activityVisuals.hide();
        panel.classList.remove('show');
        panel.setAttribute('aria-hidden', 'true');
        const choices = draft.choices.map(card => `<button class="combatCard draftCard kind-${card.kind}" data-draft-card="${card.id}"><span class="combatCardCost">${card.cost}</span>${cardArtMarkup(card.id)}<strong>${card.name}</strong><small>${card.text}</small><em>${card.kind}</em></button>`).join('');
        combatPanel.innerHTML = `<section class="cardDraft"><small>LOWER WAYS · BATTLE WON</small><h2>Choose a card for this run</h2><p>It joins every deck until you leave, fall, or defeat the guardian.</p><div class="draftDeck">Run deck +${draft.deckSize}</div><div class="draftChoices">${choices}</div><button class="draftSkip" data-draft-skip>Take 6 coin instead</button></section>`;
        combatPanel.classList.add('show', 'drafting');
        combatPanel.setAttribute('aria-hidden', 'false');
        return;
      }
      combatPanel.classList.remove('drafting');
      combatPanel.classList.remove('show');
      combatPanel.setAttribute('aria-hidden', 'true');
      combatPanel.replaceChildren();
      return;
    }
    combatPanel.classList.remove('drafting');
    activityVisuals.hide();
    panel.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
    const { combat, enemy, intent, cards, bonuses } = view;
    const outro = !liveView && Boolean(combatOutro);
    const enemyHp = Math.max(0, combat.hp / combat.maxHp * 100);
    const guard = Math.max(0, combat.guard / combat.guardMax * 100);
    const expeditionMaxHp = state.explore.maxHp || view.maxHp;
    const currentPlayerHp = combatOutro?.playerHp ?? state.explore.hp;
    const playerHp = Math.max(0, currentPlayerHp / expeditionMaxHp * 100);
    const hand = cards.map((card, index) => {
      const offset = index - (cards.length - 1) / 2;
      const disabled = outro || card.cost > combat.energy || combat.resolving;
      return `<button class="combatCard kind-${card.kind}" data-combat-card="${index}" style="--fan-r:${(offset * 2.4).toFixed(1)}deg;--fan-y:${Math.abs(offset * 2.2).toFixed(1)}px" ${disabled ? 'disabled' : ''}><span class="combatCardCost">${card.cost}</span>${cardArtMarkup(card.id)}<strong>${card.name}</strong><small>${card.text}</small><em>${card.kind}</em></button>`;
    }).join('');
    const area = ['forest', 'cave', 'town', 'world'].includes(combat.origin?.area) ? combat.origin.area : 'world';
    const enemyFigure = enemyFigureMarkup(enemy.id, { boss: combat.boss, broken: combat.broken, effect: combatFx.enemy });
    const weaponFigure = playerWeaponMarkup({ effect: combatFx.weapon, defeated: combatOutro?.type === 'defeat' });
    if (!outro && !combat.broken) {
      const hitsAfterEvade = Math.max(0, intent.hits - (combat.evade || 0));
      const perHit = Math.max(0, intent.dmg - (combat.enemyWeak || 0) - (bonuses?.armour || 0));
      const projected = Math.max(0, perHit * hitsAfterEvade - combat.block);
      intent.text = `${intent.text} · ${projected} reaches HP`;
    }
    const statuses = [bonuses?.armour ? `♜ ${bonuses.armour} ARMOUR / HIT` : '', combat.evade ? `➶ EVADE ${combat.evade}` : '', combat.enemyWeak ? `⌁ ENEMY -${combat.enemyWeak}` : '', combat.retainBlock ? '▰ RETAIN BLOCK' : ''].filter(Boolean).map(status => `<b>${status}</b>`).join('');
    combatPanel.innerHTML = `<div class="combatTop"><div class="combatEnemy"><div class="combatEnemyHead"><strong>${combat.boss ? '☇ ' : ''}${enemy.name}</strong><span>${combat.hp}/${combat.maxHp} HP</span></div><div class="combatBars"><div class="combatBar hp"><i style="width:${enemyHp}%"></i><em>HEALTH</em></div><div class="combatBar guard"><i style="width:${guard}%"></i><em>${combat.broken ? 'BROKEN' : `${combat.guard}/${combat.guardMax} BREAK GUARD`}</em></div></div></div><div class="combatIntent"><small>${outro ? 'RESULT' : 'INTENT'}</small><strong>${outro ? (combatOutro.type === 'victory' ? 'Defeated' : 'Overwhelmed') : combat.broken ? 'Staggered' : intent.name}</strong><span>${outro ? (combatOutro.type === 'victory' ? 'Rewards secured' : 'Returning to Greyfen') : combat.broken ? 'Attack cancelled' : intent.text}</span></div></div><div class="combatArena area-${area} ${combatFx.player}">${combatSceneryMarkup(area)}${enemyFigure}${weaponFigure}${combatFx.impact ? `<strong class="combatImpact">${escapeHtml(combatFx.impact)}</strong>` : ''}</div><div class="combatBottom"><div class="combatPlayer"><div class="combatPlayerCard"><div class="combatPlayerHead"><strong>Hero · Turn ${combat.turn}</strong><span>${currentPlayerHp}/${expeditionMaxHp} HP${combat.block ? ` · ${combat.block} Block` : ''}</span></div><div class="combatBar player"><i style="width:${playerHp}%"></i><em>EXPEDITION HEALTH</em></div></div><div class="combatEnergy"><b>${combat.energy}</b> ENERGY</div></div>${statuses ? `<div class="combatStatuses">${statuses}</div>` : ''}<div class="combatLog">${escapeHtml(combat.log)}${state.explore.encounters < 2 ? '<small>Break cancels the attack. Armour reduces each hit. Evade cancels one hit.</small>' : ''}</div><div class="combatHand">${hand}</div><button class="combatEnd" data-combat-end ${outro || combat.resolving ? 'disabled' : ''}>${outro ? 'Resolving battle…' : 'End turn · enemy acts'}</button></div>`;
    combatPanel.classList.add('show');
    combatPanel.setAttribute('aria-hidden', 'false');
  }

  function renderBody(preserveScroll = false) {
    const scrollTop = body.scrollTop;
    const renderers = { work: renderWork, forge: renderForge, gear: renderGear, town: renderTown, market: renderMarket, journal: renderJournal };
    if (!getInterfaceUnlocks(getState())[activeTab]) activeTab = 'journal';
    title.textContent = TAB_LABELS[activeTab];
    body.innerHTML = renderers[activeTab]();
    refreshNavigation();
    updateLiveIndicators();
    syncActivityVisuals();
    if (preserveScroll) body.scrollTop = scrollTop;
  }

  function render(preserveScroll = false) {
    renderHud();
    renderCombat();
    if (panel.classList.contains('show')) renderBody(preserveScroll);
  }

  function updateLiveIndicators() {
    const state = getState();
    const progress = document.getElementById('productionProgress');
    if (progress) progress.style.width = `${Math.min(100, Math.max(0, state.p * 100))}%`;
    const opportunity = body.querySelector('[data-action="opportunity"]');
    if (opportunity) {
      opportunity.disabled = state.op < 1;
      opportunity.textContent = state.rad ? 'Radiant opportunity!' : state.op >= 1 ? 'Work opportunity ready' : `Opportunity ${Math.floor(state.op * 100)}%`;
      opportunity.classList.toggle('radiant', Boolean(state.rad));
    }
    renderHud();
  }

  function open(tab = activeTab) {
    if (getState().explore?.combat) {
      notify('Finish the battle first.', 'bad');
      return;
    }
    const requested = TAB_LABELS[tab] ? tab : 'work';
    const unlocks = getInterfaceUnlocks(getState());
    if (!unlocks[requested]) {
      notify(TAB_UNLOCK_HINTS[requested] || `${TAB_LABELS[requested]} has not been discovered yet.`);
      return false;
    }
    activeTab = requested;
    panel.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    renderBody();
  }

  function close() {
    panel.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
    activityVisuals.hide();
    refreshNavigation();
  }

  function performMissionAction(missionOrAction) {
    const goal = missionOrAction?.action || missionOrAction;
    if (!goal || getState().explore?.combat) return false;
    if (goal.activity && getState().active !== goal.activity) {
      const result = selectActivity(getState(), goal.activity);
      if (result.ok) commitAction(`mission selects ${goal.activity}`);
    }
    if (goal.metalId) forgeMetal = goal.metalId;
    if (goal.gateDepth) return onAction('challenge-gate', goal.gateDepth);
    if (goal.landmarkId || goal.serviceId) {
      close();
      return onJourneyAction(goal);
    }
    if (goal.tab) {
      open(goal.tab);
      return true;
    }
    return false;
  }

  function onAction(action, rawValue) {
    const state = getState();
    const unlocks = getInterfaceUnlocks(state);
    if (action === 'locked-hint') {
      notify(rawValue || 'Continue the active mission to unlock this.');
      return true;
    }
    if (action === 'mission-pin') return applyResult(pinMission(state, rawValue), `pin mission ${rawValue}`, result => `${result.mission.title} is now active`);
    if (action === 'mission-go') {
      const mission = getMissionJournal(state).find(entry => entry.id === rawValue && entry.unlocked && !entry.complete);
      return mission ? performMissionAction(mission) : notify('That mission is not currently available.', 'bad');
    }
    if (action === 'reset-request') {
      resetRequested = true;
      renderBody(true);
      return true;
    }
    if (action === 'reset-cancel') {
      resetRequested = false;
      renderBody(true);
      return true;
    }
    if (action === 'reset-confirm') {
      resetRequested = false;
      return onReset();
    }
    if (action === 'select-activity') {
      if (!unlocks[ACTIVITY_UNLOCK_KEYS[rawValue]]) return notify('Discover that facility first.', 'bad');
      return applyResult(selectActivity(state, rawValue), 'select activity');
    }
    if (action === 'select-depth') return applyResult(selectMineDepth(state, Number(rawValue)), 'select mine depth');
    if (action === 'select-smelt') return applyResult(selectSmeltMetal(state, rawValue), 'select smelting metal');
    if (action === 'toggle-production') {
      state.running = !state.running;
      state.p = 0;
      state.op = 0;
      state.rad = false;
      state.view = state.running ? 'work' : state.view;
      commitAction(state.running ? 'start production' : 'stop production');
      notify(state.running ? `${ACTIVITIES[state.active].name} started` : 'Production stopped');
      return true;
    }
    if (action === 'opportunity') {
      const result = runOpportunity(state);
      if (result.ok) showWorkReward(result);
      return applyResult(result, 'claim work opportunity', value => value.radiant ? 'Radiant opportunity claimed!' : 'Opportunity claimed');
    }
    if (action === 'buy-upgrade') return applyResult(buyUpgrade(state, state.active, rawValue), `upgrade ${state.active}.${rawValue}`, result => `${UPGRADES[result.upgradeId].name} upgraded`);
    if (action === 'forge-filter') {
      forgeMetal = rawValue;
      renderBody();
      return true;
    }
    if (action === 'forge') {
      const result = forgeItem(state, rawValue);
      if (result.ok) activityVisuals.reward({
        kind: 'gear',
        amount: 1,
        label: result.item.name,
        metalColor: result.metal.color,
        ...activityStack(state, 'forging', result.metal)
      });
      return applyResult(result, `forge ${rawValue}`, value => value.quality === 'Masterwork' ? `Masterwork! ${value.item.name}` : `${value.item.name} forged`);
    }
    if (action === 'challenge-gate') {
      const depth = Number(rawValue);
      const metal = METALS[depth];
      if (!metal?.gate) return notify('That mine gate is not available.', 'bad');
      if (!canChallengeMineGate(state, depth)) return notify(`Travel to ${getMineGateLocation(depth)?.name || 'that mine'} first.`, 'bad');
      return startEncounter({
        boss: true,
        enemyId: metal.gate.id,
        gateDepth: depth,
        origin: { area: state.explore.area, pos: [...(state.explore.worldPos || [0, 0])], yaw: 0, z: 0 }
      }).ok;
    }
    if (action === 'equip') {
      const item = state.gear.find(entry => entry.id === Number(rawValue));
      return applyResult(equipItem(state, item?.type, Number(rawValue)), `equip ${rawValue}`, item ? `${item.name} equipped` : null);
    }
    if (action === 'unequip') return applyResult(equipItem(state, rawValue, null), `unequip ${rawValue}`, 'Item removed');
    if (action === 'restore') {
      if (!unlocks.projects[rawValue]) return notify('That restoration project is still locked.', 'bad');
      const restored = applyResult(restoreTown(state, rawValue), `restore ${rawValue}`, result => `${result.project.name} restored to Lv ${result.level}`);
      if (restored) {
        close();
        onBuildingUpgrade(rawValue);
      }
      return restored;
    }
    if (action === 'route-service') {
      close();
      return onJourneyAction({ serviceId: rawValue, worldAction: 'service' });
    }
    if (action === 'open-journal') return open('journal');
    if (action === 'open-market') return unlocks.market ? open('market') : notify('Find Greyfen’s market first.', 'bad');
    if (action === 'visual-style') {
      onVisualStyle(rawValue);
      renderBody(true);
      return true;
    }
    if (action === 'sell-material') {
      const [key, price, amount] = rawValue.split('|');
      const result = sellMaterial(state, key, Number(price), amount === 'all' ? 'all' : Number(amount));
      if (result.ok) recordTradeCoins(state, result.coins);
      return applyResult(result, `sell ${key}`, value => `+${value.coins} coin`);
    }
    if (action === 'sell-gear') {
      const result = sellGear(state, Number(rawValue));
      if (result.ok) recordTradeCoins(state, result.coins);
      return applyResult(result, `sell gear ${rawValue}`, value => `Sold for ${value.coins} coin`);
    }
    return false;
  }

  document.querySelectorAll('[data-open-game-tab]').forEach(element => element.addEventListener('click', () => open(element.dataset.openGameTab)));
  missionRoute?.addEventListener('click', () => performMissionAction(currentMission));
  document.getElementById('missionHelp')?.addEventListener('click', () => showIntro(true));
  document.getElementById('introBegin')?.addEventListener('click', () => hideIntro(true));
  document.getElementById('gamePanelClose').addEventListener('click', close);
  body.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (target && !target.disabled) onAction(target.dataset.action, target.dataset.value);
  });
  combatPanel.addEventListener('click', event => {
    const drafted = event.target.closest('[data-draft-card]');
    if (drafted) {
      const result = chooseCaveCardReward(getState(), drafted.dataset.draftCard);
      if (!result.ok) return notify(result.message, 'bad');
      commitAction(`add temporary ${result.card.id} card`);
      notify(`${result.card.name} added for this expedition`, 'gold');
      return;
    }
    const skipped = event.target.closest('[data-draft-skip]');
    if (skipped) {
      const result = skipCaveCardReward(getState());
      if (!result.ok) return notify(result.message, 'bad');
      commitAction('skip temporary card reward');
      notify('+6 coin · run deck unchanged', 'gold');
      return;
    }
    const card = event.target.closest('[data-combat-card]');
    if (card && !card.disabled) {
      const viewBefore = getCombatView(getState());
      const result = playExploreCard(getState(), Number(card.dataset.combatCard));
      if (!result.ok) return notify(result.message, 'bad');
      if (result.victory && viewBefore) {
        showCombatEffect({ enemy: 'fx-defeat', weapon: 'hero-strike', impact: 'VICTORY', duration: 980, outro: outroSnapshot(viewBefore, { type: 'victory', log: `${result.enemy.name} falls. The road is clear.` }) });
      } else if (result.justBroken) showCombatEffect({ enemy: 'fx-break', weapon: 'hero-strike', impact: 'BREAK', duration: 620 });
      else if (result.damage) showCombatEffect({ enemy: 'fx-hit', weapon: 'hero-strike', impact: `-${result.damage}`, duration: 460 });
      commitAction(`play combat card ${result.cardId}`);
      if (result.victory) notify(`${result.enemy.name} defeated · +${result.coins}c · +${result.xp} XP`, 'gold');
      else if (result.justBroken) notify('BREAK! Enemy intent cancelled.', 'gold');
      return;
    }
    const end = event.target.closest('[data-combat-end]');
    if (end && !end.disabled) {
      const viewBefore = getCombatView(getState());
      const result = endExploreTurn(getState());
      if (!result.ok) return notify(result.message, 'bad');
      if (result.defeat && viewBefore) {
        showCombatEffect({ enemy: 'fx-attack', player: 'player-hit', weapon: 'player-hit', impact: 'DEFEAT', duration: 820, outro: outroSnapshot(viewBefore, { type: 'defeat', log: 'The hero is overwhelmed and retreats to Greyfen.' }) });
      } else if (result.staggered) showCombatEffect({ enemy: 'fx-break', impact: 'STAGGER', duration: 580 });
      else showCombatEffect({ enemy: 'fx-attack', player: result.taken ? 'player-hit' : '', weapon: result.taken ? 'player-hit' : '', impact: result.taken ? `-${result.taken}` : result.evaded ? 'EVADE' : result.mitigated ? 'ARMOUR' : 'BLOCK', duration: 580 });
      commitAction('resolve enemy combat turn');
      if (result.defeat) notify('You were forced back to Greyfen.', 'bad');
      else if (result.staggered) notify('Enemy staggered · attack cancelled', 'gold');
      else notify(result.taken ? `${result.taken} damage taken${result.mitigated ? ` · armour stopped ${result.mitigated}` : ''}` : result.evaded ? `${result.evaded} hit${result.evaded === 1 ? '' : 's'} evaded` : result.mitigated ? 'Armour absorbed the attack' : 'Attack fully blocked');
    }
  });

  const offline = simulateOfflineWork(getState(), { requireWorkView: false });
  if (offline.cycles > 0) {
    commitAction('simulate offline production');
    setTimeout(() => notify(`Away: ${offline.cycles} ${ACTIVITIES[getState().active].name} cycles`), 550);
  }

  const timer = setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.5, (now - lastTick) / 1000);
    lastTick = now;
    let state = getState();
    if (state.running) {
      state.p += dt / getCycleSeconds(state);
      while (state.p >= 1) {
        state.p -= 1;
        const result = runWorkCycle(state);
        if (!result.ok) {
          state.p = 0;
          commitAction('production stopped');
          notify(result.message, 'bad');
          break;
        }
        showWorkReward(result);
        commitAction(`${result.activity} cycle`, true);
        state = getState();
        if (result.critical && result.amount > 0) notify(`Critical! +${result.amount} ${result.metal?.name || 'Training'}`, 'gold');
      }
      const before = state.op;
      state.op = Math.min(1, state.op + dt / getOpportunitySeconds(state));
      if (before < 1 && state.op >= 1) {
        state.rad = Math.random() < getRadiantChance(state);
        debug?.log('GAMEPLAY', state.rad ? 'radiant opportunity ready' : 'work opportunity ready', state.active);
      }
    }
    if (panel.classList.contains('show')) updateLiveIndicators();
    if (panel.classList.contains('show') && ['work', 'forge'].includes(activeTab)) {
      const state = getState();
      const mode = activeTab === 'forge' ? 'forging' : state.active;
      const selectedMetal = activityMetal(state, mode);
      activityVisuals.update({
        running: activeTab === 'work' && state.running,
        progress: state.p,
        metalColor: selectedMetal?.color,
        ...activityStack(state, mode, selectedMetal)
      });
    }
  }, 180);

  render();
  if (getState().explore?.combat) debug?.log('COMBAT', 'resumed compatible saved battle', getState().explore.combat.enemyId);
  debug?.log('GAMEPLAY', 'economy UI connected', { offlineCycles: offline.cycles });
  function startEncounter(options = {}) {
    const result = startExploreCombat(getState(), options);
    if (!result.ok) {
      notify(result.message, 'bad');
      return result;
    }
    combatOutro = null;
    combatFx = { enemy: '', player: '', weapon: '', impact: '' };
    clearTimeout(combatFxTimer);
    commitAction(options.boss ? 'start boss combat' : 'start travel combat');
    debug?.log('COMBAT', 'battle started', result.enemy.id, { boss: Boolean(options.boss) });
    return result;
  }
  return { open, close, render, renderJourney, notify, startEncounter, showIntro, maybeShowIntro: () => showIntro(false), destroy: () => { clearInterval(timer); clearTimeout(combatFxTimer); activityVisuals.destroy(); } };
}
