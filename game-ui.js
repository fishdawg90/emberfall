import { ACTIVITIES, EQUIPMENT_SLOTS, METALS, RECIPES, TOWN_PROJECTS, UPGRADES } from './game-catalog.js';
import { endExploreTurn, getCombatView, playExploreCard, startExploreCombat } from './combat-services.js';
import { createActivityVisuals } from './activity-visuals.js';
import { cardArtMarkup, combatSceneryMarkup, enemyFigureMarkup, playerWeaponMarkup } from './combat-visuals.js';
import { canChallengeMineGate, getGreyfenTasks, getJourneyObjective, getMineGateLocation, recordTradeCoins } from './journey-services.js';
import {
  buyUpgrade,
  equipItem,
  forgeItem,
  getCycleSeconds,
  getEquipment,
  getMaterialRows,
  getOpportunitySeconds,
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

const TAB_LABELS = Object.freeze({ work: 'Production', forge: 'Forge', gear: 'Equipment', town: 'Greyfen', market: 'Market' });

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

export function createGameUI({ getState, commit, onJourneyAction = () => false, debug = window.EmberDebug }) {
  const panel = document.getElementById('gamePanel');
  const body = document.getElementById('gamePanelBody');
  const title = document.getElementById('gamePanelTitle');
  const toast = document.getElementById('gameToast');
  const hud = document.getElementById('gameMenuButton');
  const combatPanel = document.getElementById('combatPanel');
  const journeyHud = document.getElementById('journeyHud');
  const journeyIcon = document.getElementById('journeyIcon');
  const journeyChapter = document.getElementById('journeyChapter');
  const journeyTitle = document.getElementById('journeyTitle');
  const journeyDetail = document.getElementById('journeyDetail');
  const journeyGo = document.getElementById('journeyGo');
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
  let currentObjective = null;

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
    document.querySelectorAll('[data-open-game-tab]').forEach(element => element.classList.toggle('running', element.dataset.openGameTab === 'work' && state.running));
    renderJourney();
  }

  function renderJourney() {
    currentObjective = getJourneyObjective(getState());
    if (!journeyHud || !currentObjective) return;
    journeyIcon.textContent = currentObjective.icon;
    journeyChapter.textContent = currentObjective.chapter;
    journeyTitle.textContent = currentObjective.title;
    journeyDetail.textContent = currentObjective.detail;
    journeyGo.textContent = currentObjective.button;
    journeyHud.dataset.objective = currentObjective.id;
  }

  function loopRibbon() {
    const stages = [
      ['work', '⛏', 'Work'],
      ['forge', '⚒', 'Forge'],
      ['gear', '⚔', 'Equip'],
      ['world', '◆', 'Explore'],
      ['town', '⌂', 'Restore']
    ];
    return `<nav class="systemThread" aria-label="Core game loop">${stages.map(([tab, icon, label]) => `<button class="${tab === activeTab || tab === 'town' && activeTab === 'market' ? 'active' : ''}" data-action="loop-tab" data-value="${tab}"><i>${icon}</i>${label}</button>`).join('')}</nav>`;
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

  function renderWork() {
    const state = getState();
    const activity = ACTIVITIES[state.active];
    const cycle = getCycleSeconds(state);
    const material = state.active === 'mining'
      ? METALS[state.depth]
      : METALS.find(metal => metal.id === state.smelt) || METALS[0];
    const activityButtons = Object.entries(ACTIVITIES).map(([id, item]) => button(
      `<b>${item.icon}</b><span>${item.name}</span>`,
      'select-activity',
      id,
      false,
      `activityChoice ${state.active === id ? 'active' : ''}`
    )).join('');
    const selectors = state.active === 'mining'
      ? `<div class="choiceRow">${METALS.map((metal, index) => button(`${metal.icon} ${metal.name}`, 'select-depth', index, index > state.open, index === state.depth ? 'active' : '')).join('')}</div>`
      : state.active === 'smelting'
        ? `<div class="choiceRow">${METALS.map(metal => button(`${metal.icon} ${metal.name}`, 'select-smelt', metal.id, state.skills.smelting.l < metal.smelt, metal.id === state.smelt ? 'active' : '')).join('')}</div>`
        : '';
    const facilityMultiplier = state.active === 'smelting' ? getSmelterMultiplier(state, material.id) : 1;
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
    const nextDepth = Math.min(METALS.length - 1, state.open + 1);
    const gateMetal = state.open < METALS.length - 1 ? METALS[nextDepth] : null;
    const gateLocation = getMineGateLocation(nextDepth);
    const atGate = canChallengeMineGate(state, nextDepth);
    const gateReady = gateMetal && atGate && state.skills.mining.l >= gateMetal.mine;
    const gateCard = gateMetal && nextDepth > 1 && state.active === 'mining' ? `<section class="gameCard gateCard"><small>${atGate ? 'LOCAL MINE GATE' : 'MINE FOUND IN THE WORLD'}</small><strong>${gateMetal.icon} ${gateMetal.place}</strong><p>${gateMetal.gate.name} guards ${gateMetal.name} beneath ${gateLocation?.name || 'a distant town'}. ${atGate ? `Reach Mining Lv ${gateMetal.mine}, then challenge it here.` : 'Use the Journey route to reach this mine.'}</p>${button(gateReady ? `Challenge ${gateMetal.gate.name}` : atGate ? `Mining Lv ${state.skills.mining.l}/${gateMetal.mine}` : `Travel to ${gateLocation?.name || 'mine'}`, 'challenge-gate', nextDepth, !gateReady, gateReady ? 'primary' : '')}</section>` : '';

    return `<div class="activityGrid">${activityButtons}</div>
      <section class="gameCard heroCard" style="--metal:${material.color}">
        <div><small>CURRENT WORK</small><h3>${activity.icon} ${activity.name}</h3><p>${materialLine}</p></div>
        <span>${cycle.toFixed(1)}s cycle</span>
        <div class="productionTrack"><i id="productionProgress"></i></div>
        <div class="gameActions">
          ${button(state.running ? 'Stop work' : `Start ${activity.name}`, 'toggle-production', '', false, state.running ? 'danger' : 'primary')}
          ${button(state.rad ? 'Radiant opportunity!' : 'Work opportunity', 'opportunity', '', state.op < 1, state.rad ? 'radiant' : '')}
        </div>
      </section>
      ${selectors}
      ${skillStrip(state.active)}
      ${gateCard}
      <h3 class="sectionTitle">${activity.name} upgrades</h3>
      <div class="serviceList">${upgrades}</div><div class="loopCallout"><b>Why this matters:</b> mine ore, smelt it into bars, then forge gear for the expedition deck. Production keeps running while you walk the world.</div>`;
  }

  function renderForge() {
    const state = getState();
    const metalChoices = METALS.map(metal => button(`${metal.icon} ${metal.name}`, 'forge-filter', metal.id, false, metal.id === forgeMetal ? 'active' : '')).join('');
    const recipes = RECIPES.filter(recipe => recipe.m === forgeMetal).map(recipe => {
      const metal = METALS.find(entry => entry.id === recipe.m);
      const locked = state.skills.forging.l < recipe.req;
      const short = state.inv[`${metal.id}Bar`] < recipe.bars;
      return `<div class="recipeCard" style="--metal:${metal.color}">
        <div><small>${recipe.type.toUpperCase()} · FORGE ${recipe.req}</small><strong>${recipe.name}</strong><span>${recipe.atk ? `+${recipe.atk} ATK` : `+${recipe.def} DEF`} · value ${recipe.val}c</span></div>
        ${button(locked ? `Lv ${recipe.req}` : `${recipe.bars} bars`, 'forge', recipe.id, locked || short, 'forgeButton')}
      </div>`;
    }).join('');
    return `${skillStrip('forging')}<div class="choiceRow metalTabs">${metalChoices}</div><div class="recipeList">${recipes}</div><div class="loopCallout"><b>Gear changes combat:</b> weapons add stronger attack cards; armour raises expedition health and improves Block.</div>`;
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
    return `<div class="combatTotals"><span><small>ATTACK</small><b>${equipment.atk}</b></span><span><small>DEFENCE</small><b>${equipment.def}</b></span></div><div class="loopCallout"><b>Your loadout is your deck:</b> better weapons replace basic attacks, while defence adds health and stronger guard values.</div><h3 class="sectionTitle">Equipped</h3><div class="slotGrid">${slots}</div><h3 class="sectionTitle">Inventory</h3><div class="inventoryList">${inventory}</div>`;
  }

  function renderTown() {
    const state = getState();
    const tasks = getGreyfenTasks(state).map(task => `<div class="townTask ${task.complete ? 'complete' : ''}"><i>${task.complete ? '✓' : task.icon}</i><div><strong>${task.title}</strong><span>${task.complete ? 'Complete' : task.progress || 'Not yet found'}</span></div>${task.complete ? '' : task.serviceId ? button('Route', 'route-service', task.serviceId) : button('Trade', 'open-market')}</div>`).join('');
    const projects = Object.entries(TOWN_PROJECTS).map(([id, project]) => {
      const level = getTownLevel(state, id);
      const maxed = level >= project.max;
      const cost = getTownCost(state, id);
      return `<div class="townCard"><div class="townLevel"><i style="width:${level / project.max * 100}%"></i></div><div><small>LEVEL ${level}/${project.max}</small><strong>${project.name}</strong><span>${project.desc}</span></div>${button(maxed ? 'Restored' : `${cost} coin`, 'restore', id, maxed || state.coins < cost, maxed ? '' : 'primary')}</div>`;
    }).join('');
    return `<div class="townIntro"><small>GREYFEN TASK BOARD</small><h3>Learn the town, then open the roads</h3><p>Complete these local tasks to reveal the first destination beyond Greyfen’s safe boundary.</p></div><div class="townTasks">${tasks}</div><h3 class="sectionTitle">Restoration projects</h3><div class="townList">${projects}</div>`;
  }

  function renderMarket() {
    const state = getState();
    const materials = getMaterialRows(state).filter(row => row.tier <= state.open).map(row => `<div class="marketRow" style="--metal:${row.metal.color}"><i>${row.metal.icon}</i><div><strong>${row.name}</strong><span>${row.count} owned · ${row.value}c each</span></div>${button('Sell 1', 'sell-material', `${row.key}|${row.value}|1`, row.count < 1)}${button('All', 'sell-material', `${row.key}|${row.value}|all`, row.count < 1)}</div>`).join('');
    const gear = state.gear.filter(item => !Object.values(state.eq).includes(item.id)).map(item => `<div class="marketRow"><i>⚒</i><div><strong>${escapeHtml(item.name)}</strong><span>${statText(item)} · ${item.val}c base</span></div>${button('Sell', 'sell-gear', item.id)}</div>`).join('');
    const marketMultiplier = 1 + (Math.max(1, getTownLevel(state, 'market')) - 1) * 0.05;
    return `<div class="marketBanner">Market Lv ${getTownLevel(state, 'market')} <span>Sale prices ×${marketMultiplier.toFixed(2)}</span></div><div class="loopCallout"><b>Trade with a purpose:</b> sell surplus ore, bars and old gear to fund visible Greyfen restoration projects.</div><h3 class="sectionTitle">Materials</h3><div class="marketList">${materials}</div><h3 class="sectionTitle">Spare equipment</h3><div class="marketList">${gear || '<div class="emptyState">No unequipped gear to sell.</div>'}</div>`;
  }

  function renderCombat() {
    const state = getState();
    const liveView = getCombatView(state);
    const view = liveView || combatOutro?.view;
    if (!view) {
      combatPanel.classList.remove('show');
      combatPanel.setAttribute('aria-hidden', 'true');
      combatPanel.replaceChildren();
      return;
    }
    activityVisuals.hide();
    panel.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
    const { combat, enemy, intent, cards } = view;
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
    combatPanel.innerHTML = `<div class="combatTop"><div class="combatEnemy"><div class="combatEnemyHead"><strong>${combat.boss ? '☇ ' : ''}${enemy.name}</strong><span>${combat.hp}/${combat.maxHp} HP</span></div><div class="combatBars"><div class="combatBar hp"><i style="width:${enemyHp}%"></i><em>HEALTH</em></div><div class="combatBar guard"><i style="width:${guard}%"></i><em>${combat.broken ? 'BROKEN' : `${combat.guard}/${combat.guardMax} BREAK GUARD`}</em></div></div></div><div class="combatIntent"><small>${outro ? 'RESULT' : 'INTENT'}</small><strong>${outro ? (combatOutro.type === 'victory' ? 'Defeated' : 'Overwhelmed') : combat.broken ? 'Staggered' : intent.name}</strong><span>${outro ? (combatOutro.type === 'victory' ? 'Rewards secured' : 'Returning to Greyfen') : combat.broken ? 'Attack cancelled' : intent.text}</span></div></div><div class="combatArena area-${area} ${combatFx.player}">${combatSceneryMarkup(area)}${enemyFigure}${weaponFigure}${combatFx.impact ? `<strong class="combatImpact">${escapeHtml(combatFx.impact)}</strong>` : ''}</div><div class="combatBottom"><div class="combatPlayer"><div class="combatPlayerCard"><div class="combatPlayerHead"><strong>Hero · Turn ${combat.turn}</strong><span>${currentPlayerHp}/${expeditionMaxHp} HP${combat.block ? ` · ${combat.block} Block` : ''}</span></div><div class="combatBar player"><i style="width:${playerHp}%"></i><em>EXPEDITION HEALTH</em></div></div><div class="combatEnergy"><b>${combat.energy}</b> ENERGY</div></div><div class="combatLog">${escapeHtml(combat.log)}${state.explore.encounters < 2 ? '<small>Break the blue guard to cancel the shown enemy intent.</small>' : ''}</div><div class="combatHand">${hand}</div><button class="combatEnd" data-combat-end ${outro || combat.resolving ? 'disabled' : ''}>${outro ? 'Resolving battle…' : 'End turn · enemy acts'}</button></div>`;
    combatPanel.classList.add('show');
    combatPanel.setAttribute('aria-hidden', 'false');
  }

  function renderBody(preserveScroll = false) {
    const scrollTop = body.scrollTop;
    const renderers = { work: renderWork, forge: renderForge, gear: renderGear, town: renderTown, market: renderMarket };
    title.textContent = TAB_LABELS[activeTab];
    document.querySelectorAll('[data-game-tab]').forEach(element => element.classList.toggle('active', element.dataset.gameTab === activeTab));
    body.innerHTML = loopRibbon() + renderers[activeTab]();
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
    activeTab = TAB_LABELS[tab] ? tab : 'work';
    panel.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    renderBody();
  }

  function close() {
    panel.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
    activityVisuals.hide();
  }

  function onAction(action, rawValue) {
    const state = getState();
    if (action === 'loop-tab') {
      if (rawValue === 'world') close();
      else open(rawValue);
      return true;
    }
    if (action === 'select-activity') return applyResult(selectActivity(state, rawValue), 'select activity');
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
    if (action === 'restore') return applyResult(restoreTown(state, rawValue), `restore ${rawValue}`, result => `${result.project.name} restored to Lv ${result.level}`);
    if (action === 'route-service') {
      close();
      return onJourneyAction({ serviceId: rawValue, worldAction: 'service' });
    }
    if (action === 'open-market') return open('market');
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
  journeyGo?.addEventListener('click', () => {
    const goal = currentObjective || getJourneyObjective(getState());
    if (!goal || getState().explore?.combat) return;
    if (goal.activity && getState().active !== goal.activity) {
      const result = selectActivity(getState(), goal.activity);
      if (result.ok) commitAction(`journey selects ${goal.activity}`);
    }
    if (goal.metalId) forgeMetal = goal.metalId;
    if (goal.gateDepth) return onAction('challenge-gate', goal.gateDepth);
    if (goal.landmarkId || goal.serviceId) {
      close();
      return onJourneyAction(goal);
    }
    if (goal.tab) open(goal.tab);
  });
  document.getElementById('journeyHelp')?.addEventListener('click', () => showIntro(true));
  document.getElementById('introBegin')?.addEventListener('click', () => hideIntro(true));
  document.getElementById('gamePanelClose').addEventListener('click', close);
  document.getElementById('gamePanelTabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-game-tab]');
    if (tab) open(tab.dataset.gameTab);
  });
  body.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (target && !target.disabled) onAction(target.dataset.action, target.dataset.value);
  });
  combatPanel.addEventListener('click', event => {
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
      else showCombatEffect({ enemy: 'fx-attack', player: result.taken ? 'player-hit' : '', weapon: result.taken ? 'player-hit' : '', impact: result.taken ? `-${result.taken}` : 'BLOCK', duration: 580 });
      commitAction('resolve enemy combat turn');
      if (result.defeat) notify('You were forced back to Greyfen.', 'bad');
      else if (result.staggered) notify('Enemy staggered · attack cancelled', 'gold');
      else notify(result.taken ? `${result.taken} damage taken` : 'Attack fully blocked');
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
        if (result.critical) notify(`Critical! +${result.amount} ${result.metal?.name || 'Training'}`, 'gold');
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
