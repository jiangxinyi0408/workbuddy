// ============================================================
// modules/ai.js - \u6a21\u5757：\u4e86\u89e3AI
// 4\u9636\u6bb514\u8bfe\u65f6\u7684AI\u5b66\u4e60\u8def\u5f84，\u9762\u5411\u96f6\u57fa\u7840\u4fdd\u9669\u9500\u552e\u5458
// ============================================================

import { put, getAll, getSetting, setSetting } from '../db.js';
import { genId, today, toast, escapeHtml } from '../utils.js';

let initialized = false;

export async function initAI() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// \u5b66\u4e60\u8def\u5f84（14\u4e2a\u4e3b\u9898，4\u4e2a\u9636\u6bb5）
// ============================================================

const LEARNING_PATH = [
  // Phase 1: \u8ba4\u8bc6AI
  {
    phase: 1,
    phaseTitle: '\u7b2c\u4e00\u9636\u6bb5：\u8ba4\u8bc6AI',
    phaseDesc: '\u4e86\u89e3\u4eba\u5de5\u667a\u80fd\u7684\u57fa\u672c\u6982\u5ff5\u548c\u5b83\u80fd\u505a\u4ec0\u4e48',
    topics: [
      { id: 1, title: '\u4ec0\u4e48\u662f\u4eba\u5de5\u667a\u80fd？', content: '\u4eba\u5de5\u667a\u80fd（AI）\u5c31\u662f\u8ba9\u8ba1\u7b97\u673a\u6a21\u4eff\u4eba\u7c7b\u7684\u667a\u80fd\u884c\u4e3a。\u5b83\u4e0d\u50cf\u79d1\u5e7b\u7535\u5f71\u91cc\u90a3\u6837\u795e\u79d8——\u4f60\u6bcf\u5929\u7528\u7684\u624b\u673a\u4eba\u8138\u89e3\u9501、\u8d2d\u7269\u7f51\u7ad9\u7684"\u731c\u4f60\u559c\u6b22"、\u5bfc\u822a\u8f6f\u4ef6\u7684\u8def\u7ebf\u89c4\u5212，\u80cc\u540e\u90fd\u6709AI\u5728\u9ed8\u9ed8\u5de5\u4f5c。\u7b80\u5355\u8bf4，AI\u5c31\u662f\u4e00\u4e2a"\u806a\u660e\u7684\u7a0b\u5e8f"，\u80fd\u770b\u61c2\u6587\u5b57、\u542c\u61c2\u8bed\u97f3、\u8bc6\u522b\u56fe\u7247、\u505a\u51b3\u7b56。\u628a\u5b83\u60f3\u8c61\u6210\u4e00\u4e2a24\u5c0f\u65f6\u4e0d\u4f11\u606f\u7684\u8d85\u7ea7\u52a9\u624b。', estimatedMinutes: 10 },
      { id: 2, title: 'AI\u80fd\u505a\u4ec0\u4e48？', content: '\u73b0\u5728\u7684AI\u5df2\u7ecf\u80fd\u505a\u5f88\u591a\u4e8b\u60c5\u4e86：\u5199\u6587\u7ae0、\u7ffb\u8bd1\u8bed\u8a00、\u56de\u7b54\u5404\u79cd\u95ee\u9898、\u5206\u6790\u6570\u636e、\u751f\u6210\u56fe\u7247、\u5199\u4ee3\u7801、\u505aPPT、\u6574\u7406\u4f1a\u8bae\u7eaa\u8981……\u5bf9\u4e8e\u4fdd\u9669\u9500\u552e\u6765\u8bf4，AI\u53ef\u4ee5\u5e2e\u4f60\u5199\u4ea7\u54c1\u6587\u6848、\u5bf9\u6bd4\u65b9\u6848\u4f18\u52a3、\u5206\u6790\u5ba2\u6237\u9700\u6c42、\u7ba1\u7406\u65e5\u7a0b、\u5b66\u4e60\u4e13\u4e1a\u77e5\u8bc6。\u5173\u952e\u5728\u4e8e：AI\u4e0d\u662f\u6765\u62a2\u5de5\u4f5c\u7684，\u800c\u662f\u5e2e\u4f60\u628a\u91cd\u590d\u6027\u5de5\u4f5c\u81ea\u52a8\u5316，\u8ba9\u4f60\u6709\u66f4\u591a\u65f6\u95f4\u505a\u53ea\u6709\u4eba\u624d\u80fd\u505a\u7684\u4e8b\u60c5——\u6bd4\u5982\u8ddf\u5ba2\u6237\u5efa\u7acb\u4fe1\u4efb。', estimatedMinutes: 10 },
      { id: 3, title: '\u5927\u8bed\u8a00\u6a21\u578b\u662f\u4ec0\u4e48？', content: '\u5927\u8bed\u8a00\u6a21\u578b（LLM）\u662f\u76ee\u524d\u6700\u70ed\u95e8\u7684AI\u6280\u672f，ChatGPT、\u6587\u5fc3\u4e00\u8a00、\u901a\u4e49\u5343\u95ee\u90fd\u662f\u8fd9\u7c7b。\u4f60\u53ef\u4ee5\u628a\u5b83\u60f3\u8c61\u6210\u4e00\u4e2a"\u8bfb\u4e86\u6d77\u91cf\u4e66\u7c4d\u8d44\u6599\u7684\u5b66\u751f"——\u4f60\u8ddf\u5b83\u8bf4\u8bdd，\u5b83\u6839\u636e\u5b66\u8fc7\u7684\u77e5\u8bc6\u6765\u56de\u7b54。\u5b83\u5f88\u806a\u660e\u4f46\u4e5f\u6709\u5c40\u9650：\u77e5\u8bc6\u6709\u622a\u6b62\u65e5\u671f、\u5076\u5c14\u4f1a"\u4e00\u672c\u6b63\u7ecf\u5730\u80e1\u8bf4\u516b\u9053"、\u4e0d\u80fd\u4ee3\u66ff\u4f60\u7684\u4e13\u4e1a\u5224\u65ad。\u628a\u5b83\u5f53\u6210\u4e00\u4e2a\u77e5\u8bc6\u9762\u5f88\u5e7f\u4f46\u9700\u8981\u4f60\u5f15\u5bfc\u7684\u5b9e\u4e60\u751f\u5c31\u5bf9\u4e86。', estimatedMinutes: 10 },
      { id: 4, title: '\u5982\u4f55\u4e0eAI\u5bf9\u8bdd？', content: '\u8ddfAI\u5bf9\u8bdd\u5c31\u50cf\u8ddf\u4eba\u804a\u5929，\u4f46\u8981\u8bb0\u4f4f\u4e09\u4e2a\u539f\u5219：\u4e00、\u8bf4\u6e05\u695a\u4f60\u8981\u4ec0\u4e48（\u4e0d\u8981\u7b3c\u7edf）；\u4e8c、\u7ed9\u80cc\u666f\u4fe1\u606f（\u4f60\u662f\u8c01、\u4f60\u7684\u76ee\u7684\u662f\u4ec0\u4e48）；\u4e09、\u4e0d\u6ee1\u610f\u5c31\u8ba9\u5b83\u6539（"\u518d\u7b80\u6d01\u4e00\u70b9""\u6362\u4e2a\u89d2\u5ea6"）。\u6bd4\u5982\u4e0d\u8981\u8bf4"\u5199\u4e2a\u6587\u6848"，\u800c\u8981\u8bf4"\u6211\u662f\u4e00\u4e2a\u4fdd\u9669\u9500\u552e，\u8bf7\u5e2e\u6211\u5199\u4e00\u6bb5\u5173\u4e8e\u767e\u4e07\u533b\u7597\u9669\u7684\u670b\u53cb\u5708\u6587\u6848，\u8bed\u6c14\u4eb2\u5207，300\u5b57\u4ee5\u5185"。\u5199\u5f97\u8d8a\u5177\u4f53，AI\u7684\u56de\u7b54\u8d8a\u7b26\u5408\u4f60\u7684\u9700\u6c42。', estimatedMinutes: 10 },
    ],
  },
  // Phase 2: \u5f00\u59cb\u4f7f\u7528
  {
    phase: 2,
    phaseTitle: '\u7b2c\u4e8c\u9636\u6bb5：\u5f00\u59cb\u4f7f\u7528',
    phaseDesc: '\u6ce8\u518c\u5de5\u5177，\u638c\u63e1\u63d0\u793a\u8bcd\u6280\u5de7，\u8ba9AI\u5e2e\u4f60\u5de5\u4f5c',
    topics: [
      { id: 5, title: '\u6ce8\u518c\u4f60\u7684\u7b2c\u4e00\u4e2aAI\u5de5\u5177', content: '\u56fd\u5185\u76ee\u524d\u6700\u5e38\u7528\u7684AI\u5de5\u5177\u6709：\u901a\u4e49\u5343\u95ee（\u963f\u91cc\u51fa\u54c1，\u514d\u8d39）、\u6587\u5fc3\u4e00\u8a00（\u767e\u5ea6\u51fa\u54c1）、\u8c46\u5305（\u5b57\u8282\u51fa\u54c1）、Kimi（\u6708\u4e4b\u6697\u9762\u51fa\u54c1，\u64c5\u957f\u957f\u6587\u672c）。\u63a8\u8350\u4ece\u901a\u4e49\u5343\u95ee\u6216\u8c46\u5305\u5f00\u59cb，\u56e0\u4e3a\u5b83\u4eec\u514d\u8d39、\u6709\u624b\u673aApp、\u4e2d\u6587\u4f53\u9a8c\u597d。\u6ce8\u518c\u53ea\u9700\u8981\u624b\u673a\u53f7，3\u5206\u949f\u641e\u5b9a。\u6ce8\u518c\u540e\u8bd5\u7740\u8ddf\u5b83\u6253\u4e2a\u62db\u547c："\u4f60\u597d，\u6211\u662f\u4e00\u4e2a\u4fdd\u9669\u9500\u552e，\u60f3\u5b66\u4e60\u7528AI\u63d0\u9ad8\u5de5\u4f5c\u6548\u7387。"', estimatedMinutes: 10 },
      { id: 6, title: '\u5199\u597d\u63d0\u793a\u8bcd\u76845\u4e2a\u6280\u5de7', content: '\u6280\u5de7\u4e00：\u7ed9AI\u4e00\u4e2a\u89d2\u8272（"\u4f60\u662f\u4e00\u4e2a\u8d44\u6df1\u7684\u4fdd\u9669\u987e\u95ee"）。\u6280\u5de7\u4e8c：\u8bf4\u6e05\u695a\u4efb\u52a1（"\u5e2e\u6211\u5199\u4e00\u6bb5\u4ea7\u54c1\u4ecb\u7ecd"）。\u6280\u5de7\u4e09：\u63d0\u4f9b\u80cc\u666f\u4fe1\u606f（"\u5ba2\u6237\u662f30\u5c81\u5973\u6027，\u5173\u6ce8\u91cd\u75be\u4fdd\u969c"）。\u6280\u5de7\u56db：\u9650\u5b9a\u683c\u5f0f\u548c\u5b57\u6570（"300\u5b57\u4ee5\u5185，\u52063\u6bb5"）。\u6280\u5de7\u4e94：\u7ed9\u51fa\u793a\u4f8b（"\u53c2\u8003\u8fd9\u4e2a\u98ce\u683c：……"）。\u8bb0\u4f4f\u53e3\u8bc0：\u89d2\u8272+\u4efb\u52a1+\u80cc\u666f+\u683c\u5f0f+\u793a\u4f8b。\u591a\u8bd5\u51e0\u6b21\u5c31\u80fd\u627e\u5230\u611f\u89c9。', estimatedMinutes: 15 },
      { id: 7, title: '\u8ba9AI\u5e2e\u4f60\u5199\u6587\u6848', content: '\u4f5c\u4e3a\u4fdd\u9669\u9500\u552e，\u4f60\u7ecf\u5e38\u9700\u8981\u5199\u670b\u53cb\u5708\u6587\u6848、\u4ea7\u54c1\u4ecb\u7ecd、\u5ba2\u6237\u6c9f\u901a\u8bdd\u672f。\u8bd5\u8bd5\u8fd9\u6837\u95eeAI："\u6211\u662f\u4e00\u540d\u4fdd\u9669\u9500\u552e，\u8bf7\u5e2e\u6211\u51995\u6761\u5173\u4e8e\u91cd\u5927\u75be\u75c5\u4fdd\u9669\u7684\u670b\u53cb\u5708\u6587\u6848，\u8981\u6c42：\u8bed\u6c14\u6e29\u6696\u4e0d\u63a8\u9500、\u6bcf\u6761100\u5b57\u4ee5\u5185、\u7a81\u51fa\u4fdd\u969c\u7684\u91cd\u8981\u6027\u800c\u975e\u4ea7\u54c1\u672c\u8eab、\u9002\u540830-45\u5c81\u4eba\u7fa4\u9605\u8bfb。"AI\u751f\u6210\u7684\u6587\u6848\u4f60\u53ef\u4ee5\u76f4\u63a5\u7528，\u4e5f\u53ef\u4ee5\u6839\u636e\u5b9e\u9645\u60c5\u51b5\u4fee\u6539。\u7701\u4e0b\u7684\u65f6\u95f4\u53ef\u4ee5\u7528\u6765\u591a\u8054\u7cfb\u4e00\u4e2a\u5ba2\u6237。', estimatedMinutes: 15 },
      { id: 8, title: '\u8ba9AI\u5e2e\u4f60\u6574\u7406\u8d44\u6599', content: '\u4ea7\u54c1\u6761\u6b3e\u592a\u957f\u770b\u4e0d\u5b8c？\u5ba2\u6237\u8d44\u6599\u592a\u591a\u7406\u4e0d\u6e05？\u8bd5\u8bd5\u628a\u5927\u6bb5\u6587\u5b57\u53d1\u7ed9AI，\u8ba9\u5b83\u5e2e\u4f60\u603b\u7ed3。\u6bd4\u5982："\u8bf7\u5e2e\u6211\u628a\u4ee5\u4e0b\u4fdd\u9669\u6761\u6b3e\u4e2d\u5173\u4e8e\u514d\u8d23\u6761\u6b3e\u7684\u90e8\u5206\u7528\u901a\u4fd7\u8bed\u8a00\u603b\u7ed3\u51fa\u6765，200\u5b57\u4ee5\u5185"。\u6216\u8005"\u8bf7\u5e2e\u6211\u628a\u8fd9\u4e9b\u5ba2\u6237\u4fe1\u606f\u6574\u7406\u6210\u4e00\u4e2a\u8868\u683c，\u5217\u51fa\u59d3\u540d、\u5e74\u9f84、\u5df2\u8d2d\u9669\u79cd、\u4e0b\u6b21\u7eed\u4fdd\u65e5\u671f"。AI\u662f\u6574\u7406\u4fe1\u606f\u7684\u9ad8\u624b，\u51e0\u79d2\u949f\u80fd\u5b8c\u6210\u4f60\u534a\u5c0f\u65f6\u7684\u5de5\u4f5c\u91cf。', estimatedMinutes: 10 },
    ],
  },
  // Phase 3: \u8fdb\u9636\u6280\u5de7
  {
    phase: 3,
    phaseTitle: '\u7b2c\u4e09\u9636\u6bb5：\u8fdb\u9636\u6280\u5de7',
    phaseDesc: '\u7528AI\u6df1\u5165\u5206\u6790\u4e1a\u52a1，\u63d0\u5347\u4e13\u4e1a\u5ea6',
    topics: [
      { id: 9, title: '\u7528AI\u5206\u6790\u5ba2\u6237\u9700\u6c42', content: '\u628a\u5ba2\u6237\u7684\u57fa\u672c\u4fe1\u606f\u544a\u8bc9AI，\u8ba9\u5b83\u5e2e\u4f60\u5206\u6790\u4fdd\u9669\u9700\u6c42。\u6bd4\u5982："\u6211\u7684\u5ba2\u6237：35\u5c81\u7537\u6027，\u5df2\u5a5a\u6709\u4e00\u5b50，\u5e74\u6536\u516530\u4e07，\u6709\u623f\u8d37200\u4e07，\u76ee\u524d\u53ea\u6709\u793e\u4fdd。\u8bf7\u5e2e\u6211\u5206\u6790\u4ed6\u9700\u8981\u54ea\u4e9b\u4fdd\u9669，\u5e76\u7ed9\u51fa\u4f18\u5148\u7ea7\u5efa\u8bae。"AI\u4f1a\u4ece\u4e13\u4e1a\u89d2\u5ea6\u7ed9\u51fa\u5206\u6790\u6846\u67b6。\u5f53\u7136\u6700\u7ec8\u5efa\u8bae\u8981\u7ed3\u5408\u4f60\u5bf9\u5ba2\u6237\u7684\u4e86\u89e3，AI\u662f\u53c2\u8c0b，\u4f60\u662f\u51b3\u7b56\u8005。', estimatedMinutes: 15 },
      { id: 10, title: '\u7528AI\u5236\u4f5c\u4fdd\u9669\u65b9\u6848\u5bf9\u6bd4', content: '\u5ba2\u6237\u5728\u51e0\u4e2a\u4ea7\u54c1\u4e4b\u95f4\u72b9\u8c6b？\u628a\u4ea7\u54c1\u4fe1\u606f\u53d1\u7ed9AI，\u8ba9\u5b83\u505a\u4e2a\u5bf9\u6bd4\u8868。\u6bd4\u5982："\u8bf7\u5bf9\u6bd4\u4ee5\u4e0b\u4e09\u6b3e\u91cd\u75be\u9669\u4ea7\u54c1\u7684\u5dee\u5f02：\u4ea7\u54c1A（\u4fdd\u969c100\u79cd\u91cd\u75be、\u4fdd\u989d50\u4e07、\u5e74\u7f348000）、\u4ea7\u54c1B（\u4fdd\u969c120\u79cd\u91cd\u75be\u542b\u8f7b\u75c7、\u4fdd\u989d50\u4e07、\u5e74\u7f349500）、\u4ea7\u54c1C（\u4fdd\u969c100\u79cd\u91cd\u75be、\u4fdd\u989d60\u4e07、\u5e74\u7f348800）。\u7528\u8868\u683c\u5f62\u5f0f\u5448\u73b0，\u5e76\u7ed9\u51fa\u8d2d\u4e70\u5efa\u8bae。"\u4e00\u79d2\u949f\u751f\u6210\u4e13\u4e1a\u5bf9\u6bd4，\u5ba2\u6237\u4f1a\u5bf9\u4f60\u522e\u76ee\u76f8\u770b。', estimatedMinutes: 15 },
      { id: 11, title: '\u7528AI\u7ba1\u7406\u65e5\u7a0b\u548c\u63d0\u9192', content: '\u6bcf\u5929\u4e8b\u60c5\u592a\u591a\u5bb9\u6613\u5fd8？\u8ba9AI\u505a\u4f60\u7684\u79c1\u4eba\u79d8\u4e66。\u4f60\u53ef\u4ee5\u8bf4："\u8bf7\u5e2e\u6211\u89c4\u5212\u660e\u5929\u7684\u5de5\u4f5c\u5b89\u6392：\u4e0a\u53489\u70b9\u523011\u70b9\u89c1\u5ba2\u6237A，\u4e0b\u53482\u70b9\u5904\u7406\u7eed\u4fdd\u63d0\u9192，\u4e0b\u53484\u70b9\u5b66\u4e60\u65b0\u4ea7\u54c1\u8d44\u6599。\u53e6\u5916\u63d0\u9192\u6211\u5468\u56db\u524d\u8981\u5b8c\u62103\u4e2a\u5ba2\u6237\u7684\u56de\u8bbf。"AI\u8fd8\u80fd\u5e2e\u4f60\u751f\u6210\u5468\u62a5、\u6574\u7406\u6bcf\u65e5\u5de5\u4f5c\u91cd\u70b9、\u8bbe\u7f6e\u5b66\u4e60\u8ba1\u5212。\u628a\u7410\u4e8b\u4ea4\u7ed9AI，\u4f60\u4e13\u6ce8\u505a\u6700\u91cd\u8981\u7684\u4e8b。', estimatedMinutes: 10 },
    ],
  },
  // Phase 4: \u719f\u7ec3\u8fd0\u7528
  {
    phase: 4,
    phaseTitle: '\u7b2c\u56db\u9636\u6bb5：\u719f\u7ec3\u8fd0\u7528',
    phaseDesc: '\u5efa\u7acb\u4e2a\u4ebaAI\u5de5\u4f5c\u6d41，\u6301\u7eed\u6210\u957f',
    topics: [
      { id: 12, title: '\u642d\u5efa\u4f60\u7684AI\u5de5\u4f5c\u6d41', content: '\u628aAI\u878d\u5165\u65e5\u5e38\u5de5\u4f5c\u5f62\u6210\u4e60\u60ef：\u65e9\u4e0a\u8ba9AI\u89c4\u5212\u5f53\u5929\u4efb\u52a1 → \u4e0a\u5348\u7528AI\u5199\u6587\u6848\u548c\u56de\u590d → \u4e2d\u5348\u7528AI\u5b66\u4e60\u4e00\u4e2a\u65b0\u77e5\u8bc6\u70b9 → \u4e0b\u5348\u7528AI\u5206\u6790\u5ba2\u6237 → \u665a\u4e0a\u7528AI\u603b\u7ed3\u5f53\u5929\u5de5\u4f5c。\u5173\u952e\u662f\u56fa\u5b9a\u4e0b\u6765，\u8ba9\u5b83\u50cf\u5237\u7259\u4e00\u6837\u81ea\u7136。\u5efa\u8bae\u6bcf\u5929\u81f3\u5c11\u82b115\u5206\u949f\u7528AI\u505a\u4e00\u4ef6\u539f\u6765\u9700\u8981\u624b\u52a8\u5b8c\u6210\u7684\u4e8b\u60c5，\u4e00\u4e2a\u6708\u540e\u4f60\u4f1a\u53d1\u73b0\u81ea\u5df1\u6548\u7387\u63d0\u5347\u4e86\u4e00\u500d。', estimatedMinutes: 10 },
      { id: 13, title: 'AI + \u4fdd\u9669\u4e1a\u52a1\u5b9e\u6218', content: '\u5b9e\u6218\u573a\u666f：①\u7528AI\u751f\u6210\u5ba2\u6237\u751f\u65e5\u795d\u798f（\u4e2a\u6027\u5316、\u6709\u6e29\u5ea6）；②\u7528AI\u5e2e\u4f60\u51c6\u5907\u4ea7\u54c1\u8bf4\u660e\u4f1a\u7684\u6f14\u8bb2\u7a3f；③\u7528AI\u6a21\u62df\u5ba2\u6237\u63d0\u95ee，\u7ec3\u4e60\u5e94\u7b54\u8bdd\u672f；④\u7528AI\u89e3\u8bfb\u4fdd\u9669\u884c\u4e1a\u65b0\u653f\u7b56；⑤\u7528AI\u6574\u7406\u7ade\u54c1\u5206\u6790\u62a5\u544a。\u8fd9\u4e9b\u573a\u666f\u90fd\u662f\u771f\u5b9e\u53ef\u7528\u7684，\u4eca\u5929\u5c31\u53ef\u4ee5\u8bd5\u8bd5。\u8bb0\u4f4f\u4e00\u4e2a\u539f\u5219：AI\u751f\u6210\u7684\u5185\u5bb9\u662f\u521d\u7a3f，\u4f60\u8981\u52a0\u5165\u81ea\u5df1\u7684\u7406\u89e3\u548c\u4eba\u60c5\u5473，\u624d\u662f\u6700\u7ec8\u7248。', estimatedMinutes: 15 },
      { id: 14, title: '\u6301\u7eed\u5b66\u4e60\u4e0e\u8d44\u6e90\u63a8\u8350', content: 'AI\u6280\u672f\u53d1\u5c55\u5f88\u5feb，\u4fdd\u6301\u5b66\u4e60\u7684\u4e60\u60ef\u5f88\u91cd\u8981。\u63a8\u8350\u5173\u6ce8：①B\u7ad9\u641c\u7d22"AI\u4f7f\u7528\u6280\u5de7"\u6709\u5f88\u591a\u4e2d\u6587\u6559\u7a0b；②\u5fae\u4fe1\u516c\u4f17\u53f7"\u91cf\u5b50\u4f4d""\u673a\u5668\u4e4b\u5fc3"\u62a5\u9053AI\u6700\u65b0\u52a8\u6001；③\u6296\u97f3\u4e0a\u4e5f\u6709\u5f88\u591aAI\u535a\u4e3b\u505a\u901a\u4fd7\u79d1\u666e。\u6bcf\u5929\u82b110\u5206\u949f\u5237\u4e00\u5237，\u4e0d\u7528\u6df1\u5165\u7406\u89e3\u6280\u672f\u539f\u7406，\u77e5\u9053"AI\u73b0\u5728\u80fd\u505a\u4ec0\u4e48\u65b0\u4e8b\u60c5"\u5c31\u591f\u4e86。\u4f60\u4e0d\u9700\u8981\u6210\u4e3a\u4e13\u5bb6，\u4f46\u8981\u4fdd\u6301\u5bf9\u65b0\u5de5\u5177\u7684\u654f\u611f\u5ea6。', estimatedMinutes: 10 },
    ],
  },
];

// ============================================================
// \u6bcf\u65e5\u63a8\u8350\u89c6\u9891\u641c\u7d22\u8bcd
// ============================================================

const DAILY_VIDEOS = [
  { query: 'AI\u79d1\u666e \u4ec0\u4e48\u662f\u4eba\u5de5\u667a\u80fd', title: '\u4ec0\u4e48\u662f\u4eba\u5de5\u667a\u80fd？' },
  { query: 'ChatGPT\u4f7f\u7528\u6559\u7a0b \u65b0\u624b', title: 'AI\u5de5\u5177\u4f7f\u7528\u6559\u7a0b（\u65b0\u624b\u5165\u95e8）' },
  { query: 'AI\u63d0\u793a\u8bcd\u6280\u5de7', title: '\u5199\u597d\u63d0\u793a\u8bcd\u7684\u5b9e\u7528\u6280\u5de7' },
  { query: 'AI\u5199\u4f5c\u5de5\u5177\u63a8\u8350', title: '\u597d\u7528\u7684AI\u5199\u4f5c\u5de5\u5177\u63a8\u8350' },
  { query: 'AI\u529e\u516c\u6548\u7387\u63d0\u5347', title: '\u7528AI\u63d0\u5347\u529e\u516c\u6548\u7387' },
  { query: 'AI\u4fdd\u9669\u884c\u4e1a\u5e94\u7528', title: 'AI\u5728\u4fdd\u9669\u884c\u4e1a\u7684\u5e94\u7528' },
  { query: 'AI\u5b66\u4e60\u8def\u5f84\u89c4\u5212', title: 'AI\u521d\u5b66\u8005\u5b66\u4e60\u8def\u5f84' },
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
// \u6570\u636e\u64cd\u4f5c
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
// \u6e32\u67d3：\u4e3b\u5165\u53e3
// ============================================================

export async function renderAI(container) {
  const tabState = container.getAttribute('data-ai-tab') || 'path';

  container.innerHTML = `
    <div class="ai-module">
      <div class="ai-tabs" style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto">
        <button class="ai-tab ${tabState === 'path' ? 'active' : ''}" data-tab="path" style="flex:1;padding:10px 8px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;background:${tabState === 'path' ? 'var(--primary)' : 'var(--gray-100)'};color:${tabState === 'path' ? '#fff' : 'var(--gray-600)'};white-space:nowrap">📖 \u5b66\u4e60\u8def\u5f84</button>
        <button class="ai-tab ${tabState === 'video' ? 'active' : ''}" data-tab="video" style="flex:1;padding:10px 8px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;background:${tabState === 'video' ? 'var(--primary)' : 'var(--gray-100)'};color:${tabState === 'video' ? '#fff' : 'var(--gray-600)'};white-space:nowrap">🎬 \u4eca\u65e5\u63a8\u8350</button>
        <button class="ai-tab ${tabState === 'notes' ? 'active' : ''}" data-tab="notes" style="flex:1;padding:10px 8px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;background:${tabState === 'notes' ? 'var(--primary)' : 'var(--gray-100)'};color:${tabState === 'notes' ? '#fff' : 'var(--gray-600)'};white-space:nowrap">📝 \u5b66\u4e60\u7b14\u8bb0</button>
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
// Tab 1: \u5b66\u4e60\u8def\u5f84
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
          <div style="font-size:13px;opacity:0.85">\u5b66\u4e60\u8fdb\u5ea6</div>
          <div style="font-size:28px;font-weight:700;margin-top:4px">${progressPct}%</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;opacity:0.85">\u5df2\u5b8c\u6210</div>
          <div style="font-size:28px;font-weight:700;margin-top:4px">${completedCount}/${totalTopics}</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.2);border-radius:6px;height:8px;overflow:hidden">
        <div style="background:#fff;height:100%;border-radius:6px;width:${progressPct}%;transition:width 0.3s"></div>
      </div>
      <div class="flex-between" style="margin-top:12px">
        <div style="font-size:12px;opacity:0.85">🔥 \u8fde\u7eed\u6253\u5361 ${streak} \u5929</div>
        <div style="font-size:12px;opacity:0.85">⏱ \u4eca\u65e5\u5b66\u4e60 ${progress.minutesLearned} \u5206\u949f</div>
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
          <span style="font-size:12px;color:var(--gray-400)">${phaseCompleted}/${phaseTotal} · ${isExpanded ? '\u6536\u8d77 ▲' : '\u5c55\u5f00 ▼'}</span>
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
                    <span style="font-size:11px;color:var(--gray-400);font-weight:400">· ${topic.estimatedMinutes}\u5206\u949f</span>
                  </div>
                  <div class="topic-detail" id="topic-detail-${topic.id}" style="display:none;font-size:13px;color:var(--gray-600);line-height:1.7;margin-top:8px;padding:10px;background:#fff;border-radius:6px">
                    ${escapeHtml(topic.content)}
                    <div style="margin-top:10px">
                      ${done ? 
                        '<button class="btn-primary btn-sm" disabled style="opacity:0.5">✅ \u5df2\u5b8c\u6210</button>' : 
                        `<button class="btn-primary btn-sm" onclick="event.stopPropagation();window.__completeTopic(${topic.id})">✓ \u6807\u8bb0\u5b8c\u6210</button>`
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
    toast('✅ \u4e3b\u9898\u5b8c\u6210！\u5b66\u4e60\u65f6\u95f4 +15\u5206\u949f');
    renderPathTab(container);
  };
}

// ============================================================
// Tab 2: \u4eca\u65e5\u63a8\u8350
// ============================================================

async function renderVideoTab(container) {
  const progress = await getTodayProgress();
  const videos = getTodayVideos();

  container.innerHTML = `
    <div class="card" style="margin-bottom:12px;text-align:center;padding:24px">
      <div style="font-size:32px;margin-bottom:8px">⏱️</div>
      <div style="font-size:20px;font-weight:700;color:var(--gray-700)">
        \u4eca\u65e5\u5b66\u4e60：${progress.minutesLearned} \u5206\u949f / 15 \u5206\u949f
      </div>
      <div style="background:var(--gray-100);border-radius:6px;height:6px;overflow:hidden;margin-top:12px">
        <div style="background:var(--primary);height:100%;border-radius:6px;width:${Math.min(progress.minutesLearned / 15 * 100, 100)}%"></div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--gray-500)">
        ${progress.minutesLearned >= 15 ? '🎉 \u4eca\u65e5\u76ee\u6807\u8fbe\u6210！' : `\u8fd8\u5dee ${15 - progress.minutesLearned} \u5206\u949f\u5b8c\u6210\u4eca\u65e5\u76ee\u6807`}
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title"><span class="title-left">🎬 \u4eca\u65e5\u63a8\u8350\u89c6\u9891</span></div>
      <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px">\u6bcf\u5929\u63a8\u83502\u4e2aAI\u5b66\u4e60\u89c6\u9891，\u70b9\u51fb\u8df3\u8f6c\u5230B\u7ad9\u641c\u7d22</div>
      ${videos.map(v => `
        <div class="video-card" style="padding:14px;margin-bottom:10px;border-radius:8px;background:var(--gray-50);border:1px solid var(--gray-100);cursor:pointer" onclick="window.open('${escapeHtml(getSearchUrl(v.query))}', '_blank')">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">🎥</span>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600;color:var(--gray-700)">${escapeHtml(v.title)}</div>
              <div style="font-size:11px;color:var(--gray-400);margin-top:4px">\u641c\u7d22：${escapeHtml(v.query)} →</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">✏️ \u5feb\u901f\u7b14\u8bb0</span></div>
      <div style="font-size:12px;color:var(--gray-500);margin-bottom:8px">\u8bb0\u5f55\u4f60\u4eca\u5929\u5b66\u5230\u7684\u5185\u5bb9</div>
      <input id="quick-note-title" type="text" placeholder="\u7b14\u8bb0\u6807\u9898（\u9009\u586b）" style="width:100%;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box">
      <textarea id="quick-note-content" placeholder="\u4eca\u5929\u5b66\u5230\u4e86\u4ec0\u4e48？……" style="width:100%;height:80px;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;font-family:inherit"></textarea>
      <button class="btn-primary btn-full mt-8" onclick="window.__saveQuickNote()">💾 \u4fdd\u5b58\u7b14\u8bb0</button>
    </div>
  `;

  window.__saveQuickNote = async () => {
    const titleEl = document.getElementById('quick-note-title');
    const contentEl = document.getElementById('quick-note-content');
    const title = titleEl.value.trim() || '\u65e0\u6807\u9898\u7b14\u8bb0';
    const content = contentEl.value.trim();
    if (!content) {
      toast('\u8bf7\u8f93\u5165\u7b14\u8bb0\u5185\u5bb9');
      return;
    }
    await addNote(title, content);
    toast('\u7b14\u8bb0\u5df2\u4fdd\u5b58');
    titleEl.value = '';
    contentEl.value = '';
  };
}

// ============================================================
// Tab 3: \u5b66\u4e60\u7b14\u8bb0
// ============================================================

async function renderNotesTab(container) {
  const notes = await getNotes();

  container.innerHTML = `
    <div style="margin-bottom:12px">
      <button class="btn-primary btn-full" onclick="window.__showAddNote()">＋ \u65b0\u5efa\u7b14\u8bb0</button>
    </div>

    ${notes.length === 0 ? `
      <div class="card" style="text-align:center;padding:32px">
        <div style="font-size:40px;margin-bottom:8px">📝</div>
        <div style="font-size:14px;color:var(--gray-500)">\u8fd8\u6ca1\u6709\u5b66\u4e60\u7b14\u8bb0</div>
        <div style="font-size:12px;color:var(--gray-400);margin-top:4px">\u70b9\u51fb\u4e0a\u65b9\u6309\u94ae\u521b\u5efa\u7b2c\u4e00\u6761\u7b14\u8bb0</div>
      </div>
    ` : notes.map(note => `
      <div class="card" style="margin-bottom:10px">
        <div class="flex-between">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="window.__viewNote('${note.id}')">
            <div style="font-size:14px;font-weight:600;color:var(--gray-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(note.title)}</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(note.content)}</div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:4px">${escapeHtml(new Date(note.updatedAt).toLocaleString('zh-CN'))}</div>
          </div>
          <button class="btn-sm" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;margin-left:8px;flex-shrink:0" onclick="event.stopPropagation();window.__deleteNote('${note.id}')">\u5220\u9664</button>
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
        <button class="btn-primary btn-full mt-16" onclick="this.closest('div').parentElement.remove()">\u5173\u95ed</button>
      </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  };

  window.__deleteNote = async (noteId) => {
    if (!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u7b14\u8bb0\u5417？')) return;
    await deleteNote(noteId);
    toast('\u7b14\u8bb0\u5df2\u5220\u9664');
    renderNotesTab(container);
  };

  window.__showAddNote = () => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:20px;max-width:500px;width:90%">
        <h3 style="margin:0 0 12px">\u65b0\u5efa\u7b14\u8bb0</h3>
        <input id="add-note-title" type="text" placeholder="\u7b14\u8bb0\u6807\u9898" style="width:100%;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px;margin-bottom:8px;box-sizing:border-box">
        <textarea id="add-note-content" placeholder="\u7b14\u8bb0\u5185\u5bb9……" style="width:100%;height:120px;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;font-family:inherit"></textarea>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--gray-100);color:var(--gray-600);font-size:14px;cursor:pointer" onclick="this.closest('div').parentElement.remove()">\u53d6\u6d88</button>
          <button style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--primary);color:#fff;font-size:14px;cursor:pointer" id="confirm-add-note">\u4fdd\u5b58</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    const titleInput = modal.querySelector('#add-note-title');
    const contentInput = modal.querySelector('#add-note-content');
    titleInput.focus();

    modal.querySelector('#confirm-add-note').addEventListener('click', async () => {
      const title = titleInput.value.trim() || '\u65e0\u6807\u9898\u7b14\u8bb0';
      const content = contentInput.value.trim();
      if (!content) {
        toast('\u8bf7\u8f93\u5165\u7b14\u8bb0\u5185\u5bb9');
        return;
      }
      await addNote(title, content);
      modal.remove();
      toast('\u7b14\u8bb0\u5df2\u4fdd\u5b58');
      renderNotesTab(container);
    });
  };
}

// ============================================================
// Dashboard \u5361\u7247
// ============================================================

export async function dashboardAI() {
  const progress = await getTodayProgress();
  const streak = await getStreakDays();
  const completedIds = await getCompletedTopicIds();
  const completedCount = completedIds.size;

  return `
    <div class="dash-card" onclick="window.__navigate('ai')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">🤖 \u4e86\u89e3AI</div>
        <div class="dash-card-more">${completedCount}/14 ›</div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)">
        <div class="text-sm" style="line-height:1.8">
          \u4eca\u65e5\u5b66\u4e60：${progress.minutesLearned}\u5206\u949f | \u8fde\u7eed\u6253\u5361：${streak}\u5929 | \u8fdb\u5ea6：${completedCount}/14
        </div>
      </div>
    </div>
  `;
}
