// ============================================================
// modules/finance.js - \u6a21\u57576：\u5b58\u6b3e\u8fd8\u6b3e
// ============================================================

import { put, bulkPut, get, getAll, del, getByIndex, getSetting } from '../db.js';
import { genId, today, fmtDate, monthStr, lastMonth, toast, openBottomSheet, confirmDialog, escapeHtml } from '../utils.js';
import { hasPassword, isAuthed } from './auth.js';

let initialized = false;
let financeChart = null;

export async function initFinance() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// \u6570\u636e\u64cd\u4f5c
// ============================================================

async function addLoan(data) {
  const loan = {
    id: genId(),
    bank: data.bank,
    principal: parseFloat(data.principal) || 0,
    currentBalance: parseFloat(data.currentBalance) || parseFloat(data.principal) || 0,
    monthlyPayment: parseFloat(data.monthlyPayment) || 0,
    paymentType: data.paymentType || 'fixed', // 'fixed'=\u6bcf\u6708\u56fa\u5b9a\u8fd8\u6b3e, 'variable'=\u6bcf\u6708\u4e0d\u56fa\u5b9a\u8fd8\u6b3e
    remainingPeriods: parseInt(data.remainingPeriods) || 0,
    estimatedMonthlyPayment: parseFloat(data.estimatedMonthlyPayment) || 0,
    startDate: data.startDate || today(),
    endDate: data.endDate || '',
    interestRate: parseFloat(data.interestRate) || 0,
    note: data.note || '',
    createdAt: new Date().toISOString(),
  };
  await put('loans', loan);
  return loan;
}

async function addIncome(data) {
  const income = {
    id: genId(),
    month: data.month || monthStr(new Date()),
    amount: parseFloat(data.amount) || 0,
    source: data.source || '\u5de5\u4f5c\u6536\u5165',
    note: data.note || '',
    date: data.date || today(),
    createdAt: new Date().toISOString(),
  };
  await put('incomes', income);
  return income;
}

async function updateIncome(id, data) {
  const existing = await get('incomes', id);
  if (!existing) return null;
  const updated = {
    ...existing,
    month: data.month || existing.month,
    amount: parseFloat(data.amount) || 0,
    source: data.source || existing.source,
    note: data.note !== undefined ? data.note : existing.note,
    date: data.date || existing.date,
    updatedAt: new Date().toISOString(),
  };
  await put('incomes', updated);
  return updated;
}

async function addRepayment(loanId, month, amount) {
  const repayment = {
    id: genId(),
    loanId,
    month,
    amount: parseFloat(amount) || 0,
    date: today(),
    createdAt: new Date().toISOString(),
  };
  await put('repayments', repayment);

  // \u66f4\u65b0\u8d37\u6b3e\u4f59\u989d
  const loans = await getAll('loans');
  const loan = loans.find(l => l.id === loanId);
  if (loan) {
    loan.currentBalance = Math.max(0, loan.currentBalance - repayment.amount);
    await put('loans', loan);
  }
  return repayment;
}

// ============================================================
// \u6e32\u67d3：\u5b58\u6b3e\u8fd8\u6b3e\u4e3b\u9875\u9762
// ============================================================

let currentTab = 'overview';

export async function renderFinance(container) {
  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentTab==='overview'?'active':''}" onclick="window.__finTab('overview')">\u603b\u89c8</button>
      <button class="filter-tab ${currentTab==='loans'?'active':''}" onclick="window.__finTab('loans')">\u8d37\u6b3e</button>
      <button class="filter-tab ${currentTab==='income'?'active':''}" onclick="window.__finTab('income')">\u6536\u5165</button>
    </div>
    <div id="finance-content"></div>
    <button class="fab" onclick="window.__finAdd()" style="right:72px">+</button>
    ${currentTab === 'income' ? '<button class="fab fab-secondary" onclick="window.__finBatchAdd()">≡</button>' : ''}
  `;

  window.__finTab = (t) => { currentTab = t; renderFinance(container); };
  window.__finAdd = () => {
    if (currentTab === 'overview' || currentTab === 'loans') showAddLoanDialog(container);
    else if (currentTab === 'income') showAddIncomeDialog(container);
  };
  window.__finBatchAdd = () => showBatchAddIncomeDialog(container);
  window.__repayLoan = (loanId) => showRepayDialog(container, loanId);
  window.__delLoan = async (id) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u7b14\u8d37\u6b3e\u8bb0\u5f55？')) {
      await del('loans', id);
      renderFinance(container);
    }
  };
  window.__editLoan = (id) => showEditLoanDialog(container, id);
  window.__delIncome = async (id) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u6536\u5165\u8bb0\u5f55？')) {
      await del('incomes', id);
      renderFinance(container);
    }
  };
  window.__editIncome = (id) => showAddIncomeDialog(container, id);

  await renderFinanceContent();
}

async function renderFinanceContent() {
  const content = document.getElementById('finance-content');
  if (!content) return;

  if (currentTab === 'overview') await renderOverview(content);
  else if (currentTab === 'loans') await renderLoans(content);
  else if (currentTab === 'income') await renderIncome(content);
}

// ============================================================
// \u603b\u89c8
// ============================================================

async function renderOverview(container) {
  const loans = await getAll('loans');
  const incomes = await getAll('incomes');
  const currentYear = new Date().getFullYear();

  const totalDebt = loans.reduce((sum, l) => sum + (l.currentBalance || 0), 0);
  const totalMonthlyPayment = loans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  const yearIncomes = incomes.filter(i => i.month && i.month.startsWith(String(currentYear)));
  const yearIncome = yearIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);

  // \u6309\u94f6\u884c\u5206\u7ec4
  const bankGroups = {};
  loans.forEach(l => {
    if (!bankGroups[l.bank]) bankGroups[l.bank] = [];
    bankGroups[l.bank].push(l);
  });

  container.innerHTML = `
    <div class="finance-overview">
      <div class="finance-card income">
        <div class="finance-card-label">\u5f53\u5e74\u603b\u6536\u5165</div>
        <div class="finance-card-value">¥${formatNum(yearIncome)}</div>
      </div>
      <div class="finance-card debt">
        <div class="finance-card-label">\u6b20\u6b3e\u603b\u989d</div>
        <div class="finance-card-value">¥${formatNum(totalDebt)}</div>
      </div>
      <div class="finance-card">
        <div class="finance-card-label">\u6708\u4f9b\u603b\u989d</div>
        <div class="finance-card-value" style="color:var(--warning)">¥${formatNum(totalMonthlyPayment)}</div>
      </div>
    </div>

    ${loans.length > 0 ? `
    <div class="card">
      <div class="card-title"><span class="title-left">🏦 \u5404\u94f6\u884c\u6b20\u6b3e\u5206\u5e03</span></div>
      <div class="chart-container"><canvas id="finance-chart"></canvas></div>
    </div>` : ''}

    <div class="card">
      <div class="card-title"><span class="title-left">📋 \u8d37\u6b3e\u6982\u89c8</span></div>
      ${loans.length > 0 ? loans.map(l => {
        const progress = l.principal > 0 ? Math.round((1 - l.currentBalance / l.principal) * 100) : 0;
        const paymentLabel = l.paymentType === 'variable' ? '\u4e0d\u56fa\u5b9a' : `¥${formatNum(l.monthlyPayment)}`;
        return `
        <div style="padding:12px 0;border-bottom:1px solid var(--gray-100)">
          <div class="flex-between">
            <div>
              <span class="font-bold">${escapeHtml(l.bank)}</span>
              ${l.remainingPeriods ? `<span class="text-xs text-gray ml-8">\u5269${l.remainingPeriods}\u671f</span>` : ''}
            </div>
            <div class="font-bold text-danger">¥${formatNum(l.currentBalance)}</div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="flex-between text-xs text-gray mt-8">
            <span>\u5df2\u8fd8 ${progress}% · \u6708\u4f9b ${paymentLabel}</span>
            <span>${l.endDate ? '\u5230\u671f ' + fmtDate(l.endDate).slice(0,7) : ''}</span>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">\u6682\u65e0\u8d37\u6b3e\u8bb0\u5f55</div></div>'}
    </div>
  `;

  // \u7ed8\u5236\u94f6\u884c\u5206\u5e03\u56fe
  if (loans.length > 0) {
    drawFinanceChart(bankGroups);
  }
}

function drawFinanceChart(bankGroups) {
  const ctx = document.getElementById('finance-chart');
  if (!ctx) return;
  if (financeChart) financeChart.destroy();

  const labels = Object.keys(bankGroups);
  const data = labels.map(bank => bankGroups[bank].reduce((sum, l) => sum + l.currentBalance, 0));
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  financeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
      }
    }
  });
}

// ============================================================
// \u8d37\u6b3e\u5217\u8868
// ============================================================

async function renderLoans(container) {
  const loans = await getAll('loans');
  const bankGroups = {};
  loans.forEach(l => {
    if (!bankGroups[l.bank]) bankGroups[l.bank] = [];
    bankGroups[l.bank].push(l);
  });

  if (loans.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-text">\u6682\u65e0\u8d37\u6b3e\u8bb0\u5f55<br>\u70b9\u51fb + \u6dfb\u52a0\u8d37\u6b3e</div></div>';
    return;
  }

  container.innerHTML = Object.entries(bankGroups).map(([bank, bankLoans]) => `
    <div class="card">
      <div class="card-title">
        <span class="title-left">🏦 ${escapeHtml(bank)}</span>
        <span class="text-xs text-gray">¥${formatNum(bankLoans.reduce((s,l) => s + l.currentBalance, 0))}</span>
      </div>
      ${bankLoans.map(l => {
        const progress = l.principal > 0 ? Math.round((1 - l.currentBalance / l.principal) * 100) : 0;
        const paymentLabel = l.paymentType === 'variable' ? '\u6bcf\u6708\u4e0d\u56fa\u5b9a' : `¥${formatNum(l.monthlyPayment)}`;
        return `
        <div style="padding:12px 0;border-bottom:1px solid var(--gray-100)">
          <div class="flex-between mb-8">
            <div>
              <div class="font-bold text-sm">${escapeHtml(l.bank)}</div>
              <div class="text-xs text-gray">\u5229\u7387 ${l.interestRate}%${l.remainingPeriods ? ' · \u5269' + l.remainingPeriods + '\u671f' : ''}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="task-edit" onclick="window.__editLoan('${l.id}')">✎</button>
              <button class="task-delete" onclick="window.__delLoan('${l.id}')">✕</button>
            </div>
          </div>
          <div class="flex-between text-sm mb-8">
            <span>\u5269\u4f59：¥${formatNum(l.currentBalance)}</span>
            <span class="text-warning">\u6708\u4f9b：${paymentLabel}</span>
          </div>
          ${l.estimatedMonthlyPayment ? `<div class="text-xs text-gray mb-8">\u9884\u4f30\u6708\u8fd8：¥${formatNum(l.estimatedMonthlyPayment)}</div>` : ''}
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="flex-between text-xs text-gray mt-8">
            <span>\u672c\u91d1 ¥${formatNum(l.principal)}</span>
            <span>\u5df2\u8fd8 ${progress}%</span>
          </div>
          ${l.note ? `<div class="text-xs text-gray mt-8">📝 ${escapeHtml(l.note)}</div>` : ''}
          <button class="btn-outline btn-full mt-8" onclick="window.__repayLoan('${l.id}')">\u8bb0\u5f55\u8fd8\u6b3e</button>
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

// ============================================================
// \u6536\u5165\u5217\u8868
// ============================================================

async function renderIncome(container) {
  const incomes = await getAll('incomes');
  incomes.sort((a, b) => b.month.localeCompare(a.month));

  if (incomes.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">💵</div><div class="empty-text">\u6682\u65e0\u6536\u5165\u8bb0\u5f55<br>\u70b9\u51fb + \u6dfb\u52a0\u6536\u5165</div></div>';
    return;
  }

  // \u6309\u6708\u5206\u7ec4
  const monthGroups = {};
  incomes.forEach(i => {
    if (!monthGroups[i.month]) monthGroups[i.month] = [];
    monthGroups[i.month].push(i);
  });

  container.innerHTML = Object.entries(monthGroups).map(([month, monthIncomes]) => {
    const total = monthIncomes.reduce((s, i) => s + i.amount, 0);
    return `
    <div class="card">
      <div class="card-title">
        <span class="title-left">📅 ${month}</span>
        <span class="text-success font-bold">¥${formatNum(total)}</span>
      </div>
      ${monthIncomes.map(i => `
        <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
          <div style="flex:1" onclick="window.__editIncome('${i.id}')">
            <div class="text-sm">${escapeHtml(i.source)}</div>
            <div class="text-xs text-gray">${fmtDate(i.date)}${i.note ? ' · ' + escapeHtml(i.note) : ''}</div>
          </div>
          <div class="flex gap-8 items-center">
            <span class="font-bold text-success">+¥${formatNum(i.amount)}</span>
            <button class="task-edit" onclick="window.__editIncome('${i.id}')">✎</button>
            <button class="task-delete" onclick="window.__delIncome('${i.id}')">✕</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }).join('');
}

// ============================================================
// \u6dfb\u52a0\u8d37\u6b3e\u5bf9\u8bdd\u6846
// ============================================================

function showAddLoanDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u94f6\u884c\u540d\u79f0</label>
        <input type="text" id="loan-bank" placeholder="\u5982：\u5de5\u5546\u94f6\u884c、\u62db\u5546\u94f6\u884c">
      </div>
      <div class="form-group">
        <label>\u8d37\u6b3e\u672c\u91d1 (\u5143)</label>
        <input type="number" step="0.01" id="loan-principal" placeholder="\u5982：500000.00">
      </div>
      <div class="form-group">
        <label>\u5f53\u524d\u5269\u4f59\u6b20\u6b3e (\u5143)</label>
        <input type="number" step="0.01" id="loan-balance" placeholder="\u7559\u7a7a\u5219\u7b49\u4e8e\u672c\u91d1">
      </div>
      <div class="form-group">
        <label>\u8fd8\u6b3e\u65b9\u5f0f</label>
        <select id="loan-payment-type">
          <option value="fixed">\u6bcf\u6708\u56fa\u5b9a\u8fd8\u6b3e</option>
          <option value="variable">\u6bcf\u6708\u4e0d\u56fa\u5b9a\u8fd8\u6b3e</option>
        </select>
      </div>
      <div class="form-group" id="loan-monthly-group">
        <label>\u6bcf\u6708\u56fa\u5b9a\u8fd8\u6b3e\u91d1\u989d (\u5143)</label>
        <input type="number" step="0.01" id="loan-monthly" placeholder="\u5982：5000.00">
      </div>
      <div class="form-group">
        <label>\u6bcf\u6708\u9884\u4f30\u8fd8\u6b3e\u91d1\u989d (\u5143)</label>
        <input type="number" step="0.01" id="loan-estimated" placeholder="\u5982：4500.00">
      </div>
      <div class="form-group">
        <label>\u5269\u4f59\u671f\u6570 (\u6708)</label>
        <input type="number" id="loan-periods" placeholder="\u5982：36">
      </div>
      <div class="form-group">
        <label>\u5e74\u5229\u7387 (%)</label>
        <input type="number" id="loan-rate" step="0.01" placeholder="\u5982：4.9">
      </div>
      <div class="form-group">
        <label>\u5230\u671f\u65e5\u671f（\u53ef\u9009）</label>
        <input type="date" id="loan-enddate">
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="loan-note" placeholder="\u5982：\u7b49\u989d\u672c\u606f、\u63d0\u524d\u8fd8\u6b3e\u7b49">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveLoan()">\u4fdd\u5b58</button>
    </div>
  `;

  const sheet = openBottomSheet('\u6dfb\u52a0\u8d37\u6b3e', html);
  window.__currentSheet = sheet;

  // \u8fd8\u6b3e\u65b9\u5f0f\u5207\u6362
  document.getElementById('loan-payment-type').onchange = (e) => {
    const monthlyGroup = document.getElementById('loan-monthly-group');
    monthlyGroup.style.display = e.target.value === 'fixed' ? 'block' : 'none';
  };

  window.__saveLoan = async () => {
    const bank = document.getElementById('loan-bank').value.trim();
    if (!bank) { toast('\u8bf7\u8f93\u5165\u94f6\u884c\u540d\u79f0'); return; }
    const paymentType = document.getElementById('loan-payment-type').value;
    await addLoan({
      bank,
      principal: document.getElementById('loan-principal').value,
      currentBalance: document.getElementById('loan-balance').value,
      paymentType,
      monthlyPayment: paymentType === 'fixed' ? document.getElementById('loan-monthly').value : 0,
      estimatedMonthlyPayment: document.getElementById('loan-estimated').value,
      remainingPeriods: document.getElementById('loan-periods').value,
      interestRate: document.getElementById('loan-rate').value,
      endDate: document.getElementById('loan-enddate').value,
      note: document.getElementById('loan-note').value.trim(),
    });
    toast('\u8d37\u6b3e\u5df2\u6dfb\u52a0');
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };
}

// ============================================================
// \u7f16\u8f91\u8d37\u6b3e\u5bf9\u8bdd\u6846
// ============================================================

async function showEditLoanDialog(container, id) {
  const all = await getAll('loans');
  const loan = all.find(l => l.id === id);
  if (!loan) { toast('\u8bb0\u5f55\u4e0d\u5b58\u5728'); return; }

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u94f6\u884c\u540d\u79f0</label>
        <input type="text" id="loan-bank" value="${escapeHtml(loan.bank)}">
      </div>
      <div class="form-group">
        <label>\u8d37\u6b3e\u672c\u91d1 (\u5143)</label>
        <input type="number" step="0.01" id="loan-principal" value="${loan.principal}">
      </div>
      <div class="form-group">
        <label>\u5f53\u524d\u5269\u4f59\u6b20\u6b3e (\u5143)</label>
        <input type="number" step="0.01" id="loan-balance" value="${loan.currentBalance}">
      </div>
      <div class="form-group">
        <label>\u8fd8\u6b3e\u65b9\u5f0f</label>
        <select id="loan-payment-type">
          <option value="fixed" ${loan.paymentType === 'fixed' || !loan.paymentType ? 'selected' : ''}>\u6bcf\u6708\u56fa\u5b9a\u8fd8\u6b3e</option>
          <option value="variable" ${loan.paymentType === 'variable' ? 'selected' : ''}>\u6bcf\u6708\u4e0d\u56fa\u5b9a\u8fd8\u6b3e</option>
        </select>
      </div>
      <div class="form-group" id="loan-monthly-group" style="display:${loan.paymentType === 'variable' ? 'none' : 'block'}">
        <label>\u6bcf\u6708\u56fa\u5b9a\u8fd8\u6b3e\u91d1\u989d (\u5143)</label>
        <input type="number" step="0.01" id="loan-monthly" value="${loan.monthlyPayment || ''}">
      </div>
      <div class="form-group">
        <label>\u6bcf\u6708\u9884\u4f30\u8fd8\u6b3e\u91d1\u989d (\u5143)</label>
        <input type="number" step="0.01" id="loan-estimated" value="${loan.estimatedMonthlyPayment || ''}">
      </div>
      <div class="form-group">
        <label>\u5269\u4f59\u671f\u6570 (\u6708)</label>
        <input type="number" id="loan-periods" value="${loan.remainingPeriods || ''}">
      </div>
      <div class="form-group">
        <label>\u5e74\u5229\u7387 (%)</label>
        <input type="number" id="loan-rate" step="0.01" value="${loan.interestRate}">
      </div>
      <div class="form-group">
        <label>\u5230\u671f\u65e5\u671f（\u53ef\u9009）</label>
        <input type="date" id="loan-enddate" value="${loan.endDate || ''}">
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="loan-note" value="${escapeHtml(loan.note || '')}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateLoan()">\u4fdd\u5b58\u4fee\u6539</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delLoanFromEdit('${id}')">\u5220\u9664\u6b64\u8d37\u6b3e</button>
    </div>
  `;

  const sheet = openBottomSheet('\u7f16\u8f91\u8d37\u6b3e', html);

  document.getElementById('loan-payment-type').onchange = (e) => {
    document.getElementById('loan-monthly-group').style.display = e.target.value === 'fixed' ? 'block' : 'none';
  };

  window.__updateLoan = async () => {
    const bank = document.getElementById('loan-bank').value.trim();
    if (!bank) { toast('\u8bf7\u8f93\u5165\u94f6\u884c\u540d\u79f0'); return; }
    const paymentType = document.getElementById('loan-payment-type').value;
    loan.bank = bank;
    loan.principal = parseFloat(document.getElementById('loan-principal').value) || 0;
    loan.currentBalance = parseFloat(document.getElementById('loan-balance').value) || loan.principal;
    loan.paymentType = paymentType;
    loan.monthlyPayment = paymentType === 'fixed' ? (parseFloat(document.getElementById('loan-monthly').value) || 0) : 0;
    loan.estimatedMonthlyPayment = parseFloat(document.getElementById('loan-estimated').value) || 0;
    loan.remainingPeriods = parseInt(document.getElementById('loan-periods').value) || 0;
    loan.interestRate = parseFloat(document.getElementById('loan-rate').value) || 0;
    loan.endDate = document.getElementById('loan-enddate').value;
    loan.note = document.getElementById('loan-note').value.trim();
    loan.updatedAt = new Date().toISOString();
    await put('loans', loan);
    toast('\u5df2\u4fee\u6539');
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };

  window.__delLoanFromEdit = async (delId) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u7b14\u8d37\u6b3e\u8bb0\u5f55？')) {
      await del('loans', delId);
      toast('\u5df2\u5220\u9664');
      sheet.close();
      renderFinance(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// \u6dfb\u52a0\u6536\u5165\u5bf9\u8bdd\u6846
// ============================================================

async function showAddIncomeDialog(container, editId) {
  const isEdit = !!editId;
  const currentMonth = monthStr(new Date());

  // \u7f16\u8f91\u6a21\u5f0f：\u9884\u586b\u5df2\u6709\u6570\u636e
  let existing = null;
  if (isEdit) {
    const all = await getAll('incomes');
    existing = all.find(i => i.id === editId);
    if (!existing) { toast('\u8bb0\u5f55\u4e0d\u5b58\u5728'); return; }
  }

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u6708\u4efd</label>
        <input type="month" id="income-month" value="${existing ? existing.month : currentMonth}">
      </div>
      <div class="form-group">
        <label>\u6536\u5165\u6765\u6e90</label>
        <select id="income-source">
          <option value="\u5de5\u4f5c\u6536\u5165" ${existing && existing.source === '\u5de5\u4f5c\u6536\u5165' ? 'selected' : ''}>💼 \u5de5\u4f5c\u6536\u5165</option>
          <option value="\u4e52\u4e53" ${existing && existing.source === '\u4e52\u4e53' ? 'selected' : ''}>🏓 \u4e52\u4e53</option>
          <option value="\u6295\u8d44" ${existing && existing.source === '\u6295\u8d44' ? 'selected' : ''}>📈 \u6295\u8d44</option>
          <option value="\u5176\u4ed6" ${existing && existing.source === '\u5176\u4ed6' ? 'selected' : ''}>📌 \u5176\u4ed6</option>
        </select>
      </div>
      <div class="form-group">
        <label>\u91d1\u989d (\u5143)</label>
        <input type="number" step="0.01" id="income-amount" placeholder="\u5982：8000.00" value="${existing ? existing.amount : ''}">
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8</label>
        <input type="text" id="income-note" placeholder="\u5982：5\u6708\u5de5\u8d44+\u63d0\u6210" value="${existing ? escapeHtml(existing.note || '') : ''}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveIncome()">${isEdit ? '\u4fdd\u5b58\u4fee\u6539' : '\u4fdd\u5b58'}</button>
      ${isEdit ? `<button class="btn-danger-outline btn-full mt-8" onclick="window.__deleteIncomeFromEdit('${editId}')">\u5220\u9664\u6b64\u6761\u8bb0\u5f55</button>` : ''}
    </div>
  `;

  const sheet = openBottomSheet(isEdit ? '\u7f16\u8f91\u6536\u5165' : '\u6dfb\u52a0\u6536\u5165', html);
  window.__currentSheet = sheet;

  window.__saveIncome = async () => {
    const amount = document.getElementById('income-amount').value;
    if (!amount) { toast('\u8bf7\u8f93\u5165\u91d1\u989d'); return; }
    const payload = {
      month: document.getElementById('income-month').value,
      source: document.getElementById('income-source').value,
      amount,
      note: document.getElementById('income-note').value.trim(),
    };
    if (isEdit) {
      await updateIncome(editId, payload);
      toast('\u5df2\u4fee\u6539');
    } else {
      await addIncome(payload);
      toast('\u6536\u5165\u5df2\u8bb0\u5f55');
    }
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };

  // \u7f16\u8f91\u6a21\u5f0f\u4e0b\u7684\u5220\u9664\u6309\u94ae（\u72ec\u7acb\u51fd\u6570，\u4e0d\u8986\u76d6\u5217\u8868\u7684 __delIncome）
  if (isEdit) {
    window.__deleteIncomeFromEdit = async (id) => {
      if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u6536\u5165\u8bb0\u5f55？')) {
        await del('incomes', id);
        toast('\u5df2\u5220\u9664');
        sheet.close();
        renderFinance(document.getElementById('main-content'));
      }
    };
  }
}

// ============================================================
// \u6279\u91cf\u6dfb\u52a0\u6536\u5165\u5bf9\u8bdd\u6846
// ============================================================

function showBatchAddIncomeDialog(container) {
  const currentMonth = monthStr(new Date());
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u7edf\u4e00\u6708\u4efd</label>
        <input type="month" id="batch-income-month" value="${currentMonth}">
      </div>
      <div class="form-group">
        <label>\u6279\u91cf\u6536\u5165（\u6bcf\u884c\u4e00\u6761）</label>
        <textarea id="batch-income-text" placeholder="\u683c\u5f0f：\u6765\u6e90,\u91d1\u989d,\u5907\u6ce8（\u5907\u6ce8\u53ef\u7701\u7565）&#10;\u6bcf\u884c\u4e00\u6761，\u4f8b\u5982：&#10;\u5de5\u4f5c\u6536\u5165,8000,7\u6708\u5de5\u8d44&#10;\u4e52\u4e53,500&#10;\u6295\u8d44,1500,\u57fa\u91d1\u5206\u7ea2" rows="8" style="font-size:14px;line-height:1.6"></textarea>
        <div class="form-hint">\u6bcf\u884c\u683c\u5f0f：\u6765\u6e90,\u91d1\u989d,\u5907\u6ce8（\u9017\u53f7\u5206\u9694，\u5907\u6ce8\u53ef\u7701\u7565）</div>
      </div>
      <div class="form-group">
        <label>\u53ef\u7528\u6765\u6e90</label>
        <div class="form-hint">\u5de5\u4f5c\u6536\u5165 / \u4e52\u4e53 / \u6295\u8d44 / \u5176\u4ed6</div>
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBatchIncome()">\u6279\u91cf\u6dfb\u52a0</button>
    </div>
  `;

  const sheet = openBottomSheet('\u6279\u91cf\u6dfb\u52a0\u6536\u5165', html);
  window.__currentSheet = sheet;

  window.__saveBatchIncome = async () => {
    const month = document.getElementById('batch-income-month').value || currentMonth;
    const text = document.getElementById('batch-income-text').value.trim();
    if (!text) { toast('\u8bf7\u8f93\u5165\u6536\u5165\u6570\u636e'); return; }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) { toast('\u8bf7\u8f93\u5165\u6536\u5165\u6570\u636e'); return; }

    const validSources = ['\u5de5\u4f5c\u6536\u5165', '\u4e52\u4e53', '\u6295\u8d44', '\u5176\u4ed6'];
    const incomes = [];
    const errors = [];

    lines.forEach((line, idx) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) {
        errors.push(`\u7b2c${idx + 1}\u884c：\u683c\u5f0f\u9519\u8bef`);
        return;
      }
      const source = parts[0];
      const amount = parseFloat(parts[1]);
      const note = parts[2] || '';

      if (!source) { errors.push(`\u7b2c${idx + 1}\u884c：\u7f3a\u5c11\u6765\u6e90`); return; }
      if (isNaN(amount) || amount <= 0) { errors.push(`\u7b2c${idx + 1}\u884c：\u91d1\u989d\u65e0\u6548`); return; }

      incomes.push({
        id: genId(),
        month,
        amount,
        source: validSources.includes(source) ? source : '\u5176\u4ed6',
        note,
        date: today(),
        createdAt: new Date().toISOString(),
      });
    });

    if (incomes.length === 0) {
      toast(errors[0] || '\u65e0\u6709\u6548\u6570\u636e');
      return;
    }

    await bulkPut('incomes', incomes);
    const msg = `\u5df2\u6dfb\u52a0 ${incomes.length} \u6761\u6536\u5165` + (errors.length > 0 ? `，${errors.length}\u6761\u683c\u5f0f\u9519\u8bef\u5df2\u8df3\u8fc7` : '');
    toast(msg);
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };
}

// ============================================================
// \u8fd8\u6b3e\u5bf9\u8bdd\u6846
// ============================================================

function showRepayDialog(container, loanId) {
  const currentMonth = monthStr(new Date());
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u8fd8\u6b3e\u6708\u4efd</label>
        <input type="month" id="repay-month" value="${currentMonth}">
      </div>
      <div class="form-group">
        <label>\u8fd8\u6b3e\u91d1\u989d (\u5143)</label>
        <input type="number" step="0.01" id="repay-amount" placeholder="\u5982：5000.00">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveRepay('${loanId}')">\u786e\u8ba4\u8fd8\u6b3e</button>
    </div>
  `;

  const sheet = openBottomSheet('\u8bb0\u5f55\u8fd8\u6b3e', html);
  window.__currentSheet = sheet;

  window.__saveRepay = async (id) => {
    const amount = document.getElementById('repay-amount').value;
    if (!amount) { toast('\u8bf7\u8f93\u5165\u8fd8\u6b3e\u91d1\u989d'); return; }
    const month = document.getElementById('repay-month').value;
    await addRepayment(id, month, amount);
    toast('\u8fd8\u6b3e\u5df2\u8bb0\u5f55，\u4f59\u989d\u5df2\u66f4\u65b0');
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };
}

function formatNum(n) {
  if (n == null || isNaN(n)) n = 0;
  return Number(n).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ============================================================
// \u9996\u9875 Dashboard \u5361\u7247
// ============================================================

export async function dashboardFinance() {
  const loans = await getAll('loans');
  const incomes = await getAll('incomes');
  const currentMonth = monthStr(new Date());

  const totalDebt = loans.reduce((sum, l) => sum + (l.currentBalance || 0), 0);
  const totalMonthly = loans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  const currentYear = new Date().getFullYear();
  const yearIncome = incomes
    .filter(i => i.month && i.month.startsWith(String(currentYear)))
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  // 🔒 \u5df2\u8bbe\u5bc6\u7801\u4e14\u672a\u9a8c\u8bc1\u65f6，\u4e0d\u663e\u793a\u91d1\u989d
  const locked = hasPassword() && !isAuthed();

  return `
    <div class="dash-card" onclick="window.__navigate('finance')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">💰 \u8d44\u4ea7\u7ba1\u7406 ${locked ? '🔒' : ''}</div>
        <div class="dash-card-more">${locked ? '\u70b9\u51fb\u89e3\u9501' : '\u67e5\u770b\u8be6\u60c5 ›'}</div>
      </div>
      ${locked ? `
        <div class="dash-locked">
          <div class="dash-locked-icon">🔐</div>
          <div class="dash-locked-text">\u5df2\u52a0\u5bc6，\u70b9\u51fb\u89e3\u9501\u67e5\u770b</div>
        </div>
      ` : `
        <div class="dash-stats">
          <div class="dash-stat success">
            <div class="dash-stat-num">¥${formatNum(yearIncome)}</div>
            <div class="dash-stat-label">\u5f53\u5e74\u6536\u5165</div>
          </div>
          <div class="dash-stat danger">
            <div class="dash-stat-num">¥${formatNum(totalDebt)}</div>
            <div class="dash-stat-label">\u6b20\u6b3e\u603b\u989d</div>
          </div>
          <div class="dash-stat warning">
            <div class="dash-stat-num">¥${formatNum(totalMonthly)}</div>
            <div class="dash-stat-label">\u6708\u4f9b</div>
          </div>
        </div>
        <div class="text-xs text-gray mt-8">${loans.length}\u7b14\u8d37\u6b3e · \u6708\u4f9b ¥${formatNum(totalMonthly)}/\u6708</div>
      `}
    </div>
  `;
}
