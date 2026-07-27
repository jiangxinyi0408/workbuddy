// ============================================================
// modules/ai.js - 模块：了解AI
// 4阶段14课时的AI学习路径，面向零基础保险销售员
// ============================================================

import { put, getAll, getSetting, setSetting } from '../db.js';
import { genId, today, toast, escapeHtml } from '../utils.js';

let initialized = false;

export async function initAI() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// 学习路径（14个主题，4个阶段）
// ============================================================

const LEARNING_PATH = [
  // Phase 1: 认识AI
  {
    phase: 1,
    phaseTitle: '第一阶段：认识AI',
    phaseDesc: '了解人工智能的基本概念和它能做什么',
    topics: [
      { id: 1, title: '什么是人工智能？', content: '人工智能（AI）就是让计算机模仿人类的智能行为。它不像科幻电影里那样神秘——你每天用的手机人脸解锁、购物网站的"猜你喜欢"、导航软件的路线规划，背后都有AI在默默工作。简单说，AI就是一个"聪明的程序"，能看懂文字、听懂语音、识别图片、做决策。把它想象成一个24小时不休息的超级助手。', estimatedMinutes: 10 },
      { id: 2, title: 'AI能做什么？', content: '现在的AI已经能做很多事情了：写文章、翻译语言、回答各种问题、分析数据、生成图片、写代码、做PPT、整理会议纪要……对于保险销售来说，AI可以帮你写产品文案、对比方案优劣、分析客户需求、管理日程、学习专业知识。关键在于：AI不是来抢工作的，而是帮你把重复性工作自动化，让你有更多时间做只有人才能做的事情——比如跟客户建立信任。', estimatedMinutes: 10 },
      { id: 3, title: '大语言模型是什么？', content: '大语言模型（LLM）是目前最热门的AI技术，ChatGPT、文心一言、通义千问都是这类。你可以把它想象成一个"读了海量书籍资料的学生"——你跟它说话，它根据学过的知识来回答。它很聪明但也有局限：知识有截止日期、偶尔会"一本正经地胡说八道"、不能代替你的专业判断。把它当成一个知识面很广但需要你引导的实习生就对了。', estimatedMinutes: 10 },
      { id: 4, title: '如何与AI对话？', content: '跟AI对话就像跟人聊天，但要记住三个原则：一、说清楚你要什么（不要笼统）；二、给背景信息（你是谁、你的目的是什么）；三、不满意就让它改（"再简洁一点""换个角度"）。比如不要说"写个文案"，而要说"我是一个保险销售，请帮我写一段关于百万医疗险的朋友圈文案，语气亲切，300字以内"。写得越具体，AI的回答越符合你的需求。', estimatedMinutes: 10 },
    ],
  },
  // Phase 2: 开始使用
  {
    phase: 2,
    phaseTitle: '第二阶段：开始使用',
    phaseDesc: '注册工具，掌握提示词技巧，让AI帮你工作',
    topics: [
      { id: 5, title: '注册你的第一个AI工具', content: '国内目前最常用的AI工具有：通义千问（阿里出品，免费）、文心一言（百度出品）、豆包（字节出品）、Kimi（月之暗面出品，擅长长文本）。推荐从通义千问或豆包开始，因为它们免费、有手机App、中文体验好。注册只需要手机号，3分钟搞定。注册后试着跟它打个招呼："你好，我是一个保险销售，想学习用AI提高工作效率。"', estimatedMinutes: 10 },
      { id: 6, title: '写好提示词的5个技巧', content: '技巧一：给AI一个角色（"你是一个资深的保险顾问"）。技巧二：说清楚任务（"帮我写一段产品介绍"）。技巧三：提供背景信息（"客户是30岁女性，关注重疾保障"）。技巧四：限定格式和字数（"300字以内，分3段"）。技巧五：给出示例（"参考这个风格：……"）。记住口诀：角色+任务+背景+格式+示例。多试几次就能找到感觉。', estimatedMinutes: 15 },
      { id: 7, title: '让AI帮你写文案', content: '作为保险销售，你经常需要写朋友圈文案、产品介绍、客户沟通话术。试试这样问AI："我是一名保险销售，请帮我写5条关于重大疾病保险的朋友圈文案，要求：语气温暖不推销、每条100字以内、突出保障的重要性而非产品本身、适合30-45岁人群阅读。"AI生成的文案你可以直接用，也可以根据实际情况修改。省下的时间可以用来多联系一个客户。', estimatedMinutes: 15 },
      { id: 8, title: '让AI帮你整理资料', content: '产品条款太长看不完？客户资料太多理不清？试试把大段文字发给AI，让它帮你总结。比如："请帮我把以下保险条款中关于免责条款的部分用通俗语言总结出来，200字以内"。或者"请帮我把这些客户信息整理成一个表格，列出姓名、年龄、已购险种、下次续保日期"。AI是整理信息的高手，几秒钟能完成你半小时的工作量。', estimatedMinutes: 10 },
    ],
  },
  // Phase 3: 进阶技巧
  {
    phase: 3,
    phaseTitle: '第三阶段：进阶技巧',
    phaseDesc: '用AI深入分析业务，提升专业度',
    topics: [
      { id: 9, title: '用AI分析客户需求', content: '把客户的基本信息告诉AI，让它帮你分析保险需求。比如："我的客户：35岁男性，已婚有一子，年收入30万，有房贷200万，目前只有社保。请帮我分析他需要哪些保险，并给出优先级建议。"AI会从专业角度给出分析框架。当然最终建议要结合你对客户的了解，AI是参谋，你是决策者。', estimatedMinutes: 15 },
      { id: 10, title: '用AI制作保险方案对比', content: '客户在几个产品之间犹豫？把产品信息发给AI，让它做个对比表。比如："请对比以下三款重疾险产品的差异：产品A（保障100种重疾、保额50万、年缴8000）、产品B（保障120种重疾含轻症、保额50万、年缴9500）、产品C（保障100种重疾、保额60万、年缴8800）。用表格形式呈现，并给出购买建议。"一秒钟生成专业对比，客户会对你刮目相看。', estimatedMinutes: 15 },
      { id: 11, title: '用AI管理日程和提醒', content: '每天事情太多容易忘？让AI做你的私人秘书。你可以说："请帮我规划明天的工作安排：上午9点到11点见客户A，下午2点处理续保提醒，下午4点学习新产品资料。另外提醒我周四前要完成3个客户的回访。"AI还能帮你生成周报、整理每日工作重点、设置学习计划。把琐事交给AI，你专注做最重要的事。', estimatedMinutes: 10 },
    ],
  },
  // Phase 4: 熟练运用
  {
    phase: 4,
    phaseTitle: '第四阶段：熟练运用',
    phaseDesc: '建立个人AI工作流，持续成长',
    topics: [
      { id: 12, title: '搭建你的AI工作流', content: '把AI融入日常工作形成习惯：早上让AI规划当天任务 → 上午用AI写文案和回复 → 中午用AI学习一个新知识点 → 下午用AI分析客户 → 晚上用AI总结当天工作。关键是固定下来，让它像刷牙一样自然。建议每天至少花15分钟用AI做一件原来需要手动完成的事情，一个月后你会发现自己效率提升了一倍。', estimatedMinutes: 10 },
      { id: 13, title: 'AI + 保险业务实战', content: '实战场景：①用AI生成客户生日祝福（个性化、有温度）；②用AI帮你准备产品说明会的演讲稿；③用AI模拟客户提问，练习应答话术；④用AI解读保险行业新政策；⑤用AI整理竞品分析报告。这些场景都是真实可用的，今天就可以试试。记住一个原则：AI生成的内容是初稿，你要加入自己的理解和人情味，才是最终版。', estimatedMinutes: 15 },
      { id: 14, title: '持续学习与资源推荐', content: 'AI技术发展很快，保持学习的习惯很重要。推荐关注：①B站搜索"AI使用技巧"有很多中文教程；②微信公众号"量子位""机器之心"报道AI最新动态；③抖音上也有很多AI博主做通俗科普。每天花10分钟刷一刷，不用深入理解技术原理，知道"AI现在能做什么新事情"就够了。你不需要成为专家，但要保持对新工具的敏感度。', estimatedMinutes: 10 },
    ],
  },
];

// ============================================================
// 每日推荐视频搜索词
// ============================================================

const DAILY_VIDEOS = [
  { query: 'AI科普 什么是人工智能', title: '什么是人工智能？' },
  { query: 'ChatGPT使用教程 新手', title: 'AI工具使用教程（新手入门）' },
  { query: 'AI提示词技巧', title: '写好提示词的实用技巧' },
  { query: 'AI写作工具推荐', title: '好用的AI写作工具推荐' },
  { query: 'AI办公效率提升', title: '用AI提升办公效率' },
  { query: 'AI保险行业应用', title: 'AI在保险行业的应用' },
  { query: 'AI学习路径规划', title: 'AI初学者学习路径' },
];

function getTodayVideos() {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const idx1 = day % DAILY_VIDEOS.length;
  const idx2 = (day + 3) % DAILY_VIDEOS.length;
  return [DAILY_VIDEOS[idx1], DAILY_VIDEOS[idx2]];
}

function getSearchUrl(query) {
  return `https://www.bilibili.com/search?keyword=${encodeURIComponent(query)}`;
}

// ============================================================
// 数据操作
// ============================================================

async function getTodayProgress() {
  const all = await getAll('aiProgress');
  const t = today();
  return all.find(r => r.date === t) || { id: genId(), date: t, minutesLearned: 0, topicsCompleted: [], notes: '' };
}

async function saveProgress(progress) {
  return put('aiProgress', progress);
}

async function getStreakDays() {
  const all = await getAll('aiProgress');
  // Sort by date descending
  const sorted = all.filter(r => r.minutesLearned > 0).sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) return 0;

  let streak = 0;
  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  for (const record of sorted) {
    const recordDate = new Date(record.date);
    recordDate.setHours(0, 0, 0, 0);

    const expected = new Date(checkDate);
    expected.setDate(expected.getDate() - streak);

    const recordTime = recordDate.getTime();
    const expectedTime = expected.getTime();

    if (recordTime === expectedTime) {
      streak++;
    } else if (recordTime < expectedTime) {
      break;
    }
    // If record is in the future (shouldn't happen), skip
  }

  return streak;
}

async function getCompletedTopicIds() {
  const progress = await getTodayProgress();
  return new Set(progress.topicsCompleted || []);
}

async function completeTopic(topicId) {
  const progress = await getTodayProgress();
  if (!progress.topicsCompleted) progress.topicsCompleted = [];
  if (progress.topicsCompleted.includes(topicId)) return; // already completed

  progress.topicsCompleted.push(topicId);
  progress.minutesLearned += 15;
  await saveProgress(progress);
}

async function addStudyTime(minutes) {
  const progress = await getTodayProgress();
  progress.minutesLearned += minutes;
  await saveProgress(progress);
}

async function addNote(title, content) {
  const note = {
    id: genId(),
    title,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await put('aiNotes', note);
  return note;
}

async function getNotes() {
  const notes = await getAll('aiNotes');
  return notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function deleteNote(noteId) {
  const { del } = await import('../db.js');
  await del('aiNotes', noteId);
}

// ============================================================
// 渲染：主入口
// ============================================================

export async function renderAI(container) {
  const tabState = container.getAttribute('data-ai-tab') || 'path';

  container.innerHTML = `
    <div class="ai-module">
      <div class="ai-tabs" style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto">
        <button class="ai-tab ${tabState === 'path' ? 'active' : ''}" data-tab="path" style="flex:1;padding:10px 8px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;background:${tabState === 'path' ? 'var(--primary)' : 'var(--gray-100)'};color:${tabState === 'path' ? '#fff' : 'var(--gray-600)'};white-space:nowrap">📖 学习路径</button>
        <button class="ai-tab ${tabState === 'video' ? 'active' : ''}" data-tab="video" style="flex:1;padding:10px 8px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;background:${tabState === 'video' ? 'var(--primary)' : 'var(--gray-100)'};color:${tabState === 'video' ? '#fff' : 'var(--gray-600)'};white-space:nowrap">🎬 今日推荐</button>
        <button class="ai-tab ${tabState === 'notes' ? 'active' : ''}" data-tab="notes" style="flex:1;padding:10px 8px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;background:${tabState === 'notes' ? 'var(--primary)' : 'var(--gray-100)'};color:${tabState === 'notes' ? '#fff' : 'var(--gray-600)'};white-space:nowrap">📝 学习笔记</button>
      </div>
      <div class="ai-tab-content" id="ai-tab-content"></div>
    </div>
  `;

  // Tab click handlers
  container.querySelectorAll('.ai-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.setAttribute('data-ai-tab', btn.dataset.tab);
      renderAI(container);
    });
  });

  const tabContent = container.querySelector('#ai-tab-content');

  if (tabState === 'path') {
    await renderPathTab(tabContent);
  } else if (tabState === 'video') {
    await renderVideoTab(tabContent);
  } else if (tabState === 'notes') {
    await renderNotesTab(tabContent);
  }
}

// ============================================================
// Tab 1: 学习路径
// ============================================================

async function renderPathTab(container) {
  const completedIds = await getCompletedTopicIds();
  const progress = await getTodayProgress();
  const streak = await getStreakDays();
  const totalTopics = 14;
  const completedCount = completedIds.size;
  const progressPct = Math.round((completedCount / totalTopics) * 100);

  // Progress overview card
  let html = `
    <div class="card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:#fff;border-radius:12px;padding:20px;margin-bottom:16px">
      <div class="flex-between" style="margin-bottom:12px">
        <div>
          <div style="font-size:13px;opacity:0.85">学习进度</div>
          <div style="font-size:28px;font-weight:700;margin-top:4px">${progressPct}%</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;opacity:0.85">已完成</div>
          <div style="font-size:28px;font-weight:700;margin-top:4px">${completedCount}/${totalTopics}</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.2);border-radius:6px;height:8px;overflow:hidden">
        <div style="background:#fff;height:100%;border-radius:6px;width:${progressPct}%;transition:width 0.3s"></div>
      </div>
      <div class="flex-between" style="margin-top:12px">
        <div style="font-size:12px;opacity:0.85">🔥 连续打卡 ${streak} 天</div>
        <div style="font-size:12px;opacity:0.85">⏱ 今日学习 ${progress.minutesLearned} 分钟</div>
      </div>
    </div>
  `;

  // Phase sections
  for (const phase of LEARNING_PATH) {
    const phaseId = `phase-${phase.phase}`;
    const phaseCompleted = phase.topics.filter(t => completedIds.has(t.id)).length;
    const phaseTotal = phase.topics.length;
    const isExpanded = container.getAttribute(`data-phase-${phase.phase}`) !== 'collapsed';

    html += `
      <div class="card" style="margin-bottom:12px">
        <div class="card-title" style="cursor:pointer" data-phase-header="${phase.phase}">
          <span class="title-left">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:var(--primary);color:#fff;font-size:12px;font-weight:700;margin-right:6px">${phase.phase}</span>
            ${escapeHtml(phase.phaseTitle)}
          </span>
          <span style="font-size:12px;color:var(--gray-400)">${phaseCompleted}/${phaseTotal} · ${isExpanded ? '收起 ▲' : '展开 ▼'}</span>
        </div>
        <div class="phase-topics" id="${phaseId}" style="display:${isExpanded ? 'block' : 'none'}">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px">${escapeHtml(phase.phaseDesc)}</div>
          ${phase.topics.map(topic => {
            const done = completedIds.has(topic.id);
            return `
              <div class="topic-item flex-between" style="padding:12px;margin-bottom:8px;border-radius:8px;background:${done ? 'var(--primary-bg)' : 'var(--gray-50)'};border:1px solid ${done ? 'var(--primary)' : 'var(--gray-100)'};cursor:pointer" onclick="window.__toggleTopicDetail(${topic.id})">
                <div style="flex:1;min-width:0">
                  <div style="font-size:14px;font-weight:600;color:var(--gray-700)">
                    ${done ? '✅ ' : '○ '}${escapeHtml(topic.title)}
                    <span style="font-size:11px;color:var(--gray-400);font-weight:400">· ${topic.estimatedMinutes}分钟</span>
                  </div>
                  <div class="topic-detail" id="topic-detail-${topic.id}" style="display:none;font-size:13px;color:var(--gray-600);line-height:1.7;margin-top:8px;padding:10px;background:#fff;border-radius:6px">
                    ${escapeHtml(topic.content)}
                    <div style="margin-top:10px">
                      ${done ? 
                        '<button class="btn-primary btn-sm" disabled style="opacity:0.5">✅ 已完成</button>' : 
                        `<button class="btn-primary btn-sm" onclick="event.stopPropagation();window.__completeTopic(${topic.id})">✓ 标记完成</button>`
                      }
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Phase collapse/expand
  container.querySelectorAll('[data-phase-header]').forEach(header => {
    header.addEventListener('click', () => {
      const phase = header.dataset.phaseHeader;
      const current = container.getAttribute(`data-phase-${phase}`);
      container.setAttribute(`data-phase-${phase}`, current === 'collapsed' ? 'expanded' : 'collapsed');
      renderPathTab(container);
    });
  });

  // Global handlers
  window.__toggleTopicDetail = (topicId) => {
    const detail = document.getElementById(`topic-detail-${topicId}`);
    if (detail) {
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    }
  };

  window.__completeTopic = async (topicId) => {
    await completeTopic(topicId);
    toast('✅ 主题完成！学习时间 +15分钟');
    renderPathTab(container);
  };
}

// ============================================================
// Tab 2: 今日推荐
// ============================================================

async function renderVideoTab(container) {
  const progress = await getTodayProgress();
  const videos = getTodayVideos();

  container.innerHTML = `
    <div class="card" style="margin-bottom:12px;text-align:center;padding:24px">
      <div style="font-size:32px;margin-bottom:8px">⏱️</div>
      <div style="font-size:20px;font-weight:700;color:var(--gray-700)">
        今日学习：${progress.minutesLearned} 分钟 / 15 分钟
      </div>
      <div style="background:var(--gray-100);border-radius:6px;height:6px;overflow:hidden;margin-top:12px">
        <div style="background:var(--primary);height:100%;border-radius:6px;width:${Math.min(progress.minutesLearned / 15 * 100, 100)}%"></div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--gray-500)">
        ${progress.minutesLearned >= 15 ? '🎉 今日目标达成！' : `还差 ${15 - progress.minutesLearned} 分钟完成今日目标`}
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title"><span class="title-left">🎬 今日推荐视频</span></div>
      <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px">每天推荐2个AI学习视频，点击跳转到B站搜索</div>
      ${videos.map(v => `
        <div class="video-card" style="padding:14px;margin-bottom:10px;border-radius:8px;background:var(--gray-50);border:1px solid var(--gray-100);cursor:pointer" onclick="window.open('${escapeHtml(getSearchUrl(v.query))}', '_blank')">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">🎥</span>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600;color:var(--gray-700)">${escapeHtml(v.title)}</div>
              <div style="font-size:11px;color:var(--gray-400);margin-top:4px">搜索：${escapeHtml(v.query)} →</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">✏️ 快速笔记</span></div>
      <div style="font-size:12px;color:var(--gray-500);margin-bottom:8px">记录你今天学到的内容</div>
      <input id="quick-note-title" type="text" placeholder="笔记标题（选填）" style="width:100%;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box">
      <textarea id="quick-note-content" placeholder="今天学到了什么？……" style="width:100%;height:80px;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;font-family:inherit"></textarea>
      <button class="btn-primary btn-full mt-8" onclick="window.__saveQuickNote()">💾 保存笔记</button>
    </div>
  `;

  window.__saveQuickNote = async () => {
    const titleEl = document.getElementById('quick-note-title');
    const contentEl = document.getElementById('quick-note-content');
    const title = titleEl.value.trim() || '无标题笔记';
    const content = contentEl.value.trim();
    if (!content) {
      toast('请输入笔记内容');
      return;
    }
    await addNote(title, content);
    toast('笔记已保存');
    titleEl.value = '';
    contentEl.value = '';
  };
}

// ============================================================
// Tab 3: 学习笔记
// ============================================================

async function renderNotesTab(container) {
  const notes = await getNotes();

  container.innerHTML = `
    <div style="margin-bottom:12px">
      <button class="btn-primary btn-full" onclick="window.__showAddNote()">＋ 新建笔记</button>
    </div>

    ${notes.length === 0 ? `
      <div class="card" style="text-align:center;padding:32px">
        <div style="font-size:40px;margin-bottom:8px">📝</div>
        <div style="font-size:14px;color:var(--gray-500)">还没有学习笔记</div>
        <div style="font-size:12px;color:var(--gray-400);margin-top:4px">点击上方按钮创建第一条笔记</div>
      </div>
    ` : notes.map(note => `
      <div class="card" style="margin-bottom:10px">
        <div class="flex-between">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="window.__viewNote('${note.id}')">
            <div style="font-size:14px;font-weight:600;color:var(--gray-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(note.title)}</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(note.content)}</div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:4px">${escapeHtml(new Date(note.updatedAt).toLocaleString('zh-CN'))}</div>
          </div>
          <button class="btn-sm" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;margin-left:8px;flex-shrink:0" onclick="event.stopPropagation();window.__deleteNote('${note.id}')">删除</button>
        </div>
      </div>
    `).join('')}
  `;

  window.__viewNote = (noteId) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:20px;max-width:500px;width:90%;max-height:70vh;overflow-y:auto">
        <h3 style="margin:0 0 12px">${escapeHtml(note.title)}</h3>
        <div style="font-size:12px;color:var(--gray-400);margin-bottom:12px">${escapeHtml(new Date(note.updatedAt).toLocaleString('zh-CN'))}</div>
        <div style="font-size:14px;color:var(--gray-700);line-height:1.8;white-space:pre-wrap">${escapeHtml(note.content)}</div>
        <button class="btn-primary btn-full mt-16" onclick="this.closest('div').parentElement.remove()">关闭</button>
      </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  };

  window.__deleteNote = async (noteId) => {
    if (!confirm('确定删除这条笔记吗？')) return;
    await deleteNote(noteId);
    toast('笔记已删除');
    renderNotesTab(container);
  };

  window.__showAddNote = () => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:20px;max-width:500px;width:90%">
        <h3 style="margin:0 0 12px">新建笔记</h3>
        <input id="add-note-title" type="text" placeholder="笔记标题" style="width:100%;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px;margin-bottom:8px;box-sizing:border-box">
        <textarea id="add-note-content" placeholder="笔记内容……" style="width:100%;height:120px;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;font-family:inherit"></textarea>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--gray-100);color:var(--gray-600);font-size:14px;cursor:pointer" onclick="this.closest('div').parentElement.remove()">取消</button>
          <button style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--primary);color:#fff;font-size:14px;cursor:pointer" id="confirm-add-note">保存</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    const titleInput = modal.querySelector('#add-note-title');
    const contentInput = modal.querySelector('#add-note-content');
    titleInput.focus();

    modal.querySelector('#confirm-add-note').addEventListener('click', async () => {
      const title = titleInput.value.trim() || '无标题笔记';
      const content = contentInput.value.trim();
      if (!content) {
        toast('请输入笔记内容');
        return;
      }
      await addNote(title, content);
      modal.remove();
      toast('笔记已保存');
      renderNotesTab(container);
    });
  };
}

// ============================================================
// Dashboard 卡片
// ============================================================

export async function dashboardAI() {
  const progress = await getTodayProgress();
  const streak = await getStreakDays();
  const completedIds = await getCompletedTopicIds();
  const completedCount = completedIds.size;

  return `
    <div class="dash-card" onclick="window.__navigate('ai')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">🤖 了解AI</div>
        <div class="dash-card-more">${completedCount}/14 ›</div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)">
        <div class="text-sm" style="line-height:1.8">
          今日学习：${progress.minutesLearned}分钟 | 连续打卡：${streak}天 | 进度：${completedCount}/14
        </div>
      </div>
    </div>
  `;
}
