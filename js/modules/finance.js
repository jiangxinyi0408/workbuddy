// ============================================================
// modules/finance.js - 模块6：存款还款
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
// 数据操作
// ============================================================

async function addLoan(data) {
  const loan = {
    id: genId(),
    bank: data.bank,
    principal: parseFloat(data.principal) || 0,
    currentBalance: parseFloat(data.currentBalance) || parseFloat(data.principal) || 0,
    monthlyPayment: parseFloat(data.monthlyPayment) || 0,
    paymentType: data.paymentType || 'fixed', // 'fixed'=每月固定还款, 'variable'=每月不固定还款
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
    source: data.source || '工作收入',
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

  // 更新贷款余额
  const loans = await getAll('loans');
  const loan = loans.find(l => l.id === loanId);
  if (loan) {
    loan.currentBalance = Math.max(0, loan.currentBalance - repayment.amount);
    await put('loans', loan);
  }
  return repayment;
}

// ============================================================
// 渲染：存款还款主页面
// ============================================================

let currentTab = 'overview';

export async function renderFinance(container) {
  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentTab==='overview'?'active':''}" onclick="window.__finTab('overview')">总览</button>
      <button class="filter-tab ${currentTab==='loans'?'active':''}" onclick="window.__finTab('loans')">贷款</button>
      <button class="filter-tab ${currentTab==='income'?'active':''}" onclick="window.__finTab('income')">收入</button>
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
    if (await confirmDialog('删除这笔贷款记录？')) {
      await del('loans', id);
      renderFinance(container);
    }
  };
  window.__editLoan = (id) => showEditLoanDialog(container, id);
  window.__delIncome = async (id) => {
    if (await confirmDialog('删除这条收入记录？')) {
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
// 总览
// ============================================================

async function renderOverview(container) {
  const loans = await getAll('loans');
  const incomes = await getAll('incomes');
  const currentYear = new Date().getFullYear();

  const totalDebt = loans.reduce((sum, l) => sum + (l.currentBalance || 0), 0);
  const totalMonthlyPayment = loans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  const yearIncomes = incomes.filter(i => i.month && i.month.startsWith(String(currentYear)));
  const yearIncome = yearIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);

  // 按银行分组
  const bankGroups = {};
  loans.forEach(l => {
    if (!bankGroups[l.bank]) bankGroups[l.bank] = [];
    bankGroups[l.bank].push(l);
  });

  container.innerHTML = `
    <div class="finance-overview">
      <div class="finance-card income">
        <div class="finance-card-label">当年总收入</div>
        <div class="finance-card-value">¥${formatNum(yearIncome)}</div>
      </div>
      <div class="finance-card debt">
        <div class="finance-card-label">欠款总额</div>
        <div class="finance-card-value">¥${formatNum(totalDebt)}</div>
      </div>
      <div class="finance-card">
        <div class="finance-card-label">月供总额</div>
        <div class="finance-card-value" style="color:var(--warning)">¥${formatNum(totalMonthlyPayment)}</div>
      </div>
    </div>

    ${loans.length > 0 ? `
    <div class="card">
      <div class="card-title"><span class="title-left">🏦 各银行欠款分布</span></div>
      <div class="chart-container"><canvas id="finance-chart"></canvas></div>
    </div>` : ''}

    <div class="card">
      <div class="card-title"><span class="title-left">📋 贷款概览</span></div>
      ${loans.length > 0 ? loans.map(l => {
        const progress = l.principal > 0 ? Math.round((1 - l.currentBalance / l.principal) * 100) : 0;
        const paymentLabel = l.paymentType === 'variable' ? '不固定' : `¥${formatNum(l.monthlyPayment)}`;
        return `
        <div style="padding:12px 0;border-bottom:1px solid var(--gray-100)">
          <div class="flex-between">
            <div>
              <span class="font-bold">${escapeHtml(l.bank)}</span>
              ${l.remainingPeriods ? `<span class="text-xs text-gray ml-8">剩${l.remainingPeriods}期</span>` : ''}
            </div>
            <div class="font-bold text-danger">¥${formatNum(l.currentBalance)}</div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="flex-between text-xs text-gray mt-8">
            <span>已还 ${progress}% · 月供 ${paymentLabel}</span>
            <span>${l.endDate ? '到期 ' + fmtDate(l.endDate).slice(0,7) : ''}</span>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">暂无贷款记录</div></div>'}
    </div>
  `;

  // 绘制银行分布图
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
// 贷款列表
// ============================================================

async function renderLoans(container) {
  const loans = await getAll('loans');
  const bankGroups = {};
  loans.forEach(l => {
    if (!bankGroups[l.bank]) bankGroups[l.bank] = [];
    bankGroups[l.bank].push(l);
  });

  if (loans.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-text">暂无贷款记录<br>点击 + 添加贷款</div></div>';
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
        const paymentLabel = l.paymentType === 'variable' ? '每月不固定' : `¥${formatNum(l.monthlyPayment)}`;
        return `
        <div style="padding:12px 0;border-bottom:1px solid var(--gray-100)">
          <div class="flex-between mb-8">
            <div>
              <div class="font-bold text-sm">${escapeHtml(l.bank)}</div>
              <div class="text-xs text-gray">利率 ${l.interestRate}%${l.remainingPeriods ? ' · 剩' + l.remainingPeriods + '期' : ''}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="task-edit" onclick="window.__editLoan('${l.id}')">✎</button>
              <button class="task-delete" onclick="window.__delLoan('${l.id}')">✕</button>
            </div>
          </div>
          <div class="flex-between text-sm mb-8">
            <span>剩余：¥${formatNum(l.currentBalance)}</span>
            <span class="text-warning">月供：${paymentLabel}</span>
          </div>
          ${l.estimatedMonthlyPayment ? `<div class="text-xs text-gray mb-8">预估月还：¥${formatNum(l.estimatedMonthlyPayment)}</div>` : ''}
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="flex-between text-xs text-gray mt-8">
            <span>本金 ¥${formatNum(l.principal)}</span>
            <span>已还 ${progress}%</span>
          </div>
          ${l.note ? `<div class="text-xs text-gray mt-8">📝 ${escapeHtml(l.note)}</div>` : ''}
          <button class="btn-outline btn-full mt-8" onclick="window.__repayLoan('${l.id}')">记录还款</button>
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

// ============================================================
// 收入列表
// ============================================================

async function renderIncome(container) {
  const incomes = await getAll('incomes');
  incomes.sort((a, b) => b.month.localeCompare(a.month));

  if (incomes.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">💵</div><div class="empty-text">暂无收入记录<br>点击 + 添加收入</div></div>';
    return;
  }

  // 按月分组
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
// 添加贷款对话框
// ============================================================

function showAddLoanDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>银行名称</label>
        <input type="text" id="loan-bank" placeholder="如：工商银行、招商银行">
      </div>
      <div class="form-group">
        <label>贷款本金 (元)</label>
        <input type="number" step="0.01" id="loan-principal" placeholder="如：500000.00">
      </div>
      <div class="form-group">
        <label>当前剩余欠款 (元)</label>
        <input type="number" step="0.01" id="loan-balance" placeholder="留空则等于本金">
      </div>
      <div class="form-group">
        <label>还款方式</label>
        <select id="loan-payment-type">
          <option value="fixed">每月固定还款</option>
          <option value="variable">每月不固定还款</option>
        </select>
      </div>
      <div class="form-group" id="loan-monthly-group">
        <label>每月固定还款金额 (元)</label>
        <input type="number" step="0.01" id="loan-monthly" placeholder="如：5000.00">
      </div>
      <div class="form-group">
        <label>每月预估还款金额 (元)</label>
        <input type="number" step="0.01" id="loan-estimated" placeholder="如：4500.00">
      </div>
      <div class="form-group">
        <label>剩余期数 (月)</label>
        <input type="number" id="loan-periods" placeholder="如：36">
      </div>
      <div class="form-group">
        <label>年利率 (%)</label>
        <input type="number" id="loan-rate" step="0.01" placeholder="如：4.9">
      </div>
      <div class="form-group">
        <label>到期日期（可选）</label>
        <input type="date" id="loan-enddate">
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="loan-note" placeholder="如：等额本息、提前还款等">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveLoan()">保存</button>
    </div>
  `;

  const sheet = openBottomSheet('添加贷款', html);
  window.__currentSheet = sheet;

  // 还款方式切换
  document.getElementById('loan-payment-type').onchange = (e) => {
    const monthlyGroup = document.getElementById('loan-monthly-group');
    monthlyGroup.style.display = e.target.value === 'fixed' ? 'block' : 'none';
  };

  window.__saveLoan = async () => {
    const bank = document.getElementById('loan-bank').value.trim();
    if (!bank) { toast('请输入银行名称'); return; }
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
    toast('贷款已添加');
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };
}

// ============================================================
// 编辑贷款对话框
// ============================================================

async function showEditLoanDialog(container, id) {
  const all = await getAll('loans');
  const loan = all.find(l => l.id === id);
  if (!loan) { toast('记录不存在'); return; }

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>银行名称</label>
        <input type="text" id="loan-bank" value="${escapeHtml(loan.bank)}">
      </div>
      <div class="form-group">
        <label>贷款本金 (元)</label>
        <input type="number" step="0.01" id="loan-principal" value="${loan.principal}">
      </div>
      <div class="form-group">
        <label>当前剩余欠款 (元)</label>
        <input type="number" step="0.01" id="loan-balance" value="${loan.currentBalance}">
      </div>
      <div class="form-group">
        <label>还款方式</label>
        <select id="loan-payment-type">
          <option value="fixed" ${loan.paymentType === 'fixed' || !loan.paymentType ? 'selected' : ''}>每月固定还款</option>
          <option value="variable" ${loan.paymentType === 'variable' ? 'selected' : ''}>每月不固定还款</option>
        </select>
      </div>
      <div class="form-group" id="loan-monthly-group" style="display:${loan.paymentType === 'variable' ? 'none' : 'block'}">
        <label>每月固定还款金额 (元)</label>
        <input type="number" step="0.01" id="loan-monthly" value="${loan.monthlyPayment || ''}">
      </div>
      <div class="form-group">
        <label>每月预估还款金额 (元)</label>
        <input type="number" step="0.01" id="loan-estimated" value="${loan.estimatedMonthlyPayment || ''}">
      </div>
      <div class="form-group">
        <label>剩余期数 (月)</label>
        <input type="number" id="loan-periods" value="${loan.remainingPeriods || ''}">
      </div>
      <div class="form-group">
        <label>年利率 (%)</label>
        <input type="number" id="loan-rate" step="0.01" value="${loan.interestRate}">
      </div>
      <div class="form-group">
        <label>到期日期（可选）</label>
        <input type="date" id="loan-enddate" value="${loan.endDate || ''}">
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input type="text" id="loan-note" value="${escapeHtml(loan.note || '')}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateLoan()">保存修改</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delLoanFromEdit('${id}')">删除此贷款</button>
    </div>
  `;

  const sheet = openBottomSheet('编辑贷款', html);

  document.getElementById('loan-payment-type').onchange = (e) => {
    document.getElementById('loan-monthly-group').style.display = e.target.value === 'fixed' ? 'block' : 'none';
  };

  window.__updateLoan = async () => {
    const bank = document.getElementById('loan-bank').value.trim();
    if (!bank) { toast('请输入银行名称'); return; }
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
    toast('已修改');
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };

  window.__delLoanFromEdit = async (delId) => {
    if (await confirmDialog('删除这笔贷款记录？')) {
      await del('loans', delId);
      toast('已删除');
      sheet.close();
      renderFinance(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// 添加收入对话框
// ============================================================

async function showAddIncomeDialog(container, editId) {
  const isEdit = !!editId;
  const currentMonth = monthStr(new Date());

  // 编辑模式：预填已有数据
  let existing = null;
  if (isEdit) {
    const all = await getAll('incomes');
    existing = all.find(i => i.id === editId);
    if (!existing) { toast('记录不存在'); return; }
  }

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>月份</label>
        <input type="month" id="income-month" value="${existing ? existing.month : currentMonth}">
      </div>
      <div class="form-group">
        <label>收入来源</label>
        <select id="income-source">
          <option value="工作收入" ${existing && existing.source === '工作收入' ? 'selected' : ''}>💼 工作收入</option>
          <option value="乒乓" ${existing && existing.source === '乒乓' ? 'selected' : ''}>🏓 乒乓</option>
          <option value="投资" ${existing && existing.source === '投资' ? 'selected' : ''}>📈 投资</option>
          <option value="其他" ${existing && existing.source === '其他' ? 'selected' : ''}>📌 其他</option>
        </select>
      </div>
      <div class="form-group">
        <label>金额 (元)</label>
        <input type="number" step="0.01" id="income-amount" placeholder="如：8000.00" value="${existing ? existing.amount : ''}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="income-note" placeholder="如：5月工资+提成" value="${existing ? escapeHtml(existing.note || '') : ''}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveIncome()">${isEdit ? '保存修改' : '保存'}</button>
      ${isEdit ? `<button class="btn-danger-outline btn-full mt-8" onclick="window.__deleteIncomeFromEdit('${editId}')">删除此条记录</button>` : ''}
    </div>
  `;

  const sheet = openBottomSheet(isEdit ? '编辑收入' : '添加收入', html);
  window.__currentSheet = sheet;

  window.__saveIncome = async () => {
    const amount = document.getElementById('income-amount').value;
    if (!amount) { toast('请输入金额'); return; }
    const payload = {
      month: document.getElementById('income-month').value,
      source: document.getElementById('income-source').value,
      amount,
      note: document.getElementById('income-note').value.trim(),
    };
    if (isEdit) {
      await updateIncome(editId, payload);
      toast('已修改');
    } else {
      await addIncome(payload);
      toast('收入已记录');
    }
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };

  // 编辑模式下的删除按钮（独立函数，不覆盖列表的 __delIncome）
  if (isEdit) {
    window.__deleteIncomeFromEdit = async (id) => {
      if (await confirmDialog('删除这条收入记录？')) {
        await del('incomes', id);
        toast('已删除');
        sheet.close();
        renderFinance(document.getElementById('main-content'));
      }
    };
  }
}

// ============================================================
// 批量添加收入对话框
// ============================================================

function showBatchAddIncomeDialog(container) {
  const currentMonth = monthStr(new Date());
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>统一月份</label>
        <input type="month" id="batch-income-month" value="${currentMonth}">
      </div>
      <div class="form-group">
        <label>批量收入（每行一条）</label>
        <textarea id="batch-income-text" placeholder="格式：来源,金额,备注（备注可省略）&#10;每行一条，例如：&#10;工作收入,8000,7月工资&#10;乒乓,500&#10;投资,1500,基金分红" rows="8" style="font-size:14px;line-height:1.6"></textarea>
        <div class="form-hint">每行格式：来源,金额,备注（逗号分隔，备注可省略）</div>
      </div>
      <div class="form-group">
        <label>可用来源</label>
        <div class="form-hint">工作收入 / 乒乓 / 投资 / 其他</div>
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveBatchIncome()">批量添加</button>
    </div>
  `;

  const sheet = openBottomSheet('批量添加收入', html);
  window.__currentSheet = sheet;

  window.__saveBatchIncome = async () => {
    const month = document.getElementById('batch-income-month').value || currentMonth;
    const text = document.getElementById('batch-income-text').value.trim();
    if (!text) { toast('请输入收入数据'); return; }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) { toast('请输入收入数据'); return; }

    const validSources = ['工作收入', '乒乓', '投资', '其他'];
    const incomes = [];
    const errors = [];

    lines.forEach((line, idx) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) {
        errors.push(`第${idx + 1}行：格式错误`);
        return;
      }
      const source = parts[0];
      const amount = parseFloat(parts[1]);
      const note = parts[2] || '';

      if (!source) { errors.push(`第${idx + 1}行：缺少来源`); return; }
      if (isNaN(amount) || amount <= 0) { errors.push(`第${idx + 1}行：金额无效`); return; }

      incomes.push({
        id: genId(),
        month,
        amount,
        source: validSources.includes(source) ? source : '其他',
        note,
        date: today(),
        createdAt: new Date().toISOString(),
      });
    });

    if (incomes.length === 0) {
      toast(errors[0] || '无有效数据');
      return;
    }

    await bulkPut('incomes', incomes);
    const msg = `已添加 ${incomes.length} 条收入` + (errors.length > 0 ? `，${errors.length}条格式错误已跳过` : '');
    toast(msg);
    sheet.close();
    renderFinance(document.getElementById('main-content'));
  };
}

// ============================================================
// 还款对话框
// ============================================================

function showRepayDialog(container, loanId) {
  const currentMonth = monthStr(new Date());
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>还款月份</label>
        <input type="month" id="repay-month" value="${currentMonth}">
      </div>
      <div class="form-group">
        <label>还款金额 (元)</label>
        <input type="number" step="0.01" id="repay-amount" placeholder="如：5000.00">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveRepay('${loanId}')">确认还款</button>
    </div>
  `;

  const sheet = openBottomSheet('记录还款', html);
  window.__currentSheet = sheet;

  window.__saveRepay = async (id) => {
    const amount = document.getElementById('repay-amount').value;
    if (!amount) { toast('请输入还款金额'); return; }
    const month = document.getElementById('repay-month').value;
    await addRepayment(id, month, amount);
    toast('还款已记录，余额已更新');
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
// 首页 Dashboard 卡片
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

  // 🔒 已设密码且未验证时，不显示金额
  const locked = hasPassword() && !isAuthed();

  return `
    <div class="dash-card" onclick="window.__navigate('finance')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">💰 资产管理 ${locked ? '🔒' : ''}</div>
        <div class="dash-card-more">${locked ? '点击解锁' : '查看详情 ›'}</div>
      </div>
      ${locked ? `
        <div class="dash-locked">
          <div class="dash-locked-icon">🔐</div>
          <div class="dash-locked-text">已加密，点击解锁查看</div>
        </div>
      ` : `
        <div class="dash-stats">
          <div class="dash-stat success">
            <div class="dash-stat-num">¥${formatNum(yearIncome)}</div>
            <div class="dash-stat-label">当年收入</div>
          </div>
          <div class="dash-stat danger">
            <div class="dash-stat-num">¥${formatNum(totalDebt)}</div>
            <div class="dash-stat-label">欠款总额</div>
          </div>
          <div class="dash-stat warning">
            <div class="dash-stat-num">¥${formatNum(totalMonthly)}</div>
            <div class="dash-stat-label">月供</div>
          </div>
        </div>
        <div class="text-xs text-gray mt-8">${loans.length}笔贷款 · 月供 ¥${formatNum(totalMonthly)}/月</div>
      `}
    </div>
  `;
}
