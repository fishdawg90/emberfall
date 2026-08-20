import { ACTIVITIES, EQUIPMENT_SLOTS, METALS, RECIPES, TOWN_PROJECTS, UPGRADES } from './game-catalog.js';
import { endExploreTurn, getCombatView, playExploreCard, startExploreCombat } from './combat-services.js';
import {
  buyUpgrade,
  equipItem,
  forgeItem,
  getCycleSeconds,
  getEquipment,
  getMaterialRows,
  getOpportunitySeconds,
  getRadiantChance,
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

export function createGameUI({ getState, commit, debug = window.EmberDebug }) {
  const panel = document.getElementById('gamePanel');
  const body = document.getElementById('gamePanelBody');
  const title = document.getElementById('gamePanelTitle');
  const toast = document.getElementById('gameToast');
  const hud = document.getElementById('gameMenuButton');
  const combatPanel = document.getElementById('combatPanel');
  let activeTab = 'work';
  let forgeMetal = METALS.find(metal => metal.id === RECIPES.find(recipe => recipe.id === getState().selectedRecipe)?.m)?.id || 'iron';
  let toastTimer = 0;
  let lastTick = performance.now();

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
  }

  function skillStrip(id) {
    const state = getState();
    const skill = state.skills[id];
    const needed = skillXpNeeded(skill.l);
    return `<div class="skillStrip"><span>Lv ${skill.l}</span><div><i style="width:${Math.min(100, skill.x / needed * 100)}%"></i></div><small>${skill.x} / ${needed} XP</small></div>`;
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
    const materialLine = state.active === 'mining'
      ? `${state.inv[`${material.id}Ore`]} ${material.ore}`
      : state.active === 'smelting'
        ? `${state.inv[`${material.id}Ore`]} ore → ${state.inv[`${material.id}Bar`]} bars`
        : 'Combat skill XP improves mine-gate battles';
    const upgrades = Object.entries(UPGRADES).map(([id, upgrade]) => {
      const rank = state.up[state.active][id];
      const cost = getUpgradeCost(state, state.active, id);
      const maxed = !Number.isFinite(cost);
      const available = upgrade.currency === 'coin' ? state.coins : state.skills[state.active].s;
      return `<div class="serviceRow"><div><strong>${upgrade.name} <em>${rank}/${upgrade.cap}</em></strong><small>${upgrade.desc}</small></div>${button(maxed ? 'MAX' : `${cost} ${upgrade.currency}`, 'buy-upgrade', id, maxed || available < cost)}</div>`;
    }).join('');

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
      <h3 class="sectionTitle">${activity.name} upgrades</h3>
      <div class="serviceList">${upgrades}</div>`;
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
    return `${skillStrip('forging')}<div class="choiceRow metalTabs">${metalChoices}</div><div class="recipeList">${recipes}</div>`;
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
    return `<div class="combatTotals"><span><small>ATTACK</small><b>${equipment.atk}</b></span><span><small>DEFENCE</small><b>${equipment.def}</b></span></div><h3 class="sectionTitle">Equipped</h3><div class="slotGrid">${slots}</div><h3 class="sectionTitle">Inventory</h3><div class="inventoryList">${inventory}</div>`;
  }

  function renderTown() {
    const state = getState();
    const projects = Object.entries(TOWN_PROJECTS).map(([id, project]) => {
      const level = getTownLevel(state, id);
      const maxed = level >= project.max;
      const cost = getTownCost(state, id);
      return `<div class="townCard"><div class="townLevel"><i style="width:${level / project.max * 100}%"></i></div><div><small>LEVEL ${level}/${project.max}</small><strong>${project.name}</strong><span>${project.desc}</span></div>${button(maxed ? 'Restored' : `${cost} coin`, 'restore', id, maxed || state.coins < cost, maxed ? '' : 'primary')}</div>`;
    }).join('');
    return `<div class="townIntro"><small>GREYFEN RESTORATION</small><h3>Bring the town back to life</h3><p>Every project uses the original persistent town levels and directly improves production, forging, trading, or expedition health.</p></div><div class="townList">${projects}</div>`;
  }

  function renderMarket() {
    const state = getState();
    const materials = getMaterialRows(state).filter(row => row.tier <= state.open).map(row => `<div class="marketRow" style="--metal:${row.metal.color}"><i>${row.metal.icon}</i><div><strong>${row.name}</strong><span>${row.count} owned · ${row.value}c each</span></div>${button('Sell 1', 'sell-material', `${row.key}|${row.value}|1`, row.count < 1)}${button('All', 'sell-material', `${row.key}|${row.value}|all`, row.count < 1)}</div>`).join('');
    const gear = state.gear.filter(item => !Object.values(state.eq).includes(item.id)).map(item => `<div class="marketRow"><i>⚒</i><div><strong>${escapeHtml(item.name)}</strong><span>${statText(item)} · ${item.val}c base</span></div>${button('Sell', 'sell-gear', item.id)}</div>`).join('');
    const marketMultiplier = 1 + (Math.max(1, getTownLevel(state, 'market')) - 1) * 0.05;
    return `<div class="marketBanner">Market Lv ${getTownLevel(state, 'market')} <span>Sale prices ×${marketMultiplier.toFixed(2)}</span></div><h3 class="sectionTitle">Materials</h3><div class="marketList">${materials}</div><h3 class="sectionTitle">Spare equipment</h3><div class="marketList">${gear || '<div class="emptyState">No unequipped gear to sell.</div>'}</div>`;
  }

  function renderCombat() {
    const state = getState();
    const view = getCombatView(state);
    if (!view) {
      combatPanel.classList.remove('show');
      combatPanel.setAttribute('aria-hidden', 'true');
      combatPanel.replaceChildren();
      return;
    }
    panel.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
    const { combat, enemy, intent, cards } = view;
    const enemyHp = Math.max(0, combat.hp / combat.maxHp * 100);
    const guard = Math.max(0, combat.guard / combat.guardMax * 100);
    const expeditionMaxHp = state.explore.maxHp || view.maxHp;
    const playerHp = Math.max(0, state.explore.hp / expeditionMaxHp * 100);
    const hand = cards.map((card, index) => {
      const offset = index - (cards.length - 1) / 2;
      const disabled = card.cost > combat.energy || combat.resolving;
      return `<button class="combatCard" data-combat-card="${index}" style="--fan-r:${(offset * 2.4).toFixed(1)}deg;--fan-y:${Math.abs(offset * 2.2).toFixed(1)}px" ${disabled ? 'disabled' : ''}><span class="combatCardCost">${card.cost}</span><span class="combatCardIcon">${card.icon}</span><strong>${card.name}</strong><small>${card.text}</small><em>${card.kind}</em></button>`;
    }).join('');
    combatPanel.innerHTML = `<div class="combatTop"><div class="combatEnemy"><div class="combatEnemyHead"><strong>${combat.boss ? '☇ ' : ''}${enemy.name}</strong><span>${combat.hp}/${combat.maxHp} HP</span></div><div class="combatBars"><div class="combatBar hp"><i style="width:${enemyHp}%"></i><em>HEALTH</em></div><div class="combatBar guard"><i style="width:${guard}%"></i><em>${combat.broken ? 'BROKEN' : `${combat.guard}/${combat.guardMax} BREAK GUARD`}</em></div></div></div><div class="combatIntent"><small>INTENT</small><strong>${combat.broken ? 'Staggered' : intent.name}</strong><span>${combat.broken ? 'Attack cancelled' : intent.text}</span></div></div><div class="combatArena"><div class="combatEnemyFigure">${enemy.icon}</div></div><div class="combatBottom"><div class="combatPlayer"><div class="combatPlayerCard"><div class="combatPlayerHead"><strong>Hero · Turn ${combat.turn}</strong><span>${state.explore.hp}/${expeditionMaxHp} HP${combat.block ? ` · ${combat.block} Block` : ''}</span></div><div class="combatBar player"><i style="width:${playerHp}%"></i><em>EXPEDITION HEALTH</em></div></div><div class="combatEnergy"><b>${combat.energy}</b> ENERGY</div></div><div class="combatLog">${escapeHtml(combat.log)}</div><div class="combatHand">${hand}</div><button class="combatEnd" data-combat-end ${combat.resolving ? 'disabled' : ''}>End turn · enemy acts</button></div>`;
    combatPanel.classList.add('show');
    combatPanel.setAttribute('aria-hidden', 'false');
  }

  function renderBody(preserveScroll = false) {
    const scrollTop = body.scrollTop;
    const renderers = { work: renderWork, forge: renderForge, gear: renderGear, town: renderTown, market: renderMarket };
    title.textContent = TAB_LABELS[activeTab];
    document.querySelectorAll('[data-game-tab]').forEach(element => element.classList.toggle('active', element.dataset.gameTab === activeTab));
    body.innerHTML = renderers[activeTab]();
    updateLiveIndicators();
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
  }

  function onAction(action, rawValue) {
    const state = getState();
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
    if (action === 'opportunity') return applyResult(runOpportunity(state), 'claim work opportunity', result => result.radiant ? 'Radiant opportunity claimed!' : 'Opportunity claimed');
    if (action === 'buy-upgrade') return applyResult(buyUpgrade(state, state.active, rawValue), `upgrade ${state.active}.${rawValue}`, result => `${UPGRADES[result.upgradeId].name} upgraded`);
    if (action === 'forge-filter') {
      forgeMetal = rawValue;
      renderBody();
      return true;
    }
    if (action === 'forge') return applyResult(forgeItem(state, rawValue), `forge ${rawValue}`, result => result.quality === 'Masterwork' ? `Masterwork! ${result.item.name}` : `${result.item.name} forged`);
    if (action === 'equip') {
      const item = state.gear.find(entry => entry.id === Number(rawValue));
      return applyResult(equipItem(state, item?.type, Number(rawValue)), `equip ${rawValue}`, item ? `${item.name} equipped` : null);
    }
    if (action === 'unequip') return applyResult(equipItem(state, rawValue, null), `unequip ${rawValue}`, 'Item removed');
    if (action === 'restore') return applyResult(restoreTown(state, rawValue), `restore ${rawValue}`, result => `${result.project.name} restored to Lv ${result.level}`);
    if (action === 'sell-material') {
      const [key, price, amount] = rawValue.split('|');
      return applyResult(sellMaterial(state, key, Number(price), amount === 'all' ? 'all' : Number(amount)), `sell ${key}`, result => `+${result.coins} coin`);
    }
    if (action === 'sell-gear') return applyResult(sellGear(state, Number(rawValue)), `sell gear ${rawValue}`, result => `Sold for ${result.coins} coin`);
    return false;
  }

  document.querySelectorAll('[data-open-game-tab]').forEach(element => element.addEventListener('click', () => open(element.dataset.openGameTab)));
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
      const result = playExploreCard(getState(), Number(card.dataset.combatCard));
      if (!result.ok) return notify(result.message, 'bad');
      commitAction(`play combat card ${result.cardId}`);
      if (result.victory) notify(`${result.enemy.name} defeated · +${result.coins}c · +${result.xp} XP`, 'gold');
      else if (result.justBroken) notify('BREAK! Enemy intent cancelled.', 'gold');
      return;
    }
    const end = event.target.closest('[data-combat-end]');
    if (end && !end.disabled) {
      const result = endExploreTurn(getState());
      if (!result.ok) return notify(result.message, 'bad');
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
    commitAction(options.boss ? 'start boss combat' : 'start travel combat');
    debug?.log('COMBAT', 'battle started', result.enemy.id, { boss: Boolean(options.boss) });
    return result;
  }
  return { open, close, render, notify, startEncounter, destroy: () => clearInterval(timer) };
}
