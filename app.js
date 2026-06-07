// MLP & Solar — Finnish Energy Transition Consultant
'use strict';

// ── State ──────────────────────────────────────────────────────────────
const data = {};
let currentStage = 0;
let currentSaveId = null;

// ── Service Cost Model ─────────────────────────────────────────────────
// All one-time costs reflect expected FUTURE prices at time of replacement,
// accounting for technology maturation and increased market competition.
// Annual costs are in today's euros (conservative, not inflation-adjusted).
const SVC = {
  mlpAnnual:          300,   // €/yr — maalämpö annual service (filter, sensors, refrigerant check)
  klAnnual:           500,   // €/yr — kaukolämpö annual service (heat exchanger, pumps, controls)
  pumpUnitCost:     20000,   // € per pump unit at replacement ~year 22 (future price, -25% vs today)
  pumpReplYear:        22,   // year pump units are replaced (mid-lifecycle)
  pumpUnitsPerMwh:    200,   // MWh annual heat demand per pump unit
  inverterCost:      1800,   // € per solar inverter at replacement ~year 12 (future price)
  inverterYears:  [12, 25, 38], // inverter replacement years (12-13yr lifespan)
  panelReplCost:    20000,   // € solar panel system replacement at year 30
  panelReplYear:       30,
  solarInspCost:      600,   // € per solar inspection (every 4 years)
  solarInspInterval:    4,
  klHeatExchCost:   17500,   // € per KL heat exchanger unit replacement
  klHeatExchYears: [22, 42], // KL needs TWO heat exchanger replacements over 50 years (20-25yr lifespan)
  copImprovement:     0.5,   // COP gain modeled at pump replacement (conservative: ~0.1 COP/decade historically)
  copImprovementYear:  22,   // year new pump with improved COP is installed
};

// ── DOM refs ───────────────────────────────────────────────────────────
const heroSection   = document.getElementById('heroSection');
const chatSection   = document.getElementById('chatSection');
const reportSection = document.getElementById('reportSection');
const chatMessages  = document.getElementById('chatMessages');
const inputWrapper  = document.getElementById('inputWrapper');
const btnSend       = document.getElementById('btnSend');
const dataItems     = document.getElementById('dataItems');

// ── Conversation stages ────────────────────────────────────────────────
const stages = [
  {
    step: 1,
    botMsg: `Tervetuloa! 👋 Olen energia-analyysikonsulttisi. Selvitetään yhdessä, paljonko taloyhtiösi säästää siirtymällä kaukolämmöstä maalämpöön.\n\nAloitetaan <strong>nykyisestä kaukolämpötilanteesta</strong>. Tarvitsen muutaman perustiedon:`,
    inputs: [
      { key:'kwhYear',    label:'Vuotuinen kaukolämpökulutus (MWh)',   placeholder:'esim. 250',   unit:'MWh'  },
      { key:'monthlyFee', label:'Kiinteä kuukausimaksu (€/kk)',         placeholder:'esim. 120',   unit:'€/kk' },
      { key:'yearlyTotal',label:'Kokonaislämmityskustannus/vuosi (€)',  placeholder:'esim. 22000', unit:'€/v'  },
    ],
    extraInputs: [
      { key:'vastikeMode', type:'radio', label:'Miten vastikelaskenta toimii taloyhtiössänne?',
        opts: [
          { val:'m2',    label:'€/m²/kk — neliöperusteinen 📐' },
          { val:'osake', label:'snt/osake/kk — osakeperusteinen 🏷️' }
        ]
      },
      { key:'hoitovastike', label:'Nykyinen hoitovastike',    placeholder:'esim. 4.50',  unit:'€/m²', unitOsake:'snt/osake' },
      { key:'totalBase',    label:'Taloyhtiön kokonaispinta-ala (m²)',  placeholder:'esim. 1200',  unit:'m²', labelOsake:'Osakkeiden kokonaismäärä (kpl)', unitOsake:'osaketta', placeholderOsake:'esim. 71850'   },
    ],
    sidebarLabels: {
      kwhYear:'Kulutus (MWh)', monthlyFee:'Kiinteä maksu', yearlyTotal:'Kokonaiskustannus', hoitovastike:'Hoitovastike', totalBase:'Pinta-ala / Osakkeet'
    }
  },
  {
    step: 2,
    botMsg: `Mahtavaa, kiitos! ⚡ Maalämpö toimii lämpöpumpulla — sen hyötysuhde eli <strong>COP-kerroin</strong> kertoo kuinka monta lämpö-MWh saadaan yhdellä sähkö-MWh:lla.\n\nLaadukas maalämpöpumppu saavuttaa COP-arvon <strong>2.8–4.5</strong>. Huom: kaukolämpöhinta nousee historiallisesti 1–3% vuodessa.`,
    inputs: [
      { key:'cop',           label:'Lämpöpumpun COP-kerroin',                     placeholder:'3.2',   unit:''      },
      { key:'elecPrice',     label:'Sähkön hinta (€/MWh, sis. siirto ja verot)', placeholder:'120',   unit:'€/MWh' },
      { key:'heatEscalation',label:'Kaukolämpöhinnan vuosikorotus (%/v)',         placeholder:'1.25',  unit:'%/v'   },
    ],
    radioKey: 'hasSolar',
    radioLabel: 'Harkitsetko aurinkopaneelejä sähköntuotantoon?',
    radioOpts: [{ val:'yes', label:'Kyllä, harkitsen ☀️' }, { val:'no', label:'Ei tällä kertaa' }],
    sidebarLabels: { cop:'COP-kerroin', elecPrice:'Sähkön hinta', heatEscalation:'Hintojen korotus', hasSolar:'Aurinkopaneelit' }
  },
  {
    step: 2.5,
    botMsg: `Loistava valinta! ☀️ Suomen aurinkoisuus vaihtelee sijainnin mukaan. Anna tiedot niin lasken arvioidun vuosituotannon.\n\n<strong>Tärkeää 50-vuoden elinkaarta varten:</strong> Aurinkoinvertteri vaihdetaan noin 12–13 vuoden välein — yksi invertteri per rakennus. Jotta elinkaarikulut voidaan laskea tarkasti, tarvitsen myös tiedon rakennusten lukumäärästä.`,
    inputs: [
      { key:'solarAddress',  label:'Kiinteistön osoite', placeholder:'esim. Mannerheimintie 1, Helsinki', unit:'' },
      { key:'solarKwp',      label:'Aurinkopaneelijärjestelmän koko (kWp)', placeholder:'esim. 30', unit:'kWp' },
      { key:'buildingCount', label:'Rakennusten / inverttereiden lukumäärä taloyhtiössä', placeholder:'esim. 3', unit:'kpl' },
    ],
    sidebarLabels: { solarAddress:'Osoite', solarKwp:'Aurinko (kWp)', buildingCount:'Rakennuksia' }
  },
  {
    step: 3,
    botMsg: `Selvä! 💰 Viimeinen vaihe — investoinnin rahoitus. Maalämpöinvestoinnin lainanlyhennykset katetaan tyypillisesti säästyneillä lämmityskustannuksilla, jolloin hoitovastike voi laskea heti tai lainan maksamisen jälkeen.`,
    inputs: [
      { key:'loanAmount',   label:'Lainan kokonaismäärä (€)', placeholder:'esim. 150000', unit:'€' },
      { key:'loanInterest', label:'Korkokanta (%/v)',          placeholder:'esim. 3.5',    unit:'%' },
      { key:'loanYears',    label:'Laina-aika (vuotta)',       placeholder:'esim. 15',     unit:'v' },
    ],
    sidebarLabels: { loanAmount:'Lainasumma', loanInterest:'Korkokanta', loanYears:'Laina-aika' }
  }
];

// ── Helpers ────────────────────────────────────────────────────────────
const fmt = (n, dec=0) => Number(n).toLocaleString('fi-FI', { minimumFractionDigits:dec, maximumFractionDigits:dec });
const fmtE = (n) => fmt(n,0) + ' €';

function addMessage(role, html) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'bot' ? '⚡' : '👤';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = html.replace(/\n/g, '<br/>');
  div.appendChild(avatar);
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typingMsg';
  div.innerHTML = `<div class="msg-avatar">⚡</div><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typingMsg');
  if (t) t.remove();
}

function setStep(step) {
  document.querySelectorAll('.progress-step').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'done');
    if (s < step) el.classList.add('done');
    if (s === Math.ceil(step)) el.classList.add('active');
  });
}

function addSidebarItem(label, value, unit='') {
  const div = document.createElement('div');
  div.className = 'data-item';
  div.innerHTML = `<div class="di-label">${label}</div><div class="di-value">${value}${unit ? ' '+unit : ''}</div>`;
  dataItems.appendChild(div);
}

function buildInputs(stage) {
  inputWrapper.innerHTML = '';
  btnSend.disabled = true;

  const group = document.createElement('div');
  group.className = 'input-field-group';

  const regularInputs = (stage.inputs || []);
  regularInputs.forEach(inp => {
    const wrap = document.createElement('div');
    wrap.className = 'input-field-wrap';
    wrap.innerHTML = `<label class="input-label">${inp.label}</label><input id="inp_${inp.key}" class="chat-input" type="text" placeholder="${inp.placeholder}" autocomplete="off"/>`;
    group.appendChild(wrap);
  });
  inputWrapper.appendChild(group);

  const extraInputs = stage.extraInputs || [];
  extraInputs.forEach(inp => {
    if (inp.type === 'radio') {
      const rg = document.createElement('div');
      rg.className = 'vastike-mode-group';
      rg.innerHTML = `<div class="input-label" style="margin-bottom:6px">${inp.label}</div>`;
      const row = document.createElement('div');
      row.className = 'radio-group';
      row.id = 'vastikeModeRow';
      inp.opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'radio-btn';
        btn.textContent = opt.label;
        btn.dataset.val = opt.val;
        if (data.vastikeMode === opt.val) btn.classList.add('selected');
        btn.onclick = () => {
          row.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          data.vastikeMode = opt.val;
          updateVastikeFields(stage);
          checkSendEnabled(stage);
        };
        row.appendChild(btn);
      });
      rg.appendChild(row);
      inputWrapper.appendChild(rg);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'input-field-wrap vastike-dynamic-field';
      wrap.dataset.key = inp.key;
      const mode = data.vastikeMode || 'm2';
      const label  = (mode === 'osake' && inp.labelOsake) ? inp.labelOsake : inp.label;
      const ph     = (mode === 'osake' && inp.placeholderOsake) ? inp.placeholderOsake : inp.placeholder;
      const unitLbl= (mode === 'osake' && inp.unitOsake) ? inp.unitOsake : inp.unit;
      wrap.innerHTML = `<label class="input-label">${label}${unitLbl ? ` <span style="color:var(--indigo);font-weight:600">(${unitLbl})</span>` : ''}</label><input id="inp_${inp.key}" class="chat-input" type="text" placeholder="${ph}" autocomplete="off" value="${data[inp.key]||''}"/>`;
      inputWrapper.appendChild(wrap);
    }
  });

  if (stage.radioKey) {
    const rg = document.createElement('div');
    rg.innerHTML = `<div class="input-label" style="margin-bottom:6px">${stage.radioLabel}</div>`;
    const row = document.createElement('div');
    row.className = 'radio-group';
    stage.radioOpts.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'radio-btn';
      btn.textContent = opt.label;
      btn.dataset.val = opt.val;
      btn.onclick = () => {
        row.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        checkSendEnabled(stage);
      };
      row.appendChild(btn);
    });
    rg.appendChild(row);
    inputWrapper.appendChild(rg);
  }

  inputWrapper.querySelectorAll('.chat-input').forEach(input => {
    input.addEventListener('input', () => checkSendEnabled(stage));
  });
}

function updateVastikeFields(stage) {
  const mode = data.vastikeMode || 'm2';
  const extraInputs = stage.extraInputs || [];
  extraInputs.forEach(inp => {
    if (inp.type === 'radio') return;
    const wrap = inputWrapper.querySelector(`.vastike-dynamic-field[data-key="${inp.key}"]`);
    if (!wrap) return;
    const label  = (mode === 'osake' && inp.labelOsake) ? inp.labelOsake : inp.label;
    const ph     = (mode === 'osake' && inp.placeholderOsake) ? inp.placeholderOsake : inp.placeholder;
    const unitLbl= (mode === 'osake' && inp.unitOsake) ? inp.unitOsake : inp.unit;
    const currentVal = (document.getElementById('inp_' + inp.key) || {}).value || '';
    wrap.innerHTML = `<label class="input-label">${label}${unitLbl ? ` <span style="color:var(--indigo);font-weight:600">(${unitLbl})</span>` : ''}</label><input id="inp_${inp.key}" class="chat-input" type="text" placeholder="${ph}" autocomplete="off" value="${currentVal}"/>`;
    wrap.querySelector('.chat-input').addEventListener('input', () => checkSendEnabled(stage));
  });
}

function checkSendEnabled(stage) {
  const regularInputs = stage.inputs || [];
  const extraInputs = (stage.extraInputs || []).filter(i => i.type !== 'radio');
  const allTextInputs = [...regularInputs, ...extraInputs];
  const filled = allTextInputs.every(inp => {
    const el = document.getElementById('inp_' + inp.key);
    return el && el.value.trim() !== '';
  });
  const hasVastikeRadio = (stage.extraInputs || []).some(i => i.type === 'radio' && i.key === 'vastikeMode');
  const vastikeModeOk = !hasVastikeRadio || (data.vastikeMode === 'm2' || data.vastikeMode === 'osake');
  const radioOk = !stage.radioKey || inputWrapper.querySelector('.radio-btn.selected');
  btnSend.disabled = !(filled && vastikeModeOk && radioOk);
}

function collectInputs(stage) {
  const regularInputs = stage.inputs || [];
  const extraInputs = stage.extraInputs || [];
  regularInputs.forEach(inp => {
    const el = document.getElementById('inp_' + inp.key);
    data[inp.key] = el ? el.value.trim() : '';
  });
  extraInputs.forEach(inp => {
    if (inp.type === 'radio') return;
    const el = document.getElementById('inp_' + inp.key);
    data[inp.key] = el ? el.value.trim() : '';
  });
  if (stage.radioKey) {
    const sel = inputWrapper.querySelector('.radio-btn.selected');
    data[stage.radioKey] = sel ? sel.dataset.val : '';
  }
}

function buildUserSummary(stage) {
  const mode = data.vastikeMode || 'm2';
  const regularInputs = stage.inputs || [];
  const extraInputs = (stage.extraInputs || []).filter(i => i.type !== 'radio');
  const allInputs = [...regularInputs, ...extraInputs];
  const parts = [];
  if ((stage.extraInputs || []).some(i => i.key === 'vastikeMode')) {
    parts.push(`<strong>Vastikelaskenta:</strong> ${mode === 'osake' ? 'snt/osake/kk (osakeperusteinen)' : '€/m²/kk (neliöperusteinen)'}`);
  }
  allInputs.forEach(inp => {
    const val = data[inp.key];
    if (!val) return;
    const unitDisplay = (mode === 'osake' && inp.unitOsake) ? inp.unitOsake : (inp.unit || '');
    const labelDisplay = (mode === 'osake' && inp.labelOsake) ? inp.labelOsake : inp.label;
    parts.push(`<strong>${labelDisplay}:</strong> ${val} ${unitDisplay}`);
  });
  if (stage.radioKey) {
    const sel = inputWrapper.querySelector('.radio-btn.selected');
    parts.push(`<strong>${stage.radioLabel}:</strong> ${sel ? sel.textContent : ''}`);
  }
  return parts.join('<br/>');
}

// ── Solar estimation (latitude-based) ─────────────────────────────────
function estimateSolarMWh(address, kwp) {
  kwp = parseFloat(kwp) || 0;
  const addr = (address || '').toLowerCase();
  let irr = 900;
  if (addr.includes('helsinki') || addr.includes('espoo') || addr.includes('vantaa')) irr = 950;
  else if (addr.includes('tampere') || addr.includes('turku')) irr = 920;
  else if (addr.includes('oulu')) irr = 870;
  else if (addr.includes('rovaniemi') || addr.includes('lappi')) irr = 820;
  return (kwp * irr * 0.8) / 1000;
}

// ── Loan calculation ───────────────────────────────────────────────────
function calcAnnuity(principal, ratePercent, years) {
  const r = ratePercent / 100;
  if (r === 0) return principal / years;
  return principal * (r * Math.pow(1+r, years)) / (Math.pow(1+r, years) - 1);
}

function calcFlatPrincipalPayment(loanAmount, loanInt, loanYears, yearIndex) {
  const r = loanInt / 100;
  const principal = loanAmount / loanYears;
  const remainingAtStart = loanAmount - principal * (yearIndex - 1);
  const interest = remainingAtStart * r;
  return { principal, interest, total: principal + interest };
}

// ── Main calculation ───────────────────────────────────────────────────
function calculate(copOverride) {
  const COP         = copOverride !== undefined ? copOverride : (parseFloat(data.cop) || 3.2);
  const kwhYear     = parseFloat(data.kwhYear)      || 0;
  const monthlyFee  = parseFloat(data.monthlyFee)   || 0;
  const yearlyTotal = parseFloat(data.yearlyTotal)  || 0;
  const elecPrice   = parseFloat(data.elecPrice)    || 0;
  const loanAmount  = parseFloat(data.loanAmount)   || 0;
  const loanInt     = parseFloat(data.loanInterest) || 0;
  const loanYears   = parseInt(data.loanYears)      || 0;
  const hasSolar    = data.hasSolar === 'yes';
  const solarMWh    = hasSolar ? estimateSolarMWh(data.solarAddress, data.solarKwp) : 0;
  const solarKwp    = parseFloat(data.solarKwp)     || 0;
  const buildingCount = Math.max(1, parseInt(data.buildingCount) || 1);
  const heatEsc     = (parseFloat(data.heatEscalation) || 1.25) / 100;
  const loanType    = data.loanType || 'annuiteetti';
  const r           = loanInt / 100;

  const vastikeMode   = data.vastikeMode || 'm2';
  const totalBase     = parseFloat(data.totalBase) || 0;
  const totalM2Legacy = parseFloat(data.totalM2) || 0;
  const baseValue     = totalBase > 0 ? totalBase : totalM2Legacy;
  const hoito         = parseFloat(data.hoitovastike) || 0;

  // Base calcs (year 1, original COP) — used for summary cards
  const elecNeeded  = kwhYear / COP;
  const netElec     = Math.max(0, elecNeeded - solarMWh);
  const newElecCost = netElec * elecPrice;
  const annualLoan  = loanYears > 0 ? calcAnnuity(loanAmount, loanInt, loanYears) : 0;
  const firstYearPayFlat = loanYears > 0 ? calcFlatPrincipalPayment(loanAmount, loanInt, loanYears, 1).total : 0;
  const grossSavings = yearlyTotal - newElecCost;
  const refLoanPay = loanType === 'tasalyhennys' ? firstYearPayFlat : annualLoan;
  const netSavings   = yearlyTotal - (newElecCost + refLoanPay);
  const upgradedCOP  = COP + SVC.copImprovement;

  // Pump unit count: 1 per 200 MWh (user-confirmed: 600 MWh → 3 units)
  const pumpUnits = Math.max(1, Math.ceil(kwhYear / SVC.pumpUnitsPerMwh));

  // Hoitovastike impact (year 1, energy+loan only — for summary display)
  let newHoitoDuringLoan = 0, newHoitoAfterLoan = 0;
  if (baseValue > 0) {
    if (vastikeMode === 'm2') {
      const costDeltaDuringLoan = (newElecCost + refLoanPay) - yearlyTotal;
      const costDeltaAfterLoan  = newElecCost - yearlyTotal;
      newHoitoDuringLoan = hoito + costDeltaDuringLoan / baseValue / 12;
      newHoitoAfterLoan  = hoito + costDeltaAfterLoan  / baseValue / 12;
    } else {
      const costDeltaDuringLoan = (newElecCost + refLoanPay) - yearlyTotal;
      const costDeltaAfterLoan  = newElecCost - yearlyTotal;
      newHoitoDuringLoan = hoito + (costDeltaDuringLoan / baseValue / 12) * 100;
      newHoitoAfterLoan  = hoito + (costDeltaAfterLoan  / baseValue / 12) * 100;
    }
  }

  // Year-by-year cashflow — includes ALL service costs and COP improvement
  let remaining  = loanAmount;
  let cumulative = 0;
  let paybackYear = null;
  let cashflowPositiveYear = null;
  const cashflow = [];
  const years = loanYears > 0 ? loanYears + 1 : 15;

  for (let y = 1; y <= years; y++) {
    // KL energy (escalating)
    const oldCostY = yearlyTotal * Math.pow(1 + heatEsc, y - 1);

    // MLP electricity — COP improves from year after pump replacement
    const effectiveCOP = y > SVC.copImprovementYear ? upgradedCOP : COP;
    const elecNeededY  = kwhYear / effectiveCOP;
    const netElecY     = Math.max(0, elecNeededY - solarMWh);
    const newElecCostY = netElecY * elecPrice;

    // Loan payment
    let interestY = 0, principalY = 0, loanPayY = 0;
    if (y <= loanYears && loanYears > 0) {
      if (loanType === 'tasalyhennys') {
        const flat = calcFlatPrincipalPayment(loanAmount, loanInt, loanYears, y);
        principalY = flat.principal;
        interestY  = flat.interest;
        loanPayY   = flat.total;
      } else {
        interestY  = remaining * r;
        principalY = annualLoan - interestY;
        loanPayY   = annualLoan;
      }
      remaining = Math.max(0, remaining - principalY);
    }

    // ── MLP service costs this year ──────────────────────────────────
    let mlpServiceCostY = SVC.mlpAnnual;
    const mlpServiceNotes = [];
    if (y === SVC.pumpReplYear) {
      const pumpCost = pumpUnits * SVC.pumpUnitCost;
      mlpServiceCostY += pumpCost;
      mlpServiceNotes.push(`🔧 Pumppu uusittu ${pumpUnits} kpl × ${fmt(SVC.pumpUnitCost)} € = ${fmtE(pumpCost)}`);
    }

    // ── Solar service costs this year ─────────────────────────────────
    let solarServiceCostY = 0;
    const solarServiceNotes = [];
    if (hasSolar) {
      if (SVC.inverterYears.includes(y)) {
        const invCost = buildingCount * SVC.inverterCost;
        solarServiceCostY += invCost;
        solarServiceNotes.push(`⚡ Invertteri ${buildingCount} kpl × ${fmt(SVC.inverterCost)} € = ${fmtE(invCost)}`);
      }
      if (y === SVC.panelReplYear) {
        solarServiceCostY += SVC.panelReplCost;
        solarServiceNotes.push(`☀️ Paneelit uusittu ${fmtE(SVC.panelReplCost)}`);
      }
      if (y % SVC.solarInspInterval === 0) {
        solarServiceCostY += SVC.solarInspCost;
        solarServiceNotes.push(`🔍 Tarkastus ${fmtE(SVC.solarInspCost)}`);
      }
    }

    // ── KL service costs this year ────────────────────────────────────
    let klServiceCostY = SVC.klAnnual;
    const klServiceNotes = [];
    if (SVC.klHeatExchYears.includes(y)) {
      klServiceCostY += SVC.klHeatExchCost;
      klServiceNotes.push(`🔧 LJK uusittu ${fmtE(SVC.klHeatExchCost)}`);
    }

    // ── Totals ────────────────────────────────────────────────────────
    const mlpTotalCostY = newElecCostY + loanPayY + mlpServiceCostY + solarServiceCostY;
    const klTotalCostY  = oldCostY + klServiceCostY;
    const netY          = klTotalCostY - mlpTotalCostY;
    cumulative         += netY;

    if (paybackYear === null && cumulative >= 0) paybackYear = y;
    if (cashflowPositiveYear === null && netY >= 0) cashflowPositiveYear = y;

    // Vastike impact
    let vastike = null;
    if (baseValue > 0) {
      vastike = vastikeMode === 'osake'
        ? (netY / baseValue / 12) * 100
        : netY / baseValue / 12;
    }

    cashflow.push({
      year: y,
      // KL side
      oldCost: oldCostY, klServiceCost: klServiceCostY, klTotal: klTotalCostY,
      klServiceNotes,
      // MLP side
      elecCost: newElecCostY, effectiveCOP,
      interest: interestY, principal: principalY, loanPay: loanPayY,
      mlpServiceCost: mlpServiceCostY, solarServiceCost: solarServiceCostY,
      mlpTotal: mlpTotalCostY,
      mlpServiceNotes, solarServiceNotes,
      // Summary
      net: netY, cumulative, vastike,
      isCopUpgradeYear: y === SVC.copImprovementYear + 1,
    });
  }
  if (!paybackYear) paybackYear = '>50';

  return {
    kwhYear, COP, upgradedCOP, elecNeeded, solarMWh, netElec, newElecCost,
    oldCost: yearlyTotal, monthlyFee, annualLoan, loanType, firstYearPayFlat, refLoanPay,
    newTotalCost: newElecCost + refLoanPay,
    grossSavings, netSavings, hoito, totalM2: baseValue, vastikeMode, heatEsc,
    newHoitoDuringLoan, newHoitoAfterLoan,
    loanAmount, loanInt, loanYears, solarKwp, hasSolar, buildingCount, pumpUnits,
    paybackYear, cashflowPositiveYear, cashflow, elecPrice,
  };
}

// ── 50-Year calculation ────────────────────────────────────────────────
function calculate50Year(r) {
  const YEARS = 50;
  let klCumEnergy = 0, klCumService = 0, klCumEquip = 0;
  let mlpCumEnergy = 0, mlpCumService = 0, mlpCumEquip = 0;
  const rows = [];
  let klRunning = 0, mlpRunning = 0;

  for (let y = 1; y <= YEARS; y++) {
    // KL energy (escalating)
    const klEnergyY = r.oldCost * Math.pow(1 + r.heatEsc, y - 1);
    klCumEnergy += klEnergyY;

    // KL service
    let klSvcY = SVC.klAnnual;
    klCumService += SVC.klAnnual;
    if (SVC.klHeatExchYears.includes(y)) {
      klSvcY += SVC.klHeatExchCost;
      klCumEquip += SVC.klHeatExchCost;
    }

    // MLP electricity — COP improves after pump replacement
    const effCOP    = y > SVC.copImprovementYear ? r.upgradedCOP : r.COP;
    const elecNeedY = r.kwhYear / effCOP;
    const netElecY  = Math.max(0, elecNeedY - r.solarMWh);
    const mlpElecY  = netElecY * r.elecPrice;
    mlpCumEnergy += mlpElecY;

    // MLP service
    let mlpSvcY = SVC.mlpAnnual;
    mlpCumService += SVC.mlpAnnual;
    if (y === SVC.pumpReplYear) {
      const c = r.pumpUnits * SVC.pumpUnitCost;
      mlpSvcY += c;
      mlpCumEquip += c;
    }

    // Solar service
    let solarSvcY = 0;
    if (r.hasSolar) {
      if (SVC.inverterYears.includes(y)) {
        const c = r.buildingCount * SVC.inverterCost;
        solarSvcY += c;
        mlpCumEquip += c;
      }
      if (y === SVC.panelReplYear) {
        solarSvcY += SVC.panelReplCost;
        mlpCumEquip += SVC.panelReplCost;
      }
      if (y % SVC.solarInspInterval === 0) {
        solarSvcY += SVC.solarInspCost;
        mlpCumService += SVC.solarInspCost;
      }
    }

    const klTotalY  = klEnergyY + klSvcY;
    const mlpTotalY = mlpElecY + mlpSvcY + solarSvcY;

    klRunning  += klTotalY;
    mlpRunning += mlpTotalY;

    rows.push({ year: y, klTotal: klTotalY, mlpTotal: mlpTotalY, klRunning, mlpRunning, diff: klRunning - mlpRunning, isCopYear: y === SVC.copImprovementYear + 1 });
  }

  const klTotal  = klCumEnergy  + klCumService  + klCumEquip;
  const mlpTotal = mlpCumEnergy + mlpCumService + mlpCumEquip;

  return {
    kl:  { energy: klCumEnergy,  service: klCumService,  equip: klCumEquip,  total: klTotal  },
    mlp: { energy: mlpCumEnergy, service: mlpCumService, equip: mlpCumEquip, total: mlpTotal },
    savings: klTotal - mlpTotal,
    rows,
  };
}

// ── Report renderer — Tab 1 ────────────────────────────────────────────
function renderReport(r) {
  const rc = document.getElementById('reportContent');
  document.getElementById('reportSubtitle').textContent =
    `${fmt(r.kwhYear)} MWh → Maalämpö${r.hasSolar ? ' + Aurinko' : ''} (COP ${fmt(r.COP,1)})`;

  const maxBar = Math.max(r.oldCost, r.newTotalCost) * 1.1;

  const solarRow = r.hasSolar ? `
    <div style="margin-top:10px;padding:12px 16px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.25);border-radius:10px">
      ☀️ <strong>Aurinkopaneelit ${fmt(r.solarKwp,1)} kWp</strong> tuottavat arviolta
      <strong style="color:var(--green)">${fmt(r.solarMWh,1)} MWh/v</strong>,
      joten nettosähköntarve on <strong>${fmt(r.netElec,1)} MWh/v</strong>.
    </div>` : '';

  // Build cashflow table rows
  const cfRows = r.cashflow.map(row => {
    const isBreak = row.cumulative >= 0 && (row.cumulative - row.net) < 0;
    const allNotes = [...row.mlpServiceNotes, ...row.solarServiceNotes, ...row.klServiceNotes];
    const hasEvents = allNotes.length > 0;

    // Event badges
    const eventBadges = [...row.mlpServiceNotes.map(n => `<span class="ev-badge ev-mlp">${n.split(' ').slice(0,2).join(' ')}</span>`),
                         ...row.solarServiceNotes.map(n => `<span class="ev-badge ev-solar">${n.split(' ').slice(0,2).join(' ')}</span>`),
                         ...row.klServiceNotes.map(n => `<span class="ev-badge ev-kl">${n.split(' ').slice(0,2).join(' ')}</span>`)].join('');

    const vastikeStr = row.vastike !== null
      ? `<td class="${row.vastike <= 0 ? 'positive-cell' : 'negative-cell'} vastike-cell">${(-row.vastike).toLocaleString('fi-FI', {minimumFractionDigits:2, maximumFractionDigits:2, signDisplay:'always'})}</td>`
      : '';

    // COP upgrade annotation row
    const copRow = row.isCopUpgradeYear ? `
      <tr class="cop-upgrade-row">
        <td colspan="${r.totalM2 > 0 ? 10 : 9}" style="padding:6px 14px;text-align:left">
          <span class="cop-upgrade-badge">⚡ COP paranee vuodesta ${SVC.copImprovementYear+1}: ${fmt(r.COP,1)} → ${fmt(r.upgradedCOP,1)} — uusi pumppu on ${((r.upgradedCOP/r.COP-1)*100).toFixed(0)}% energiatehokkaampi</span>
        </td>
      </tr>` : '';

    return `${copRow}<tr${isBreak?' class="breakeven"':''}>
      <td>${row.year}</td>
      <td>${fmtE(row.klTotal)}</td>
      <td>${fmtE(row.elecCost)}</td>
      <td class="${row.mlpServiceCost + row.solarServiceCost > SVC.mlpAnnual + 200 ? 'event-cell' : 'neutral-cell'}">${fmtE(row.mlpServiceCost + row.solarServiceCost)}</td>
      <td class="neutral-cell">${row.interest > 0 ? fmtE(row.interest) : '—'}</td>
      <td class="neutral-cell">${row.principal > 0 ? fmtE(row.principal) : '—'}</td>
      <td>${fmtE(row.mlpTotal)}</td>
      <td class="${row.net>=0?'positive-cell':'negative-cell'}">${row.net>=0?'+':''}${fmtE(row.net)}</td>
      <td class="${row.cumulative>=0?'positive-cell':'negative-cell'}">${row.cumulative>=0?'+':''}${fmtE(row.cumulative)}</td>
      ${vastikeStr}
    </tr>`;
  }).join('');

  rc.innerHTML = `
    <!-- Card 1: Energy shift -->
    <div class="report-card" style="margin-bottom:20px">
      <div class="rc-header" onclick="toggleCard(this)">
        <div class="rc-header-left">
          <div class="rc-icon blue">⚡</div>
          <div><div class="rc-title">1. Ennen ja jälkeen — Energiankulutus</div>
          <div class="rc-subtitle">COP-kerroin ${fmt(r.COP,1)} × — ${fmt(r.kwhYear/r.elecNeeded,1)} kertaa tehokkaampi kuin suorasähkölämmitys</div></div>
        </div>
        <div class="rc-toggle">▼</div>
      </div>
      <div class="rc-body">
      <div class="energy-compare">
        <div class="ec-side">
          <div class="ec-label">Kaukolämpö (ennen)</div>
          <div class="ec-value old">${fmt(r.kwhYear,1)}</div>
          <div class="ec-unit">MWh / vuosi</div>
        </div>
        <div class="ec-arrow">→</div>
        <div class="ec-side">
          <div class="ec-label">Maalämmön sähköntarve (jälkeen)</div>
          <div class="ec-value new">${fmt(r.elecNeeded,1)}</div>
          <div class="ec-unit">MWh / vuosi</div>
          ${r.hasSolar?`<span class="ec-solar-tag">−${fmt(r.solarMWh,1)} MWh aurinko → netto ${fmt(r.netElec,1)} MWh</span>`:''}
        </div>
      </div>
      ${solarRow}
      <div class="bar-chart" style="margin-top:20px">
        <div class="bar-row">
          <div class="bar-row-label">Kaukolämpö</div>
          <div class="bar-track"><div class="bar-fill old" style="width:100%"></div></div>
          <div class="bar-row-val">${fmt(r.kwhYear,1)} MWh</div>
        </div>
        <div class="bar-row">
          <div class="bar-row-label">Maalämpösähkö</div>
          <div class="bar-track"><div class="bar-fill new" style="width:${(r.elecNeeded/r.kwhYear*100).toFixed(1)}%"></div></div>
          <div class="bar-row-val">${fmt(r.elecNeeded,1)} MWh</div>
        </div>
      </div>
      </div>
    </div>

    <!-- Card 2: Cost impact + Hoitovastike path -->
    <div class="report-card" style="margin-bottom:20px">
      <div class="rc-header" onclick="toggleCard(this)">
        <div class="rc-header-left">
          <div class="rc-icon green">💶</div>
          <div><div class="rc-title">2. Taloudellinen vaikutus ja hoitovastike</div>
          <div class="rc-subtitle">Lämmityskustannusten muutos sekä hoitovastikkeen kehitys</div></div>
        </div>
        <div class="rc-toggle">▼</div>
      </div>
      <div class="rc-body">
      <div class="savings-grid">
        <div class="savings-cell">
          <div class="sc-label">Vanha lämmityskustannus (v. 1) <div class="info-icon" data-tip="Nykyinen kaukolämpölasku + vuosihuolto 500€ (ensimmäinen vuosi).">?</div></div>
          <div class="sc-value negative">${fmtE(r.oldCost)}</div>
          <div class="sc-note">Kaukolämpö energia · +${(r.heatEsc*100).toFixed(2)}%/v korotus</div>
        </div>
        <div class="savings-cell">
          <div class="sc-label">Uusi sähkökustannus <div class="info-icon" data-tip="Maalämpöpumpun sähkönkulutus kerrottuna sähkön hinnalla (sis. aurinkopaneelien vähennyksen).">?</div></div>
          <div class="sc-value neutral">${fmtE(r.newElecCost)}</div>
          <div class="sc-note">Maalämpösähkö / vuosi</div>
        </div>
        <div class="savings-cell">
          <div class="sc-label">Lainanlyhennys / vuosi <div class="info-icon" data-tip="Investoinnin vuotuinen maksu valitulla lyhennysmallilla.">?</div></div>
          <div class="sc-value neutral">${fmtE(r.refLoanPay)}</div>
          <div class="sc-note">${r.loanYears} v × ${fmt(r.loanInt,1)} % (${r.loanType==='tasalyhennys'?'v.1':'vakio'})</div>
        </div>
        <div class="savings-cell">
          <div class="sc-label">Bruttosäästö (energia, ilman lainaa) <div class="info-icon" data-tip="Säästö pelkissä energiakuluissa ennen lainan rahoituskuluja.">?</div></div>
          <div class="sc-value positive">${fmtE(r.grossSavings)}</div>
          <div class="sc-note">Vanha energia − uusi sähkö</div>
        </div>
      </div>
      <div class="savings-highlight">
        <div>
          <div class="sh-label">${r.netSavings >= 0 ? '✅ Nettosäästö lainanlyhennysten jälkeen (v. 1)' : '⚠️ Lisäkustannus lainanlyhennysten jälkeen (v. 1)'} <div class="info-icon" data-tip="Paljonko taloyhtiönne säästää tai menettää rahaa ensimmäisenä vuonna KAIKKIEN kulujen (sähkö + lyhennys) jälkeen.">?</div></div>
          <div style="font-size:13px;color:var(--text3);margin-top:4px">Kustannus ${r.netSavings >= 0 ? 'laskee' : 'nousee'} ${fmtE(r.oldCost)} → ${fmtE(r.newTotalCost)}</div>
        </div>
        <div class="sh-value" style="color:${r.netSavings >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${r.netSavings >= 0 ? '+' : ''}${fmtE(r.netSavings)} / v
        </div>
      </div>

      ${renderHoitoPath(r)}
      </div>
    </div>

    <!-- Card 3: Loan & cashflow -->
    <div class="report-card">
      <div class="rc-header" onclick="toggleCard(this)">
        <div class="rc-header-left">
          <div class="rc-icon amber">📈</div>
          <div><div class="rc-title">3. Investointi ja kassavirta (sis. huoltokulut)</div>
          <div class="rc-subtitle">Vuosikohtainen taulukko — kaikki kustannukset sisältyvät Netto- ja Kumulat.-sarakkeisiin</div></div>
        </div>
        <div class="rc-toggle">▼</div>
      </div>
      <div class="rc-body">
      <div class="loan-grid" style="margin-bottom:24px">
        <div class="loan-cell"><div class="lc-label">Lainasumma</div><div class="lc-value">${fmtE(r.loanAmount)}</div></div>
        <div class="loan-cell"><div class="lc-label">Korkokanta</div><div class="lc-value">${fmt(r.loanInt,2)} %</div></div>
        <div class="loan-cell"><div class="lc-label">Laina-aika</div><div class="lc-value">${r.loanYears} v</div></div>
        <div class="loan-cell"><div class="lc-label">${r.loanType === 'tasalyhennys' ? 'Vuosierä (v.1, korkein)' : 'Vuosierä (vakio)'}</div><div class="lc-value">${fmtE(r.loanType === 'tasalyhennys' ? r.firstYearPayFlat : r.annualLoan)}</div></div>
        <div class="loan-cell"><div class="lc-label">Hintojen korotus</div><div class="lc-value">${(r.heatEsc*100).toFixed(2)} %/v</div></div>
        <div class="loan-cell"><div class="lc-label">COP-kerroin</div><div class="lc-value">${fmt(r.COP,1)} → ${fmt(r.upgradedCOP,1)} (v.${SVC.copImprovementYear+1})</div></div>
        <div class="loan-cell" style="border-color:${r.loanType==='tasalyhennys'?'rgba(52,211,153,0.4)':'rgba(129,140,248,0.4)'}">
          <div class="lc-label">Lyhennysmalli</div>
          <div class="lc-value" style="color:${r.loanType==='tasalyhennys'?'var(--green)':'var(--indigo)'}">${r.loanType === 'tasalyhennys' ? '📉 Tasalyhennys' : '📊 Annuiteetti'}</div>
        </div>
        ${r.hasSolar ? `<div class="loan-cell"><div class="lc-label">Rakennuksia / inverttereitä</div><div class="lc-value">${r.buildingCount} kpl</div></div>` : ''}
      </div>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead><tr>
            <th>Vuosi</th>
            <th>KL yht.†</th>
            <th>Sähkö MLP</th>
            <th title="Sisältää: MLP vuosihuolto ${SVC.mlpAnnual}€${r.hasSolar?', solar-tarkastukset, invertteri- ja paneelipäivitykset':''} sekä pumppu uusinta vuonna ${SVC.pumpReplYear}">Huolto MLP‡</th>
            <th>Korko</th>
            <th>Lyhennys</th>
            <th>MLP yht.</th>
            <th>Netto</th>
            <th>Kumulat.</th>
            ${r.totalM2 > 0 ? `<th title="Hoitovastikkeen muutos vs. nykyinen kaukolämpö. Negatiivinen = vastike alenee.">${r.vastikeMode === 'osake' ? 'Vastike snt/os/kk' : 'Vastike €/m²/kk'}</th>` : ''}
          </tr></thead>
          <tbody>${cfRows}</tbody>
        </table>
      </div>
      <div class="cf-legend">
        <div class="cf-legend-item"><span class="legend-dot legend-kl"></span> <strong>KL yht.</strong> = kaukolämpö energia + vuosihuolto ${SVC.klAnnual} €/v${SVC.klHeatExchYears.filter(y=>y<=r.loanYears+1).length ? ` + LJK uusinta vuosina ${SVC.klHeatExchYears.filter(y=>y<=r.loanYears+2).join(' & ')}` : ''}</div>
        <div class="cf-legend-item"><span class="legend-dot legend-mlp"></span> <strong>Huolto MLP</strong> = vuosihuolto ${SVC.mlpAnnual} €/v + pumppu uusinta v.${SVC.pumpReplYear} (${r.pumpUnits} kpl × ${fmt(SVC.pumpUnitCost)} €)${r.hasSolar ? ` + invertteri v.${SVC.inverterYears.join('/')} (${r.buildingCount} kpl × ${fmt(SVC.inverterCost)} €)` : ''}</div>
        <div class="cf-legend-item"><span class="legend-dot legend-cop"></span> <strong>COP ${fmt(r.COP,1)} → ${fmt(r.upgradedCOP,1)}</strong> vuodesta ${SVC.copImprovementYear+1} — uusi pumppu laskee sähkönkulutusta</div>
      </div>
      <div class="cf-footnote">† Kaukolämpöhinta kasvaa ${(r.heatEsc*100).toFixed(2)}% vuodessa · ‡ Sisältää kaikki laitekorvaukset ja huollon</div>
      </div>
    </div>

    ${r.hasSolar ? `
    <!-- Card 4: Solar facts -->
    <div class="report-card">
      <div class="rc-header" onclick="toggleCard(this)">
        <div class="rc-header-left">
          <div class="rc-icon" style="background:rgba(251,191,36,0.15);color:var(--amber);">☀️</div>
          <div><div class="rc-title">4. Aurinkosähkön tuotanto ja perusteet</div>
          <div class="rc-subtitle">Mihin oletukset aurinkoenergiasta perustuvat?</div></div>
        </div>
        <div class="rc-toggle">▼</div>
      </div>
      <div class="rc-body">
        <div style="font-size:14px;line-height:1.6;color:var(--text2)">
          <p>Aurinkopaneelien vuosituotto riippuu merkittävästi sijainnista, suunnasta, kallistuskulmasta ja varjostuksista. Suomen olosuhteissa (Etelä- ja Keski-Suomi) <strong>1 kWp aurinkopaneelitehoa tuottaa optimaalisesti suunnattuna noin 850–950 kWh vuodessa</strong>.</p>
          <div style="margin-top:12px;">Tässä laskelmassa on kuitenkin käytetty hieman varovaisempaa ja realistista arviota:</div>
          <ul style="margin-left:20px;margin-top:8px;margin-bottom:16px;">
            <li style="margin-bottom:6px;"><strong>Tuotto-olettama:</strong> 1 kWp tuottaa vuodessa keskimäärin <strong>720 kWh (0,72 MWh)</strong> hyödynnettävää sähköä.</li>
            <li style="margin-bottom:6px;"><strong>Omakäyttö:</strong> Oletamme, että tämä määrä pystytään hyödyntämään täysin taloyhtiön oman maalämpöpumpun ja kiinteistösähkön tarpeisiin. Koska aurinkosähköä syntyy eniten kesällä, ylijäävää sähköä voidaan todellisuudessa joutua myymään sähköverkkoon. Myynnistä saatavaa korvausta ei ole tässä raportissa huomioitu ollenkaan, mikä jättää säästöarvioon turvamarginaalia.</li>
          </ul>
          <div style="padding:16px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;">
            <strong>Teidän kohteeseenne suunniteltu järjestelmä:</strong><br>
            Paneelien nimellisteho: <strong style="color:var(--text)">${r.solarKwp} kWp</strong><br>
            Arvioitu hyödynnettävä vuosituotto: <strong style="color:var(--text)">${fmt(r.solarKwp * 0.72, 1)} MWh</strong><br>
            Rakennuksia / inverttereitä: <strong style="color:var(--text)">${r.buildingCount} kpl</strong>
          </div>
        </div>
      </div>
    </div>
    ` : ''}
  `;
}

// ── Hoitovastike path (3-box timeline) ────────────────────────────────
function renderHoitoPath(r) {
  if (r.totalM2 <= 0) {
    return `<div style="margin-top:16px;padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;font-size:13px;color:var(--text2)">
      📌 Syötä taloyhtiön ${r.vastikeMode === 'osake' ? 'osakkeiden kokonaismäärä' : 'kokonaispinta-ala (m²)'} nähdäksesi hoitovastikevaikutus.
    </div>`;
  }

  const unit = r.vastikeMode === 'osake' ? 'snt/os/kk' : '€/m²/kk';
  const dec = r.vastikeMode === 'osake' ? 2 : 2;
  const current  = r.hoito;
  const duringLoan = r.newHoitoDuringLoan;
  const afterLoan  = r.newHoitoAfterLoan;
  const deltaDuring = duringLoan - current;
  const deltaAfter  = afterLoan  - current;

  const fmtDelta = (d) => `${d >= 0 ? '+' : ''}${fmt(Math.abs(d), dec)} ${unit}`;
  const colorDuring = deltaDuring <= 0 ? 'var(--green)' : 'var(--amber)';
  const colorAfter  = deltaAfter  <= 0 ? 'var(--green)' : 'var(--red)';

  let explanationText = '';
  if (deltaDuring <= 0) {
    explanationText = `Maalämpö on <strong>heti ensimmäisestä vuodesta alkaen edullisempi</strong> kuin kaukolämpö. Taloyhtiöllä on mahdollisuus alentaa hoitovastiketta välittömästi.`;
  } else if (r.cashflowPositiveYear && r.cashflowPositiveYear <= r.loanYears) {
    explanationText = `Lainanlyhennysaikana kulut ovat hetkellisesti korkeammat, mutta koska kaukolämmön hinta nousee vuosittain, investointi saavuttaa positiivisen kassavirran <strong>vuonna ${r.cashflowPositiveYear}</strong>. Tästä eteenpäin hoitovastiketta voidaan halutessaan alentaa.`;
  } else {
    explanationText = `Laina-aikana (${r.loanYears} v) kassavirta on negatiivinen. Hoitovastiketta voidaan alentaa merkittävästi lainan maksun jälkeen.`;
  }

  return `
    <div class="hoito-path-wrap" style="margin-top:24px">
      <div class="hoito-path-title">🏠 Hoitovastikkeen kehitys — kolme vaihetta</div>
      <div class="hoito-path-boxes">
        <div class="hoito-box">
          <div class="hb-phase">Nyt</div>
          <div class="hb-value">${fmt(current, dec)}</div>
          <div class="hb-unit">${unit}</div>
          <div class="hb-desc">Nykyinen hoitovastike</div>
        </div>
        <div class="hoito-arrow">→</div>
        <div class="hoito-box">
          <div class="hb-phase">Laina-aikana (${r.loanYears} v)</div>
          <div class="hb-value" style="color:${colorDuring}">${fmt(duringLoan, dec)}</div>
          <div class="hb-unit">${unit}</div>
          <div class="hb-delta" style="color:${colorDuring}">${fmtDelta(deltaDuring)}</div>
          <div class="hb-desc">${deltaDuring <= 0 ? '✅ Laskee heti' : '⚠️ Nousee väliaikaisesti'}</div>
        </div>
        <div class="hoito-arrow">→</div>
        <div class="hoito-box">
          <div class="hb-phase">Lainan jälkeen</div>
          <div class="hb-value" style="color:${colorAfter}">${fmt(afterLoan, dec)}</div>
          <div class="hb-unit">${unit}</div>
          <div class="hb-delta" style="color:${colorAfter}">${fmtDelta(deltaAfter)}</div>
          <div class="hb-desc">✅ Pysyvä alennus</div>
        </div>
      </div>
      <div class="hoito-explanation">${explanationText}</div>
    </div>`;
}

// ── Tab 2: 50-year total cost comparison ──────────────────────────────
function renderTab2(r) {
  const panel = document.getElementById('tab2Panel');
  if (!panel) return;
  const d50 = calculate50Year(r);

  const klMax = d50.kl.total;
  const mlpMax = d50.mlp.total;
  const biggerTotal = Math.max(klMax, mlpMax);

  // Stacked bar segments (as % of bigger total)
  const klEnergyPct  = (d50.kl.energy  / biggerTotal * 100).toFixed(1);
  const klServicePct = (d50.kl.service / biggerTotal * 100).toFixed(1);
  const klEquipPct   = (d50.kl.equip   / biggerTotal * 100).toFixed(1);
  const mlpEnergyPct  = (d50.mlp.energy  / biggerTotal * 100).toFixed(1);
  const mlpServicePct = (d50.mlp.service / biggerTotal * 100).toFixed(1);
  const mlpEquipPct   = (d50.mlp.equip   / biggerTotal * 100).toFixed(1);

  // 50-year table (collapsible)
  const tableRows50 = d50.rows.map(row => {
    const copBadge = row.isCopYear ? `<span class="cop-up-badge">⚡ COP↑</span>` : '';
    return `<tr${row.diff >= 0 ? ' class="row-positive"' : ''}>
      <td>${row.year}${copBadge}</td>
      <td>${fmtE(row.klTotal)}</td>
      <td>${fmtE(row.mlpTotal)}</td>
      <td class="${row.diff >= 0 ? 'positive-cell' : 'negative-cell'}">${row.diff >= 0 ? '+' : ''}${fmtE(row.diff)}</td>
      <td class="${row.klRunning > row.mlpRunning ? 'positive-cell' : 'negative-cell'}">${fmtE(row.diff >= 0 ? row.diff : 0)}</td>
    </tr>`;
  }).join('');

  panel.innerHTML = `
    <!-- Hero savings -->
    <div class="cost50-hero">
      <div class="c50-eyebrow">50 vuoden kokonaishyöty — energia + huolto + laitekorvaukset</div>
      <div class="c50-big">${fmtE(d50.savings)}</div>
      <div class="c50-sub">säästät valitsemalla maalämpö${r.hasSolar ? ' + aurinko' : ''} vs. kaukolämpö</div>
    </div>

    <!-- Side-by-side breakdown -->
    <div class="cost50-cols">
      <div class="cost50-col cost50-kl">
        <div class="col50-header">
          <div class="col50-icon">🔥</div>
          <div>
            <div class="col50-title">Kaukolämpö</div>
            <div class="col50-sub">50 vuoden kokonaiskustannus</div>
          </div>
        </div>
        <div class="col50-rows">
          <div class="col50-row">
            <div class="col50-label">Energiakulut</div>
            <div class="col50-val">${fmtE(Math.round(d50.kl.energy))}</div>
          </div>
          <div class="col50-row">
            <div class="col50-label">Vuosihuolto (${SVC.klAnnual} €/v × 50)</div>
            <div class="col50-val">${fmtE(d50.kl.service)}</div>
          </div>
          <div class="col50-row">
            <div class="col50-label">Laitteiden uusiminen <span class="col50-note">(LJK v.22 &amp; v.42)</span></div>
            <div class="col50-val">${fmtE(d50.kl.equip)}</div>
          </div>
        </div>
        <div class="col50-total">
          <div class="col50-total-label">Yhteensä 50 v</div>
          <div class="col50-total-val kl-total-val">${fmtE(Math.round(d50.kl.total))}</div>
        </div>
      </div>

      <div class="cost50-savings-badge">
        <div class="csb-label">Säästät</div>
        <div class="csb-value">${fmtE(d50.savings)}</div>
        <div class="csb-sub">50 vuodessa</div>
      </div>

      <div class="cost50-col cost50-mlp">
        <div class="col50-header">
          <div class="col50-icon">♻️</div>
          <div>
            <div class="col50-title">Maalämpö${r.hasSolar ? ' + Aurinko' : ''}</div>
            <div class="col50-sub">50 vuoden kokonaiskustannus</div>
          </div>
        </div>
        <div class="col50-rows">
          <div class="col50-row">
            <div class="col50-label">Sähkökulut <span class="col50-note">(COP paranee v.${SVC.copImprovementYear+1})</span></div>
            <div class="col50-val">${fmtE(Math.round(d50.mlp.energy))}</div>
          </div>
          <div class="col50-row">
            <div class="col50-label">Vuosihuolto (${SVC.mlpAnnual} €/v × 50${r.hasSolar ? ' + solar' : ''})</div>
            <div class="col50-val">${fmtE(d50.mlp.service)}</div>
          </div>
          <div class="col50-row">
            <div class="col50-label">Laitteiden uusiminen <span class="col50-note">(pumppu + ${r.hasSolar ? 'invertteri + paneelit' : 'lisälaitteet'})</span></div>
            <div class="col50-val">${fmtE(d50.mlp.equip)}</div>
          </div>
        </div>
        <div class="col50-total">
          <div class="col50-total-label">Yhteensä 50 v</div>
          <div class="col50-total-val mlp-total-val">${fmtE(Math.round(d50.mlp.total))}</div>
        </div>
      </div>
    </div>

    <!-- Stacked bars -->
    <div class="stacked-bars-wrap">
      <div class="sb-row">
        <div class="sb-label">🔥 Kaukolämpö</div>
        <div class="sb-track">
          <div class="sb-seg sb-energy-kl" style="width:${klEnergyPct}%" title="Energia: ${fmtE(Math.round(d50.kl.energy))}"></div>
          <div class="sb-seg sb-service-kl" style="width:${klServicePct}%" title="Huolto: ${fmtE(d50.kl.service)}"></div>
          <div class="sb-seg sb-equip-kl" style="width:${klEquipPct}%" title="Laitteet: ${fmtE(d50.kl.equip)}"></div>
        </div>
        <div class="sb-total">${fmtE(Math.round(d50.kl.total))}</div>
      </div>
      <div class="sb-row">
        <div class="sb-label">♻️ Maalämpö</div>
        <div class="sb-track">
          <div class="sb-seg sb-energy-mlp" style="width:${mlpEnergyPct}%" title="Energia: ${fmtE(Math.round(d50.mlp.energy))}"></div>
          <div class="sb-seg sb-service-mlp" style="width:${mlpServicePct}%" title="Huolto: ${fmtE(d50.mlp.service)}"></div>
          <div class="sb-seg sb-equip-mlp" style="width:${mlpEquipPct}%" title="Laitteet: ${fmtE(d50.mlp.equip)}"></div>
        </div>
        <div class="sb-total">${fmtE(Math.round(d50.mlp.total))}</div>
      </div>
      <div class="sb-legend">
        <span><span class="sbl-dot" style="background:#F59E0B"></span>Energia</span>
        <span><span class="sbl-dot" style="background:#6366F1"></span>Vuosihuolto</span>
        <span><span class="sbl-dot" style="background:#EF4444"></span>Laitteet</span>
      </div>
    </div>

    <!-- Cumulative cost chart -->
    ${renderCumulativeChart(r, d50)}

    <!-- COP improvement explainer -->
    ${renderCopExplainer(r)}

    <!-- 50-year table (collapsible) -->
    <div class="report-card" style="margin-top:24px">
      <div class="rc-header" onclick="toggleCard(this)">
        <div class="rc-header-left">
          <div class="rc-icon amber">📅</div>
          <div><div class="rc-title">Vuosikohtainen 50-vuoden taulukko</div>
          <div class="rc-subtitle">Klikkaa auki — näet kumulative eron vuosi vuodelta</div></div>
        </div>
        <div class="rc-toggle collapsed">▶</div>
      </div>
      <div class="rc-body" style="display:none">
        <div class="cf-table-wrap">
          <table class="cf-table">
            <thead><tr>
              <th>Vuosi</th>
              <th>KL (vuosi)</th>
              <th>MLP (vuosi)</th>
              <th>Ero (vuosi)</th>
              <th>Kumulat. säästö</th>
            </tr></thead>
            <tbody>${tableRows50}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Transparent assumptions -->
    <div class="assumptions-box">
      <div class="ab-header" onclick="this.parentElement.classList.toggle('open')">
        <span>🔍 Laskelman oletukset — klikkaa auki</span>
        <span class="ab-arrow">▶</span>
      </div>
      <div class="ab-body">
        <div class="ab-intro">Kaikki alla olevat luvut perustuvat julkisiin alan tietoihin ja teollisuuden ennusteisiin. Korvaushinnat ovat tulevaisuuden hintoja, jotka ottavat huomioon teknologian kehittymisen.</div>
        <table class="ab-table">
          <thead><tr><th>Kohde</th><th>Oletus</th><th>Peruste</th></tr></thead>
          <tbody>
            <tr><td>MLP vuosihuolto</td><td>${SVC.mlpAnnual} €/v</td><td>Suodattimet, kylmäaine, anturit — alan standardikäytäntö Suomessa</td></tr>
            <tr><td>KL vuosihuolto</td><td>${SVC.klAnnual} €/v</td><td>Lämmönjakokeskuksen huolto, pumput, säätöventtiilien tarkastus</td></tr>
            <tr><td>Maalämpöpumppu uusiminen</td><td>${SVC.pumpUnitsPerMwh === 200 ? `${r.pumpUnits} kpl × ${fmt(SVC.pumpUnitCost)} € v.${SVC.pumpReplYear}` : ''}</td><td>Nykyhinta ~25–30k€/yksikkö · Vuoteen 2047 mennessä -20–25% (IEA/teollisuusennuste) · Kaivo pysyy (50–100v elinikä)</td></tr>
            <tr><td>Lämmönjakokeskus (KL)</td><td>2 × ${fmt(SVC.klHeatExchCost)} € (v.22 &amp; v.42)</td><td>Elinikä 20–25v → kaksi vaihtoa 50v aikana · Kerrostalon tyypillinen uusintahinta</td></tr>
            ${r.hasSolar ? `<tr><td>Aurinkoinvertteri</td><td>${r.buildingCount} × ${fmt(SVC.inverterCost)} € (v.12/25/38)</td><td>Nykyhinta 25-30kW: 2 000–3 500 € · Vuoteen 2037: ~1 500–2 000 € (markkinakilpailu, Huawei/Sungrow) · 12–13v elinikä</td></tr>` : ''}
            ${r.hasSolar ? `<tr><td>Aurinkopaneelit</td><td>${fmt(SVC.panelReplCost)} € v.${SVC.panelReplYear}</td><td>Paneelit kestävät 25–35v · Vaihdetaan kerran 50v aikana</td></tr>` : ''}
            ${r.hasSolar ? `<tr><td>Solar-tarkastukset</td><td>${fmt(SVC.solarInspCost)} € / ${SVC.solarInspInterval} v</td><td>Liitokset, kaapelit, telineet — ammattilainen joka 4. vuosi</td></tr>` : ''}
            <tr><td>COP-parannus</td><td>+${SVC.copImprovement} (v.${SVC.copImprovementYear+1})</td><td>Historiallinen kehitys ~0,1 COP/vuosikymmen · Muuttuvanopeuksinen kompressori, R32-kylmäaine, älyohjaus</td></tr>
            <tr><td>Kaukolämpöhinnan korotus</td><td>${(r.heatEsc*100).toFixed(2)} %/v</td><td>Käyttäjän syöttämä arvo (historiallinen 1–3 %/v)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  // Set up chart interactivity after DOM is written
  initCumulativeChart(r, d50);
}

// ── Cumulative Cost Chart ─────────────────────────────────────────────
function renderCumulativeChart(r, d50) {
  const W = 1000, H = 440;
  const ml = 95, mr = 50, mt = 50, mb = 65;
  const cW = W - ml - mr, cH = H - mt - mb;

  const maxVal = Math.max(...d50.rows.map(row => row.klRunning));
  const xS = y => ((y - 1) / 49) * cW + ml;
  const yS = v => cH - (v / maxVal) * cH + mt;

  // Y-axis ticks — 6 lines
  const yTickCount = 6;
  const yStep = maxVal / yTickCount;
  const gridLines = Array.from({length: yTickCount + 1}, (_, i) => {
    const val = yStep * i;
    const y = yS(val).toFixed(1);
    const label = val >= 1e6 ? `${(val/1e6).toLocaleString('fi-FI',{minimumFractionDigits:1,maximumFractionDigits:1})} M€`
                             : `${Math.round(val/1000)} k€`;
    return `<line x1="${ml}" y1="${y}" x2="${W-mr}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="${ml-10}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#475569" font-size="11" font-family="Inter,sans-serif">${label}</text>`;
  }).join('');

  // X-axis ticks — every 5 years
  const xTicks = Array.from({length: 10}, (_, i) => {
    const year = (i + 1) * 5;
    const x = xS(year).toFixed(1);
    return `<line x1="${x}" y1="${mt}" x2="${x}" y2="${(mt+cH).toFixed(1)}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      <text x="${x}" y="${(mt+cH+18).toFixed(1)}" text-anchor="middle" fill="#475569" font-size="11" font-family="Inter,sans-serif">v.${year}</text>`;
  }).join('');

  // SVG paths
  const klPath  = d50.rows.map((row,i) => `${i===0?'M':'L'}${xS(row.year).toFixed(1)},${yS(row.klRunning).toFixed(1)}`).join(' ');
  const mlpPath = d50.rows.map((row,i) => `${i===0?'M':'L'}${xS(row.year).toFixed(1)},${yS(row.mlpRunning).toFixed(1)}`).join(' ');

  // Filled area (KL forward, then MLP in reverse)
  const fillPath = d50.rows.map((row,i) => `${i===0?'M':'L'}${xS(row.year).toFixed(1)},${yS(row.klRunning).toFixed(1)}`).join(' ')
    + ' ' + [...d50.rows].reverse().map(row => `L${xS(row.year).toFixed(1)},${yS(row.mlpRunning).toFixed(1)}`).join(' ') + ' Z';

  // Event markers — key capital events
  const events = [
    ...(r.hasSolar ? [
      { year: 12, label: 'Invertteri', color: '#FBBF24', yPos: 'top' },
      { year: 25, label: 'Invertteri', color: '#FBBF24', yPos: 'top' },
      { year: 38, label: 'Invertteri', color: '#FBBF24', yPos: 'top' },
      { year: 30, label: 'Paneelit', color: '#34D399', yPos: 'bottom' },
    ] : []),
    { year: 22, label: 'Pumppu + LJK', color: '#818CF8', yPos: 'bottom' },
    { year: 42, label: 'LJK', color: '#F87171', yPos: 'top' },
    { year: 23, label: 'COP↑', color: '#34D399', yPos: 'mid', isCOP: true },
  ];

  const eventMarkersHTML = events.map(e => {
    const x = xS(e.year).toFixed(1);
    const labelY = e.yPos === 'top' ? (mt + 18) : e.yPos === 'bottom' ? (mt + cH - 8) : (mt + cH/2);
    const dash = e.isCOP ? '5,3' : '3,4';
    const opacity = e.isCOP ? '0.9' : '0.5';
    return `<line x1="${x}" y1="${mt}" x2="${x}" y2="${(mt+cH).toFixed(1)}" stroke="${e.color}" stroke-width="${e.isCOP ? 1.5 : 1}" stroke-dasharray="${dash}" opacity="${opacity}"/>
      <text x="${(parseFloat(x)+4).toFixed(1)}" y="${labelY.toFixed(1)}" fill="${e.color}" font-size="9" font-family="Inter,sans-serif" font-weight="600" opacity="0.85">${e.label}</text>`;
  }).join('');

  return `
    <div class="cum-chart-card">
      <div class="cum-chart-header">
        <div class="cum-chart-title-row">
          <div>
            <div class="cum-chart-title">📈 Kumulatiiviset kokonaiskustannukset vuosi vuodelta</div>
            <div class="cum-chart-sub">50 vuoden kerääntyvä kustannus — energia + huolto + laitekorvaukset kaikki mukana. Vie hiiri vuoden päälle.</div>
          </div>
          <div class="cum-chart-legend">
            <span class="ccl-item"><span class="ccl-line" style="background:#EF4444"></span>Kaukolämpö</span>
            <span class="ccl-item"><span class="ccl-line" style="background:#34D399"></span>Maalämpö${r.hasSolar ? ' + Aurinko' : ''}</span>
            <span class="ccl-item"><span class="ccl-area"></span>Säästöalue</span>
          </div>
        </div>
      </div>
      <div class="cum-chart-body" id="cumChartWrap">
        <svg id="cumChartSVG" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="overflow:visible;display:block">
          <defs>
            <linearGradient id="klLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#F87171"/>
              <stop offset="100%" stop-color="#EF4444"/>
            </linearGradient>
            <linearGradient id="mlpLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#34D399"/>
              <stop offset="100%" stop-color="#22D3EE"/>
            </linearGradient>
            <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#34D399" stop-opacity="0.20"/>
              <stop offset="100%" stop-color="#34D399" stop-opacity="0.03"/>
            </linearGradient>
            <filter id="lineShadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
            </filter>
            <clipPath id="cumClip">
              <rect x="${ml}" y="${mt}" width="${cW}" height="${cH}"/>
            </clipPath>
          </defs>

          <!-- Y grid + labels -->
          ${gridLines}

          <!-- X ticks -->
          ${xTicks}

          <!-- Axes -->
          <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt+cH}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <line x1="${ml}" y1="${mt+cH}" x2="${W-mr}" y2="${mt+cH}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>

          <!-- Axis label -->
          <text x="14" y="${mt + cH/2}" text-anchor="middle" fill="#475569" font-size="11" font-family="Inter,sans-serif" transform="rotate(-90,14,${(mt+cH/2).toFixed(0)})">Kumulatiivinen kustannus</text>

          <!-- Savings fill area -->
          <path d="${fillPath}" fill="url(#savingsGrad)" clip-path="url(#cumClip)"/>

          <!-- Event markers (below lines) -->
          <g clip-path="url(#cumClip)">${eventMarkersHTML}</g>

          <!-- KL line -->
          <path d="${klPath}" fill="none" stroke="url(#klLineGrad)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" filter="url(#lineShadow)" clip-path="url(#cumClip)"/>

          <!-- MLP line -->
          <path d="${mlpPath}" fill="none" stroke="url(#mlpLineGrad)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" filter="url(#lineShadow)" clip-path="url(#cumClip)"/>

          <!-- Hover crosshair (updated by JS) -->
          <g id="cumHoverG" opacity="0" pointer-events="none">
            <line id="cumVLine" x1="0" y1="${mt}" x2="0" y2="${mt+cH}" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="5,3"/>
            <circle id="cumKlDot" r="6" fill="#EF4444" stroke="white" stroke-width="2"/>
            <circle id="cumMlpDot" r="6" fill="#34D399" stroke="white" stroke-width="2"/>
          </g>

          <!-- Transparent overlay for mouse events -->
          <rect id="cumOverlay" x="${ml}" y="${mt}" width="${cW}" height="${cH}" fill="transparent" style="cursor:crosshair"/>
        </svg>

        <!-- Hover tooltip -->
        <div class="cum-tooltip" id="cumTooltip" style="display:none;pointer-events:none">
          <div class="ct-year" id="cumTYear"></div>
          <div class="ct-row"><span class="ct-dot" style="background:#EF4444"></span><span>Kaukolämpö kumulat.</span><span class="ct-val kl" id="cumTKL"></span></div>
          <div class="ct-row"><span class="ct-dot" style="background:#34D399"></span><span>Maalämpö kumulat.</span><span class="ct-val mlp" id="cumTMLP"></span></div>
          <div class="ct-row ct-savings-row"><span class="ct-dot" style="background:#FBBF24"></span><span>Säästö tähän mennessä</span><span class="ct-val savings" id="cumTDiff"></span></div>
        </div>
      </div>
    </div>`;
}

function initCumulativeChart(r, d50) {
  const W = 1000, H = 440;
  const ml = 95, mr = 50, mt = 50, mb = 65;
  const cW = W - ml - mr, cH = H - mt - mb;
  const maxVal = Math.max(...d50.rows.map(row => row.klRunning));

  const xS = y => ((y - 1) / 49) * cW + ml;
  const yS = v => cH - (v / maxVal) * cH + mt;

  const svg      = document.getElementById('cumChartSVG');
  const overlay  = document.getElementById('cumOverlay');
  const hoverG   = document.getElementById('cumHoverG');
  const vline    = document.getElementById('cumVLine');
  const klDot    = document.getElementById('cumKlDot');
  const mlpDot   = document.getElementById('cumMlpDot');
  const tooltip  = document.getElementById('cumTooltip');
  const wrap     = document.getElementById('cumChartWrap');
  if (!overlay || !svg) return;

  overlay.addEventListener('mousemove', function(e) {
    const svgRect = svg.getBoundingClientRect();
    const scaleX  = W / svgRect.width;
    const mx      = (e.clientX - svgRect.left) * scaleX;
    const chartX  = mx - ml;
    const yearIdx = Math.max(0, Math.min(49, Math.round(chartX / cW * 49)));
    const row     = d50.rows[yearIdx];
    if (!row) return;

    const x   = xS(row.year);
    const yKL = yS(row.klRunning);
    const yMP = yS(row.mlpRunning);

    hoverG.setAttribute('opacity', '1');
    vline.setAttribute('x1', x); vline.setAttribute('x2', x);
    klDot.setAttribute('cx', x);  klDot.setAttribute('cy', yKL);
    mlpDot.setAttribute('cx', x); mlpDot.setAttribute('cy', yMP);

    // Populate tooltip
    document.getElementById('cumTYear').textContent = `Vuosi ${row.year}`;
    document.getElementById('cumTKL').textContent   = row.klRunning.toLocaleString('fi-FI') + ' €';
    document.getElementById('cumTMLP').textContent  = row.mlpRunning.toLocaleString('fi-FI') + ' €';
    document.getElementById('cumTDiff').textContent = '+' + row.diff.toLocaleString('fi-FI') + ' €';

    // Position tooltip relative to wrap div
    const wrapRect = wrap.getBoundingClientRect();
    const tx = e.clientX - wrapRect.left;
    const ty = e.clientY - wrapRect.top;
    tooltip.style.display = 'block';
    tooltip.style.left = (tx + (tx > wrapRect.width * 0.6 ? -210 : 20)) + 'px';
    tooltip.style.top  = Math.max(0, ty - 80) + 'px';
  });

  overlay.addEventListener('mouseleave', function() {
    hoverG.setAttribute('opacity', '0');
    tooltip.style.display = 'none';
  });
}


function renderCopExplainer(r) {
  return `
    <div class="cop-explainer-card">
      <div class="cec-header">
        <div class="cec-icon">⚡</div>
        <div>
          <div class="cec-title">Miksi COP paranee ajan myötä?</div>
          <div class="cec-sub">Historiallinen kehitys ja miksi malli ${fmt(r.COP,1)} → ${fmt(r.upgradedCOP,1)} on perusteltu</div>
        </div>
      </div>
      <div class="cec-timeline">
        <div class="cect-item">
          <div class="cect-year">2000-luku</div>
          <div class="cect-cop">COP ~2,5–3,0</div>
          <div class="cect-desc">Kiinteänopeuksiset kompressorit · R22/R407C-kylmäaineet · Yksinkertainen säätö</div>
        </div>
        <div class="cect-arrow">→</div>
        <div class="cect-item">
          <div class="cect-year">2010-luku</div>
          <div class="cect-cop">COP ~3,0–3,8</div>
          <div class="cect-desc">Muuttuvanopeuksiset (inverteri) kompressorit yleistyvät · R410A · Osittaiskuormalla 20% vähemmän energiaa</div>
        </div>
        <div class="cect-arrow">→</div>
        <div class="cect-item">
          <div class="cect-year">2020-luku</div>
          <div class="cect-cop">COP ~3,5–4,5+</div>
          <div class="cect-desc">R32-kylmäaine (parempi lämmönsiirto) · Älyohjaus ja kysyntäjousto · Optimoitu lämmönvaihdin</div>
        </div>
        <div class="cect-arrow">→</div>
        <div class="cect-item cect-future">
          <div class="cect-year">~v. ${SVC.copImprovementYear} (uusi pumppu)</div>
          <div class="cect-cop" style="color:var(--green)">COP ${fmt(r.upgradedCOP,1)}</div>
          <div class="cect-desc">Malli: +${SVC.copImprovement} COP konservatiivisesti (kaksi vuosikymmentä kehitystä). Laskee sähkökuluja noin ${((1 - r.COP/r.upgradedCOP)*100).toFixed(0)} %.</div>
        </div>
      </div>
      <div class="cec-note">
        💡 <strong>Konservatiivinen arvio:</strong> Käytämme +${SVC.copImprovement} COP-parannusta, vaikka historiatiedot viittaavat jopa 0,15–0,20 COP:n parannukseen vuosikymmenessä. Todellinen hyöty voi olla suurempi, mutta haluamme pysyä varovaisella puolella.
      </div>
    </div>
  `;
}

// ── COP Simulator ─────────────────────────────────────────────────────
function updateCopUI(r) {
  const badge  = document.getElementById('copBadge');
  const impact = document.getElementById('copImpact');
  const slider = document.getElementById('copSlider');
  const epCop  = document.getElementById('ep_cop');
  if (badge)  badge.textContent = `COP = ${r.COP.toFixed(1)}`;
  if (impact) impact.innerHTML  = `Sähköntarve: <strong>${fmt(r.elecNeeded,1)} MWh/v</strong> &nbsp;|&nbsp; Uusi sähkölasku: <strong>${fmtE(r.newElecCost)}/v</strong> &nbsp;|&nbsp; Nettosäästö: <strong style="color:${r.netSavings>=0?'var(--green)':'var(--red)'}">${r.netSavings>=0?'+':''}${fmtE(r.netSavings)}/v</strong>`;
  if (slider) slider.value = r.COP;
  if (epCop && document.activeElement !== epCop) epCop.value = r.COP.toFixed(1);
}

function initCopSimulator(r) {
  const existing = document.getElementById('copSimulator');
  if (existing) existing.remove();
  const sim = document.createElement('div');
  sim.id = 'copSimulator'; sim.className = 'cop-simulator';
  sim.innerHTML = `
    <div class="cop-sim-header"><div class="cop-sim-icon">🎛️</div><div>
      <div class="cop-sim-title">COP-simulaattori — muuta ja katso vaikutus reaaliajassa</div>
      <div class="cop-sim-desc">Vedä liukusäädintä nähdäksesi miten COP-kerroin vaikuttaa kaikkiin laskelmiin</div>
    </div></div>
    <div class="cop-slider-row">
      <span class="cop-label-end">2.0<br/><small>Heikko</small></span>
      <div class="cop-slider-wrap">
        <input type="range" id="copSlider" class="cop-slider" min="2.0" max="5.0" step="0.1" value="${r.COP}"/>
        <div class="cop-ticks"><span>2.0</span><span>2.5</span><span>3.0</span><span>3.5</span><span>4.0</span><span>4.5</span><span>5.0</span></div>
      </div>
      <span class="cop-label-end">5.0<br/><small>Erinomainen</small></span>
    </div>
    <div class="cop-display">
      <div class="cop-badge" id="copBadge">COP = ${r.COP.toFixed(1)}</div>
      <div class="cop-impact" id="copImpact">Sähköntarve: ${fmt(r.elecNeeded,1)} MWh/v &nbsp;|&nbsp; Uusi sähkölasku: ${fmtE(r.newElecCost)}/v</div>
    </div>`;
  document.getElementById('reportSidebar').appendChild(sim);
  document.getElementById('copSlider').addEventListener('input', function() {
    const newCOP = parseFloat(this.value);
    data.cop = String(newCOP);
    const r2 = calculate(newCOP);
    renderReport(r2);
    renderTab2(r2);
    updateCopUI(r2);
    saveSession();
  });
}

// ── Tab system ─────────────────────────────────────────────────────────
window.switchTab = function(n) {
  const reportLayout = reportSection.querySelector('.report-layout');
  const tab2Panel = document.getElementById('tab2Panel');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tabBtn${n}`).classList.add('active');
  if (n === 1) {
    if (reportLayout) reportLayout.style.display = '';
    if (tab2Panel) tab2Panel.classList.add('hidden');
  } else {
    if (reportLayout) reportLayout.style.display = 'none';
    if (tab2Panel) tab2Panel.classList.remove('hidden');
  }
};

// ── Stage progression ──────────────────────────────────────────────────
async function advanceStage() {
  if (currentStage >= stages.length) return;
  const stage = stages[currentStage];
  collectInputs(stage);
  addMessage('user', buildUserSummary(stage));
  const labels = stage.sidebarLabels || {};
  Object.keys(labels).forEach(key => {
    if (data[key]) addSidebarItem(labels[key], data[key]);
  });
  const hasSolar = data.hasSolar;
  let nextIdx = currentStage + 1;
  if (stage.radioKey === 'hasSolar' && hasSolar === 'no') {
    nextIdx = currentStage + 2;
  }
  inputWrapper.innerHTML = '';
  btnSend.disabled = true;
  showTyping();
  await new Promise(r => setTimeout(r, 900));
  removeTyping();
  if (nextIdx < stages.length) {
    const next = stages[nextIdx];
    currentStage = nextIdx;
    setStep(next.step);
    addMessage('bot', next.botMsg);
    buildInputs(next);
  } else {
    setStep(4);
    addMessage('bot', `Kaikki tiedot on kerätty! 🎉 Lasken nyt kattavan taloudellisen analyysisi...`);
    showTyping();
    await new Promise(r => setTimeout(r, 1400));
    removeTyping();
    chatSection.classList.add('hidden');
    showReport(calculate());
  }
}

// ── Persistence ────────────────────────────────────────────────────────
const SAVES_KEY = 'mlp_solar_saves';

function saveSession(nameOverride = null) {
  try {
    let saves = JSON.parse(localStorage.getItem(SAVES_KEY) || '{}');
    const legacy = localStorage.getItem('mlp_solar_v1');
    if (legacy && Object.keys(saves).length === 0) {
      saves['legacy'] = JSON.parse(legacy);
      saves['legacy'].id = 'legacy';
      saves['legacy'].name = 'Vanha tallennus';
      localStorage.removeItem('mlp_solar_v1');
    }
    if (!currentSaveId) currentSaveId = Date.now().toString();
    const existingName = saves[currentSaveId]?.name;
    const saveName = nameOverride || existingName || `Analyysi ${new Date().toLocaleDateString('fi-FI')}`;
    saves[currentSaveId] = { id: currentSaveId, name: saveName, data: { ...data }, savedAt: new Date().toISOString() };
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  } catch(e) {}
}

function getSessions() {
  try {
    const saves = JSON.parse(localStorage.getItem(SAVES_KEY) || '{}');
    return Object.values(saves).sort((a,b) => new Date(b.savedAt) - new Date(a.savedAt));
  } catch(e) { return []; }
}

function checkSavedSession() {
  const container = document.getElementById('savedSessionsContainer');
  if (!container) return;
  container.innerHTML = '';
  const sessions = getSessions();
  if (sessions.length === 0) return;
  sessions.forEach(session => {
    const d = session.data;
    if (!d.kwhYear) return;
    const savedDate = new Date(session.savedAt).toLocaleDateString('fi-FI');
    const banner = document.createElement('div');
    banner.className = 'saved-banner';
    banner.innerHTML = `
      <div class="sb-left">
        <div class="sb-icon">💾</div>
        <div><div class="sb-title">${session.name}</div>
        <div class="sb-desc">${d.kwhYear} MWh · COP ${d.cop||'3.2'} · ${d.elecPrice||'?'} €/MWh · ${savedDate}</div></div>
      </div>
      <div class="sb-actions">
        <button class="sb-resume" data-id="${session.id}">Jatka analyysia →</button>
        <button class="sb-clear" data-id="${session.id}">✕</button>
      </div>`;
    banner.querySelector('.sb-resume').addEventListener('click', () => {
      currentSaveId = session.id;
      Object.keys(data).forEach(k => delete data[k]);
      Object.assign(data, session.data);
      heroSection.classList.add('hidden');
      showReport(calculate());
    });
    banner.querySelector('.sb-clear').addEventListener('click', () => {
      try {
        let saves = JSON.parse(localStorage.getItem(SAVES_KEY) || '{}');
        delete saves[session.id];
        localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
        banner.remove();
      } catch(e) {}
    });
    container.appendChild(banner);
  });
}

// ── Edit Panel ─────────────────────────────────────────────────────────
let editDebounce = null;
const EDIT_FIELDS = [
  { g:'🏠 Nykytilanne',     key:'kwhYear',        label:'Kulutus',         unit:'MWh/v', step:'1' },
  { g:'🏠 Nykytilanne',     key:'monthlyFee',     label:'Kiinteä maksu',   unit:'€/kk',  step:'1' },
  { g:'🏠 Nykytilanne',     key:'yearlyTotal',    label:'Lämpölasku',      unit:'€/v',   step:'100' },
  { g:'🏠 Nykytilanne',     key:'hoitovastike',   label:'Hoitovastike',    unit:'€/m² tai snt/os',  step:'0.1', dynamicUnit: true },
  { g:'🏠 Nykytilanne',     key:'totalBase',      label:'Pinta-ala / Osakkeet', unit:'m² tai kpl', step:'10', dynamicUnit: true },
  { g:'⚡ Sähkö & Aurinko', key:'cop',            label:'COP-kerroin',     unit:'',      step:'0.1', min:'2', max:'5' },
  { g:'⚡ Sähkö & Aurinko', key:'elecPrice',      label:'Sähkön hinta',    unit:'€/MWh', step:'1' },
  { g:'⚡ Sähkö & Aurinko', key:'heatEscalation', label:'Hintojen korotus',unit:'%/v',   step:'0.25', min:'0', max:'5' },
  { g:'⚡ Sähkö & Aurinko', key:'solarKwp',       label:'Aurinko',         unit:'kWp',   step:'1', solarOnly:true },
  { g:'⚡ Sähkö & Aurinko', key:'buildingCount',  label:'Rakennuksia',     unit:'kpl',   step:'1', min:'1', solarOnly:true },
  { g:'💰 Investointi',     key:'loanAmount',     label:'Lainasumma',      unit:'€',     step:'1000' },
  { g:'💰 Investointi',     key:'loanInterest',   label:'Korkokanta',      unit:'%',     step:'0.1' },
  { g:'💰 Investointi',     key:'loanYears',      label:'Laina-aika',      unit:'v',     step:'1' },
];

function renderEditPanel() {
  const old = document.getElementById('editPanel');
  const collapsed = old ? old.dataset.collapsed === '1' : false;
  if (old) old.remove();
  const hasSolar = data.hasSolar === 'yes';
  const loanType = data.loanType || 'annuiteetti';
  const vastikeMode = data.vastikeMode || 'm2';
  const groups = {};
  EDIT_FIELDS.forEach(f => {
    if (f.solarOnly && !hasSolar) return;
    if (!groups[f.g]) groups[f.g] = [];
    groups[f.g].push(f);
  });
  let groupsHTML = Object.entries(groups).map(([grpLabel, fields]) => `
    <div class="ep-group">
      <div class="ep-group-label">${grpLabel}</div>
      <div class="ep-fields">${fields.map(f => {
        let unitLabel = f.unit;
        let fieldLabel = f.label;
        if (f.key === 'hoitovastike') {
          unitLabel = vastikeMode === 'osake' ? 'snt/osake/kk' : '€/m²/kk';
        } else if (f.key === 'totalBase') {
          unitLabel = vastikeMode === 'osake' ? 'osaketta' : 'm²';
          fieldLabel = vastikeMode === 'osake' ? 'Osakkeiden määrä' : 'Pinta-ala';
        }
        return `
        <div class="ep-field">
          <div class="ep-field-label">${fieldLabel}</div>
          <div class="ep-input-row">
            <input id="ep_${f.key}" class="ep-input" type="number" value="${data[f.key]||''}" step="${f.step||'any'}" ${f.min?`min="${f.min}"`:''}${f.max?` max="${f.max}"`:''}>
            ${unitLabel?`<span class="ep-unit">${unitLabel}</span>`:''}
          </div>
        </div>`;
      }).join('')}
      </div>
    </div>`).join('');

  const panel = document.createElement('div');
  panel.id = 'editPanel'; panel.className = 'edit-panel'; panel.dataset.collapsed = collapsed?'1':'0';
  panel.innerHTML = `
    <div class="ep-header" id="epHeader">
      <div class="ep-header-left"><div class="ep-icon">⚙️</div><div>
        <div class="ep-title">Muokkaa parametreja</div>
        <div class="ep-desc">Muuta arvoja — laskelmat päivittyvät automaattisesti</div>
      </div></div>
      <button class="ep-toggle" id="epToggle">${collapsed?'▶ Näytä':'▼ Piilota'}</button>
    </div>
    <div class="ep-body" id="epBody" style="display:${collapsed?'none':'block'}">
      <div class="ep-groups">${groupsHTML}
        <div class="ep-group">
          <div class="ep-group-label">🏷️ Vastikelaskentamalli</div>
          <div class="ep-loan-toggle">
            <button class="ep-tog ep-vastike-tog ${vastikeMode==='m2'?'active':''}" data-vastike="m2">📐 €/m²/kk</button>
            <button class="ep-tog ep-vastike-tog ${vastikeMode==='osake'?'active':''}" data-vastike="osake">🏷️ snt/osake/kk</button>
          </div>
          <div style="margin-top:6px;font-size:11px;color:var(--text3)">${vastikeMode==='osake'
            ? 'Osakeperusteinen — syötä osakemäärä ja hinta senttiä/osake/kk'
            : 'Neliöperusteinen — syötä pinta-ala m² ja hinta €/m²/kk'}</div>
        </div>
        <div class="ep-group">
          <div class="ep-group-label">💳 Lyhennysmalli</div>
          <div class="ep-loan-toggle">
            <button class="ep-tog ep-loan-tog ${loanType==='annuiteetti'?'active':''}" data-loan="annuiteetti">📊 Annuiteetti</button>
            <button class="ep-tog ep-loan-tog ${loanType==='tasalyhennys'?'active':''}" data-loan="tasalyhennys">📉 Tasalyhennys</button>
          </div>
          <div style="margin-top:6px;font-size:11px;color:var(--text3)">${loanType==='annuiteetti'
            ? 'Sama maksuerä joka vuosi &mdash; koron osuus pienenee ajan myötä'
            : 'Sama lyhennys joka vuosi &mdash; korko ja kokonaiserä pienevevät'}</div>
        </div>
        <div class="ep-group">
          <div class="ep-group-label">☀️ Aurinkopaneelit</div>
          <div class="ep-solar-toggle">
            <button class="ep-tog ep-solar-tog ${hasSolar?'active':''}" data-val="yes">Kyllä ☀️</button>
            <button class="ep-tog ep-solar-tog ${!hasSolar?'active':''}" data-val="no">Ei</button>
          </div>
        </div>
      </div>
      <div class="ep-footer"><div class="ep-status" id="epStatus">💾 Tallennetaan automaattisesti</div></div>
    </div>`;

  const sidebar = document.getElementById('reportSidebar');
  sidebar.insertBefore(panel, sidebar.firstChild);

  document.getElementById('epToggle').addEventListener('click', () => {
    const body = document.getElementById('epBody');
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? 'block' : 'none';
    panel.dataset.collapsed = hidden ? '0' : '1';
    document.getElementById('epToggle').textContent = hidden ? '▼ Piilota' : '▶ Näytä';
  });
  panel.querySelectorAll('.ep-solar-tog').forEach(btn => {
    btn.addEventListener('click', () => { data.hasSolar = btn.dataset.val; renderEditPanel(); debouncedRecalc(); });
  });
  panel.querySelectorAll('.ep-loan-tog').forEach(btn => {
    btn.addEventListener('click', () => { data.loanType = btn.dataset.loan; renderEditPanel(); debouncedRecalc(); });
  });
  panel.querySelectorAll('.ep-vastike-tog').forEach(btn => {
    btn.addEventListener('click', () => { data.vastikeMode = btn.dataset.vastike; renderEditPanel(); debouncedRecalc(); });
  });
  panel.querySelectorAll('.ep-input').forEach(input => {
    input.addEventListener('input', () => {
      const key = input.id.replace('ep_','');
      data[key] = input.value;
      if (key==='cop') { const s=document.getElementById('copSlider'); if(s) s.value=parseFloat(input.value)||3.2; }
      debouncedRecalc();
    });
  });
}

function debouncedRecalc() {
  clearTimeout(editDebounce);
  const st = document.getElementById('epStatus');
  if (st) { st.textContent = '⏳ Lasketaan...'; st.style.color = 'var(--amber)'; }
  editDebounce = setTimeout(() => {
    const r = calculate();
    renderReport(r);
    renderTab2(r);
    updateCopUI(r);
    saveSession();
    if (st) { st.textContent = '✅ Tallennettu'; st.style.color = 'var(--green)';
      setTimeout(() => { if(st){ st.textContent='💾 Tallennetaan automaattisesti'; st.style.color=''; }}, 2000); }
  }, 400);
}

// ── Show Report ────────────────────────────────────────────────────────
function showReport(result) {
  reportSection.classList.remove('hidden');

  // Inject tab bar if not already present
  if (!document.getElementById('reportTabBar')) {
    const tabBar = document.createElement('div');
    tabBar.id = 'reportTabBar';
    tabBar.className = 'report-tab-bar';
    tabBar.innerHTML = `
      <button class="tab-btn active" id="tabBtn1" onclick="switchTab(1)">
        <span class="tab-icon">📊</span>
        <span>Hoitovastike &amp; Kassavirta</span>
      </button>
      <button class="tab-btn" id="tabBtn2" onclick="switchTab(2)">
        <span class="tab-icon">🔍</span>
        <span>50 vuoden kokonaiskustannus</span>
      </button>`;
    const reportLayout = reportSection.querySelector('.report-layout');
    reportSection.insertBefore(tabBar, reportLayout);
  }

  // Inject Tab 2 panel if not present
  let tab2Panel = document.getElementById('tab2Panel');
  if (!tab2Panel) {
    tab2Panel = document.createElement('div');
    tab2Panel.id = 'tab2Panel';
    tab2Panel.className = 'tab2-panel hidden';
    const reportLayout = reportSection.querySelector('.report-layout');
    reportSection.insertBefore(tab2Panel, reportLayout.nextSibling);
  }

  // Always start on Tab 1 after recalc
  switchTab(1);

  renderReport(result);
  renderEditPanel();
  initCopSimulator(result);
  renderTab2(result);
  saveSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Init ────────────────────────────────────────────────────────────────
document.getElementById('btnStart').addEventListener('click', () => {
  heroSection.classList.add('hidden');
  chatSection.classList.remove('hidden');
  currentStage = 0;
  currentSaveId = null;
  Object.keys(data).forEach(k => delete data[k]);
  const first = stages[0];
  setStep(first.step);
  addMessage('bot', first.botMsg);
  buildInputs(first);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

btnSend.addEventListener('click', advanceStage);
document.addEventListener('keydown', e => { if (e.key==='Enter' && !e.shiftKey && !btnSend.disabled) advanceStage(); });

document.getElementById('btnRestart').addEventListener('click', () => {
  Object.keys(data).forEach(k => delete data[k]);
  currentStage = 0;
  currentSaveId = null;
  chatMessages.innerHTML = '';
  dataItems.innerHTML = '';
  reportSection.classList.add('hidden');
  heroSection.classList.remove('hidden');
  // Remove tab bar so it's re-created fresh next time
  const tb = document.getElementById('reportTabBar');
  if (tb) tb.remove();
  const tp = document.getElementById('tab2Panel');
  if (tp) tp.remove();
  setStep(stages[0].step);
  checkSavedSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── UI Helpers ────────────────────────────────────────────────────────
window.toggleCard = function(headerEl) {
  const toggleBtn = headerEl.querySelector('.rc-toggle');
  const bodyEl = headerEl.nextElementSibling;
  if (bodyEl.style.display === 'none') {
    bodyEl.style.display = 'block';
    toggleBtn.classList.remove('collapsed');
    toggleBtn.textContent = '▼';
  } else {
    bodyEl.style.display = 'none';
    toggleBtn.classList.add('collapsed');
    toggleBtn.textContent = '▶';
  }
};

// Save As Modal Logic
const modal = document.getElementById('saveModal');
const saveNameInput = document.getElementById('saveNameInput');

document.getElementById('btnSaveAs').addEventListener('click', () => {
  modal.classList.remove('hidden');
  saveNameInput.value = '';
  saveNameInput.focus();
});
document.getElementById('btnCancelSave').addEventListener('click', () => {
  modal.classList.add('hidden');
});
document.getElementById('btnConfirmSave').addEventListener('click', () => {
  const name = saveNameInput.value.trim();
  if (name) {
    saveSession(name);
    modal.classList.add('hidden');
    const st = document.getElementById('epStatus');
    if (st) {
      st.textContent = `✅ Tallennettu nimellä: ${name}`;
      st.style.color = 'var(--green)';
      setTimeout(() => { st.textContent='💾 Tallennetaan automaattisesti'; st.style.color=''; }, 3000);
    }
  }
});

checkSavedSession();
