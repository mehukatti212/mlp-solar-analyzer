// MLP & Solar — Finnish Energy Transition Consultant
'use strict';

// ── State ──────────────────────────────────────────────────────────────
const data = {};
let currentStage = 0;
let currentSaveId = null;

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
    botMsg: `Loistava valinta! ☀️ Suomen aurinkoisuus vaihtelee sijainnin mukaan. Anna tiedot niin lasken arvioidun vuosituotannon:`,
    inputs: [
      { key:'solarAddress', label:'Kiinteistön osoite', placeholder:'esim. Mannerheimintie 1, Helsinki', unit:'' },
      { key:'solarKwp',     label:'Aurinkopaneelijärjestelmän koko (kWp)', placeholder:'esim. 30', unit:'kWp' },
    ],
    sidebarLabels: { solarAddress:'Osoite', solarKwp:'Aurinko (kWp)' }
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

  // Handle extraInputs — may include radio-type and dynamic inputs
  const extraInputs = stage.extraInputs || [];
  extraInputs.forEach(inp => {
    if (inp.type === 'radio') {
      // Render inline radio toggle for vastikeMode
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
        // Pre-select if already stored
        if (data.vastikeMode === opt.val) btn.classList.add('selected');
        btn.onclick = () => {
          row.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          data.vastikeMode = opt.val;
          // Update dynamic fields below
          updateVastikeFields(stage);
          checkSendEnabled(stage);
        };
        row.appendChild(btn);
      });
      rg.appendChild(row);
      inputWrapper.appendChild(rg);
    } else {
      // Normal text input (hoitovastike / totalBase) — rendered in a container that can update
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

  // Enable send when required fields filled
  inputWrapper.querySelectorAll('.chat-input').forEach(input => {
    input.addEventListener('input', () => checkSendEnabled(stage));
  });
}

// Update the dynamic vastike input labels/placeholders when mode changes
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
  // Check vastikeMode radio if stage has it
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
    if (inp.type === 'radio') return; // vastikeMode already stored on click
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
  // Add vastikeMode summary
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
  let irr = 900; // default Finland kWh/kWp/year
  if (addr.includes('helsinki') || addr.includes('espoo') || addr.includes('vantaa')) irr = 950;
  else if (addr.includes('tampere') || addr.includes('turku')) irr = 920;
  else if (addr.includes('oulu')) irr = 870;
  else if (addr.includes('rovaniemi') || addr.includes('lappi')) irr = 820;
  return (kwp * irr * 0.8) / 1000; // MWh, 0.8 = system efficiency
}

// ── Loan calculation (annuity) ─────────────────────────────────────────
function calcAnnuity(principal, ratePercent, years) {
  const r = ratePercent / 100;
  if (r === 0) return principal / years;
  return principal * (r * Math.pow(1+r, years)) / (Math.pow(1+r, years) - 1);
}

// Tasalyhennys: constant principal per year, interest decreases each year
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
  const heatEsc     = (parseFloat(data.heatEscalation) || 1.25) / 100;
  const loanType    = data.loanType || 'annuiteetti';
  const r           = loanInt / 100;

  // ── Vastike mode: 'm2' (€/m²/kk) or 'osake' (snt/osake/kk) ──
  const vastikeMode   = data.vastikeMode || 'm2';
  const totalBase     = parseFloat(data.totalBase) || 0; // either m² or share count
  // For backward compatibility also accept legacy totalM2 key
  const totalM2Legacy = parseFloat(data.totalM2) || 0;
  const baseValue     = totalBase > 0 ? totalBase : totalM2Legacy; // m² or osakkeet

  // hoitovastike is stored as entered:
  //   m2 mode:    €/m²/kk   (e.g. 4.50)
  //   osake mode: snt/osake/kk (e.g. 40)
  const hoito = parseFloat(data.hoitovastike) || 0;

  const elecNeeded  = kwhYear / COP;
  const netElec     = Math.max(0, elecNeeded - solarMWh);
  const newElecCost = netElec * elecPrice;
  const annualLoan  = loanYears > 0 ? calcAnnuity(loanAmount, loanInt, loanYears) : 0;
  const firstYearPayFlat = loanYears > 0 ? calcFlatPrincipalPayment(loanAmount, loanInt, loanYears, 1).total : 0;
  const grossSavings = yearlyTotal - newElecCost;

  const refLoanPay = loanType === 'tasalyhennys' ? firstYearPayFlat : annualLoan;

  const netSavings   = yearlyTotal - (newElecCost + refLoanPay);

  // Hoitovastike impact calculations
  let newHoitoDuringLoan = 0, newHoitoAfterLoan = 0;
  if (baseValue > 0) {
    if (vastikeMode === 'm2') {
      // €/m²/kk: costDelta / m² / 12
      const costDeltaDuringLoan = (newElecCost + refLoanPay) - yearlyTotal;
      const costDeltaAfterLoan  = newElecCost - yearlyTotal;
      newHoitoDuringLoan = hoito + costDeltaDuringLoan / baseValue / 12;
      newHoitoAfterLoan  = hoito + costDeltaAfterLoan  / baseValue / 12;
    } else {
      // snt/osake/kk: costDelta / osakkeet / 12 * 100 (euros → cents)
      const costDeltaDuringLoan = (newElecCost + refLoanPay) - yearlyTotal;
      const costDeltaAfterLoan  = newElecCost - yearlyTotal;
      newHoitoDuringLoan = hoito + (costDeltaDuringLoan / baseValue / 12) * 100;
      newHoitoAfterLoan  = hoito + (costDeltaAfterLoan  / baseValue / 12) * 100;
    }
  }

  // Year-by-year cashflow with escalation and amortization
  let remaining  = loanAmount;
  let cumulative = 0;
  let paybackYear = null;
  let cashflowPositiveYear = null;
  const cashflow  = [];
  const years = loanYears > 0 ? loanYears + 1 : 15;

  for (let y = 1; y <= years; y++) {
    const oldCostY = yearlyTotal * Math.pow(1 + heatEsc, y - 1);
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
      remaining  = Math.max(0, remaining - principalY);
    }
    const newCostY = newElecCost + loanPayY;
    const netY     = oldCostY - newCostY;
    cumulative    += netY;
    if (paybackYear === null && cumulative >= 0) paybackYear = y;
    if (cashflowPositiveYear === null && netY >= 0) cashflowPositiveYear = y;
    cashflow.push({ year:y, oldCost:oldCostY, elecCost:newElecCost,
                    interest:interestY, principal:principalY, loanPay:loanPayY,
                    newCost:newCostY, net:netY, cumulative });
  }
  if (!paybackYear) paybackYear = '>20';

  return { kwhYear, COP, elecNeeded, solarMWh, netElec, newElecCost,
           oldCost: yearlyTotal, monthlyFee, annualLoan, loanType, firstYearPayFlat, refLoanPay,
           newTotalCost: newElecCost + refLoanPay,
           grossSavings, netSavings, hoito, totalM2: baseValue, vastikeMode, heatEsc,
           newHoitoDuringLoan, newHoitoAfterLoan,
           loanAmount, loanInt, loanYears, solarKwp, hasSolar,
           paybackYear, cashflowPositiveYear, cashflow, elecPrice };
}

// ── Report renderer ─────────────────────────────────────────────────────
function renderReport(r) {
  const rc = document.getElementById('reportContent');
  document.getElementById('reportSubtitle').textContent =
    `${fmt(r.kwhYear)} MWh → Maalämpö${r.hasSolar ? ' + Aurinko' : ''} (COP ${fmt(r.COP,1)})`;

  const maxBar = Math.max(r.oldCost, r.newTotalCost) * 1.1;
  const oldPct = (r.oldCost / maxBar * 100).toFixed(1);
  const newPct = (r.newTotalCost / maxBar * 100).toFixed(1);

  const solarRow = r.hasSolar ? `
    <div style="margin-top:10px;padding:12px 16px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.25);border-radius:10px">
      ☀️ <strong>Aurinkopaneelit ${fmt(r.solarKwp,1)} kWp</strong> tuottavat arviolta 
      <strong style="color:var(--green)">${fmt(r.solarMWh,1)} MWh/v</strong>, 
      joten nettosähköntarve on <strong>${fmt(r.netElec,1)} MWh/v</strong>.
    </div>` : '';

  const cfRows = r.cashflow.map(row => {
    const isBreak = row.cumulative >= r.loanAmount && (row.cumulative - (r.oldCost - r.newTotalCost)) < r.loanAmount;
    return `<tr${isBreak?' class="breakeven"':''}>
      <td>${row.year}</td>
      <td>${fmtE(row.oldCost)}</td>
      <td>${fmtE(row.newCost)}</td>
      <td class="${row.net>=0?'positive-cell':'negative-cell'}">${row.net>=0?'+':''}${fmtE(row.net)}</td>
      <td class="${row.cumulative>=0?'positive-cell':'negative-cell'}">${row.cumulative>=0?'+':''}${fmtE(row.cumulative)}</td>
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

    <!-- Card 2: Cost impact -->
    <div class="report-card" style="margin-bottom:20px">
      <div class="rc-header" onclick="toggleCard(this)">
        <div class="rc-header-left">
          <div class="rc-icon green">💶</div>
          <div><div class="rc-title">2. Taloudellinen vaikutus ja säästöt</div>
          <div class="rc-subtitle">Lämmityskustannusten muutos ensimmäisenä vuotena</div></div>
        </div>
        <div class="rc-toggle">▼</div>
      </div>
      <div class="rc-body">
      <div class="savings-grid">
        <div class="savings-cell">
          <div class="sc-label">Vanha lämmityskustannus (vuosi 1) <div class="info-icon" data-tip="Nykyinen arvioitu kaukolämpölasku vuodessa, huomioiden mahdollisen hinnannousun (1. vuosi).">?</div></div>
          <div class="sc-value negative">${fmtE(r.oldCost)}</div>
          <div class="sc-note">Kaukolämpö · +${(r.heatEsc*100).toFixed(2)}%/v korotus</div>
        </div>
        <div class="savings-cell">
          <div class="sc-label">Uusi sähkökustannus <div class="info-icon" data-tip="Maalämpöpumpun kuluttama sähkö kerrottuna nykyisellä sähkön hinnalla (sisältää aurinkopaneelien vähennyksen).">?</div></div>
          <div class="sc-value neutral">${fmtE(r.newElecCost)}</div>
          <div class="sc-note">Maalämpösähkö / vuosi</div>
        </div>
        <div class="savings-cell">
          <div class="sc-label">Lainanlyhennys / vuosi <div class="info-icon" data-tip="Investoinnin vuotuinen maksu valitulla lyhennysmallilla. Tasalyhennyksessä tämä näyttää ensimmäisen vuoden korkeimman erän.">?</div></div>
          <div class="sc-value neutral">${fmtE(r.refLoanPay)}</div>
          <div class="sc-note">${r.loanYears} v × ${fmt(r.loanInt,1)} % (${r.loanType==='tasalyhennys'?'v.1':'vakio'})</div>
        </div>
        <div class="savings-cell">
          <div class="sc-label">Bruttosäästö (ilman lainaa) <div class="info-icon" data-tip="Kuinka paljon säästätte pelkissä energiakuluissa ennen kuin investoinnin rahoituskuluja otetaan huomioon.">?</div></div>
          <div class="sc-value positive">${fmtE(r.grossSavings)}</div>
          <div class="sc-note">Vanha − uusi sähkö</div>
        </div>
      </div>
      <div class="savings-highlight">
        <div>
          <div class="sh-label">${r.netSavings >= 0 ? '✅ Nettosäästö lainanlyhennysten jälkeen (v. 1)' : '⚠️ Lisäkustannus lainanlyhennysten jälkeen (v. 1)'} <div class="info-icon" data-tip="Paljonko taloyhtiönne säästää (tai menettää) rahaa ensimmäisenä vuonna KAIKKIEN kulujen (sähkö + lyhennys) jälkeen.">?</div></div>
          <div style="font-size:13px;color:var(--text3);margin-top:4px">Kustannus ${r.netSavings >= 0 ? 'laskee' : 'nousee'} ${fmtE(r.oldCost)} → ${fmtE(r.newTotalCost)}</div>
        </div>
        <div class="sh-value" style="color:${r.netSavings >= 0 ? 'var(--green)' : 'var(--red)'}">${r.netSavings >= 0 ? '+' : ''}${fmtE(r.netSavings)} / v</div>
      </div>
      ${r.totalM2 > 0 ? `
      <div class="hoito-dynamic" style="margin-top:20px;padding:20px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;">
        <div style="font-weight:700;margin-bottom:8px;font-size:15px;display:flex;align-items:center;gap:8px;">
          🏠 Milloin hoitovastiketta voidaan alentaa?
        </div>
        <div style="font-size:14px;line-height:1.6;color:var(--text2)">
          ${r.netSavings >= 0 ? 
            `Uusi ratkaisu on <strong>välittömästi edullisempi</strong> kuin kaukolämpö. Taloyhtiöllä on mahdollisuus alentaa hoitovastiketta heti ensimmäisestä vuodesta alkaen.` 
          : (r.cashflowPositiveYear && r.cashflowPositiveYear <= r.loanYears ? 
            `Ensimmäisinä vuosina lainanhoitokulut ja sähkö ovat yhteensä hieman kalliimpia kuin vanha kaukolämpö. Koska kaukolämmön hinta kuitenkin nousee joka vuosi (ja tasalyhennyksessä lainan korkokulut laskevat), investointi saavuttaa kassavirtansa "breakeven"-pisteen <strong>vuonna ${r.cashflowPositiveYear}</strong>. <br><br>Tästä vuodesta eteenpäin uusi ratkaisu on vanhaa kaukolämpöä halvempi, ja taloyhtiö voi halutessaan alentaa hoitovastiketta, vaikka lainaa lyhennetään edelleen.` 
          : `Laina-aikana (${r.loanYears} v) uusi ratkaisu on kassavirraltaan kalliimpi kuin kaukolämpö, joten hoitovastiketta ei voida alentaa ennen kuin laina on maksettu.`) }
          <br><br>
          ${r.vastikeMode === 'osake'
            ? `<strong>Lainan maksamisen jälkeen (${r.loanYears} v)</strong> energiakulut putoavat minimiin ja hoitovastiketta voidaan alentaa pysyvästi: arvioitu säästö on silloin <strong>${fmt(r.hoito - r.newHoitoAfterLoan,2)} snt/osake/kk</strong> verrattuna nykytilanteeseen.`
            : `<strong>Lainan maksamisen jälkeen (${r.loanYears} v)</strong> energiakulut putoavat minimiin ja hoitovastiketta voidaan alentaa pysyvästi: arvioitu säästö on silloin <strong>${fmt(r.hoito - r.newHoitoAfterLoan,2)} €/m²/kk</strong> verrattuna nykytilanteeseen.`
          }
        </div>
      </div>` : `
      <div style="margin-top:16px;padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;font-size:13px;color:var(--text2)">
        📌 Syötä taloyhtiön ${r.vastikeMode === 'osake' ? 'osakkeiden kokonaismäärä' : 'kokonaispinta-ala (m²)'} nähdäksesi hoitovastikevaikutus.
      </div>`}
      </div>
      </div>
    </div>

    <!-- Card 3: Loan & cashflow -->
    <div class="report-card">
      <div class="rc-header" onclick="toggleCard(this)">
        <div class="rc-header-left">
          <div class="rc-icon amber">📈</div>
          <div><div class="rc-title">3. Investointi ja takaisinmaksuaikataulu</div>
          <div class="rc-subtitle">Vuosikohtainen kassavirtataulukko</div></div>
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
        <div class="loan-cell"><div class="lc-label">COP-kerroin</div><div class="lc-value">${fmt(r.COP,1)}</div></div>
        <div class="loan-cell" style="border-color:${r.loanType==='tasalyhennys'?'rgba(52,211,153,0.4)':'rgba(129,140,248,0.4)'}">
          <div class="lc-label">Lyhennysmalli</div>
          <div class="lc-value" style="color:${r.loanType==='tasalyhennys'?'var(--green)':'var(--indigo)'}">${r.loanType === 'tasalyhennys' ? '📉 Tasalyhennys' : '📊 Annuiteetti'}</div>
        </div>
      </div>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead><tr>
            <th>Vuosi</th>
            <th>Kaukolämpö *</th>
            <th>Sähkö</th>
            <th>Korko</th>
            <th>Lyhennys</th>
            <th>Uusi yht.</th>
            <th>Netto</th>
            <th>Kumulat.</th>
            ${r.totalM2 > 0 ? `<th title="Vastikkeen muutos vs. nykyinen kaukolämpö. Negatiivinen (vihreä) = vastiketta voi alentaa. Positiivinen (punainen) = lisärahoitustarve.">${r.vastikeMode === 'osake' ? 'Vastike snt/osake/kk' : 'Vastike €/m²/kk'}</th>` : ''}
          </tr></thead>
          <tbody>${r.cashflow.map(row => {
            const isBreak = row.cumulative >= 0 && (row.cumulative - row.net) < 0;
            let vastike = null;
            if (r.totalM2 > 0) {
              if (r.vastikeMode === 'osake') {
                // snt/osake/kk = (net €/v) / osakkeet / 12 * 100
                vastike = (row.net / r.totalM2 / 12) * 100;
              } else {
                vastike = row.net / r.totalM2 / 12;
              }
            }
            const vastikeStr = vastike !== null
              ? `<td class="${vastike >= 0 ? 'positive-cell' : 'negative-cell'} vastike-cell">${(-vastike).toLocaleString('fi-FI', {minimumFractionDigits:2, maximumFractionDigits:2, signDisplay:'always'})}</td>`
              : '';
            return `<tr${isBreak ? ' class="breakeven"' : ''}>
              <td>${row.year}</td>
              <td>${fmtE(row.oldCost)}</td>
              <td>${fmtE(row.elecCost)}</td>
              <td class="neutral-cell">${row.interest > 0 ? fmtE(row.interest) : '—'}</td>
              <td class="neutral-cell">${row.principal > 0 ? fmtE(row.principal) : '—'}</td>
              <td>${fmtE(row.newCost)}</td>
              <td class="${row.net >= 0 ? 'positive-cell' : 'negative-cell'}">${row.net >= 0 ? '+' : ''}${fmtE(row.net)}</td>
              <td class="${row.cumulative >= 0 ? 'positive-cell' : 'negative-cell'}">${row.cumulative >= 0 ? '+' : ''}${fmtE(row.cumulative)}</td>
              ${vastikeStr}
            </tr>`;
          }).join('')}          </tbody>
        </table>
      </div>
      <div class="cf-footnote">* Kaukolämpöhinta kasvaa ${(r.heatEsc*100).toFixed(2)}% vuodessa</div>

      </div>
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
            <li style="margin-bottom:6px;"><strong>Omakäyttö:</strong> Oletamme, että tämä määrä pystytään hyödyntämään täysin taloyhtiön oman maalämpöpumpun ja kiinteistösähkön tarpeisiin (niin sanottu omakäyttö). Koska aurinkosähköä syntyy eniten kesällä, ylijäävää sähköä voidaan todellisuudessa joutua myymään sähköverkkoon. Myynnistä saatavaa korvausta ei ole tässä raportissa huomioitu ollenkaan, mikä jättää säästöarvioon turvamarginaalia.</li>
          </ul>
          <div style="padding:16px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;">
            <strong>Teidän kohteeseenne suunniteltu järjestelmä:</strong><br>
            Paneelien nimellisteho: <strong style="color:var(--text)">${r.solarKwp} kWp</strong><br>
            Arvioitu hyödynnettävä vuosituotto: <strong style="color:var(--text)">${fmt(r.solarKwp * 0.72, 1)} MWh</strong>
          </div>
        </div>
      </div>
    </div>
    ` : ''}
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
    updateCopUI(r2);
    saveSession();
  });
}

// ── Stage progression ──────────────────────────────────────────────────
async function advanceStage() {
  if (currentStage >= stages.length) return;
  const stage = stages[currentStage];

  collectInputs(stage);

  // Build user message
  addMessage('user', buildUserSummary(stage));

  // Update sidebar
  const labels = stage.sidebarLabels || {};
  Object.keys(labels).forEach(key => {
    if (data[key]) addSidebarItem(labels[key], data[key]);
  });

  // Determine next
  const hasSolar = data.hasSolar;
  let nextIdx = currentStage + 1;

  // Skip solar stage if user said no
  if (stage.radioKey === 'hasSolar' && hasSolar === 'no') {
    nextIdx = currentStage + 2; // skip stage 2.5
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
    // Also check for legacy mlp_solar_v1 and migrate it if found
    const legacy = localStorage.getItem('mlp_solar_v1');
    if (legacy && Object.keys(saves).length === 0) {
       saves['legacy'] = JSON.parse(legacy);
       saves['legacy'].id = 'legacy';
       saves['legacy'].name = 'Vanha tallennus';
       localStorage.removeItem('mlp_solar_v1');
    }

    if (!currentSaveId) {
       currentSaveId = Date.now().toString();
    }
    
    const existingName = saves[currentSaveId]?.name;
    const saveName = nameOverride || existingName || `Analyysi ${new Date().toLocaleDateString('fi-FI')}`;

    saves[currentSaveId] = {
      id: currentSaveId,
      name: saveName,
      data: { ...data },
      savedAt: new Date().toISOString()
    };
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
        // Dynamic unit labels based on vastikeMode
        let unitLabel = f.unit;
        let fieldLabel = f.label;
        if (f.key === 'hoitovastike') {
          unitLabel = vastikeMode === 'osake' ? 'snt/osake/kk' : '€/m²/kk';
          fieldLabel = 'Hoitovastike';
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
  sidebar.insertBefore(panel, sidebar.firstChild); // Put edit panel at top of sidebar
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
    updateCopUI(r);
    saveSession();
    if (st) { st.textContent = '✅ Tallennettu'; st.style.color = 'var(--green)';
      setTimeout(() => { if(st){ st.textContent='💾 Tallennetaan automaattisesti'; st.style.color=''; }}, 2000); }
  }, 400);
}

// ── Show Report ────────────────────────────────────────────────────────
function showReport(result) {
  reportSection.classList.remove('hidden');
  renderReport(result);
  renderEditPanel();
  initCopSimulator(result);
  saveSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Init ────────────────────────────────────────────────────────────────
document.getElementById('btnStart').addEventListener('click', () => {
  heroSection.classList.add('hidden');
  chatSection.classList.remove('hidden');
  currentStage = 0;
  currentSaveId = null; // Start fresh
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
  currentSaveId = null;
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
