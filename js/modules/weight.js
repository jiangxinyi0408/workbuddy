// ============================================================
// modules/weight.js - \u6a21\u57575：\u51cf\u80a5\u7ba1\u7406（\u4f53\u91cd+\u996e\u98df）
// ============================================================

import { put, getAll, del, getByIndex, getByRange, getSetting, setSetting } from '../db.js';
import { genId, today, fmtDate, toast, openBottomSheet, confirmDialog, escapeHtml, compressImage } from '../utils.js';
import { recognizeFood, generateDietRecommendation, ruleBasedDietAdvice } from '../ai.js';

// ============================================================
// \u98df\u7269\u70ed\u91cf\u6570\u636e\u5e93（\u4e2d\u56fd\u5e38\u89c1\u98df\u7269，\u5355\u4f4d：\u5361/100g \u6216 \u5361/\u4efd）
// ============================================================

const FOOD_DB = [
  // === \u4e3b\u98df\u7c7b ===
  { name: '\u767d\u7c73\u996d', unit: '100g', calories: 116, cat: '\u4e3b\u98df' },
  { name: '\u767d\u7c73\u996d', unit: '1\u7897(200g)', calories: 232, cat: '\u4e3b\u98df' },
  { name: '\u9992\u5934', unit: '100g', calories: 223, cat: '\u4e3b\u98df' },
  { name: '\u9992\u5934', unit: '1\u4e2a(100g)', calories: 223, cat: '\u4e3b\u98df' },
  { name: '\u82b1\u5377', unit: '100g', calories: 211, cat: '\u4e3b\u98df' },
  { name: '\u5305\u5b50(\u732a\u8089)', unit: '1\u4e2a(100g)', calories: 227, cat: '\u4e3b\u98df' },
  { name: '\u997a\u5b50(\u732a\u8089)', unit: '1\u4e2a(25g)', calories: 60, cat: '\u4e3b\u98df' },
  { name: '\u997a\u5b50(\u732a\u8089)', unit: '10\u4e2a', calories: 600, cat: '\u4e3b\u98df' },
  { name: '\u9762\u6761(\u716e)', unit: '100g', calories: 110, cat: '\u4e3b\u98df' },
  { name: '\u9762\u6761(\u716e)', unit: '1\u7897(300g)', calories: 330, cat: '\u4e3b\u98df' },
  { name: '\u62c9\u9762', unit: '1\u7897(400g)', calories: 440, cat: '\u4e3b\u98df' },
  { name: '\u9984\u9968', unit: '10\u4e2a', calories: 350, cat: '\u4e3b\u98df' },
  { name: '\u6cb9\u6761', unit: '1\u6839(70g)', calories: 270, cat: '\u4e3b\u98df' },
  { name: '\u70e7\u997c', unit: '1\u4e2a(100g)', calories: 326, cat: '\u4e3b\u98df' },
  { name: '\u5168\u9ea6\u9762\u5305', unit: '1\u7247(50g)', calories: 123, cat: '\u4e3b\u98df' },
  { name: '\u767d\u9762\u5305', unit: '1\u7247(50g)', calories: 133, cat: '\u4e3b\u98df' },
  { name: '\u5c0f\u7c73\u7ca5', unit: '1\u7897(300g)', calories: 138, cat: '\u4e3b\u98df' },
  { name: '\u767d\u7ca5', unit: '1\u7897(300g)', calories: 90, cat: '\u4e3b\u98df' },
  { name: '\u516b\u5b9d\u7ca5', unit: '1\u7897(300g)', calories: 195, cat: '\u4e3b\u98df' },
  { name: '\u7092\u996d', unit: '1\u4efd(300g)', calories: 564, cat: '\u4e3b\u98df' },
  { name: '\u7092\u9762', unit: '1\u4efd(300g)', calories: 480, cat: '\u4e3b\u98df' },
  { name: '\u7389\u7c73', unit: '1\u6839(200g)', calories: 224, cat: '\u4e3b\u98df' },
  { name: '\u7ea2\u85af', unit: '100g', calories: 86, cat: '\u4e3b\u98df' },
  { name: '\u7d2b\u85af', unit: '100g', calories: 82, cat: '\u4e3b\u98df' },
  { name: '\u571f\u8c46', unit: '100g', calories: 76, cat: '\u4e3b\u98df' },
  { name: '\u71d5\u9ea6\u7247', unit: '100g', calories: 377, cat: '\u4e3b\u98df' },
  { name: '\u71d5\u9ea6\u7247', unit: '1\u7897(50g)', calories: 188, cat: '\u4e3b\u98df' },
  { name: '\u7cbd\u5b50', unit: '1\u4e2a(150g)', calories: 300, cat: '\u4e3b\u98df' },
  { name: '\u5e74\u7cd5', unit: '100g', calories: 154, cat: '\u4e3b\u98df' },

  // === \u8089\u7c7b ===
  { name: '\u732a\u8089(\u7626)', unit: '100g', calories: 143, cat: '\u8089\u7c7b' },
  { name: '\u732a\u8089(\u4e94\u82b1)', unit: '100g', calories: 395, cat: '\u8089\u7c7b' },
  { name: '\u732a\u6392\u9aa8', unit: '100g', calories: 264, cat: '\u8089\u7c7b' },
  { name: '\u7ea2\u70e7\u8089', unit: '100g', calories: 479, cat: '\u8089\u7c7b' },
  { name: '\u56de\u9505\u8089', unit: '100g', calories: 266, cat: '\u8089\u7c7b' },
  { name: '\u732a\u8e44', unit: '100g', calories: 260, cat: '\u8089\u7c7b' },
  { name: '\u725b\u8089(\u7626)', unit: '100g', calories: 106, cat: '\u8089\u7c7b' },
  { name: '\u725b\u8089(\u80a5\u725b)', unit: '100g', calories: 250, cat: '\u8089\u7c7b' },
  { name: '\u9171\u725b\u8089', unit: '100g', calories: 246, cat: '\u8089\u7c7b' },
  { name: '\u725b\u6392', unit: '1\u4efd(200g)', calories: 350, cat: '\u8089\u7c7b' },
  { name: '\u7f8a\u8089', unit: '100g', calories: 203, cat: '\u8089\u7c7b' },
  { name: '\u6dae\u7f8a\u8089', unit: '1\u4efd(200g)', calories: 400, cat: '\u8089\u7c7b' },
  { name: '\u9e21\u80f8\u8089', unit: '100g', calories: 133, cat: '\u8089\u7c7b' },
  { name: '\u9e21\u817f', unit: '1\u4e2a(150g)', calories: 270, cat: '\u8089\u7c7b' },
  { name: '\u9e21\u7fc5', unit: '1\u4e2a(50g)', calories: 97, cat: '\u8089\u7c7b' },
  { name: '\u70b8\u9e21\u817f', unit: '1\u4e2a(150g)', calories: 390, cat: '\u8089\u7c7b' },
  { name: '\u70e4\u9e2d', unit: '100g', calories: 336, cat: '\u8089\u7c7b' },
  { name: '\u9e2d\u8089', unit: '100g', calories: 240, cat: '\u8089\u7c7b' },
  { name: '\u9999\u80a0', unit: '1\u6839(50g)', calories: 254, cat: '\u8089\u7c7b' },
  { name: '\u706b\u817f\u80a0', unit: '1\u6839(50g)', calories: 106, cat: '\u8089\u7c7b' },
  { name: '\u57f9\u6839', unit: '2\u7247(30g)', calories: 162, cat: '\u8089\u7c7b' },
  { name: '\u5348\u9910\u8089', unit: '100g', calories: 229, cat: '\u8089\u7c7b' },

  // === \u86cb\u7c7b ===
  { name: '\u9e21\u86cb(\u716e)', unit: '1\u4e2a(60g)', calories: 86, cat: '\u86cb\u7c7b' },
  { name: '\u9e21\u86cb(\u7092)', unit: '1\u4e2a(60g)', calories: 110, cat: '\u86cb\u7c7b' },
  { name: '\u714e\u86cb', unit: '1\u4e2a(60g)', calories: 118, cat: '\u86cb\u7c7b' },
  { name: '\u86cb\u767d', unit: '1\u4e2a', calories: 17, cat: '\u86cb\u7c7b' },
  { name: '\u86cb\u9ec4', unit: '1\u4e2a', calories: 55, cat: '\u86cb\u7c7b' },
  { name: '\u54b8\u9e2d\u86cb', unit: '1\u4e2a(70g)', calories: 133, cat: '\u86cb\u7c7b' },
  { name: '\u76ae\u86cb', unit: '1\u4e2a(60g)', calories: 103, cat: '\u86cb\u7c7b' },

  // === \u6c34\u4ea7\u7c7b ===
  { name: '\u4e09\u6587\u9c7c', unit: '100g', calories: 139, cat: '\u6c34\u4ea7' },
  { name: '\u5e26\u9c7c', unit: '100g', calories: 127, cat: '\u6c34\u4ea7' },
  { name: '\u9cab\u9c7c', unit: '100g', calories: 108, cat: '\u6c34\u4ea7' },
  { name: '\u9ca4\u9c7c', unit: '100g', calories: 109, cat: '\u6c34\u4ea7' },
  { name: '\u867e', unit: '100g', calories: 93, cat: '\u6c34\u4ea7' },
  { name: '\u867e\u4ec1', unit: '100g', calories: 48, cat: '\u6c34\u4ea7' },
  { name: '\u8783\u87f9', unit: '1\u53ea(200g)', calories: 190, cat: '\u6c34\u4ea7' },
  { name: '\u751f\u869d', unit: '100g', calories: 57, cat: '\u6c34\u4ea7' },
  { name: '\u9c7f\u9c7c', unit: '100g', calories: 75, cat: '\u6c34\u4ea7' },
  { name: '\u86e4\u870a', unit: '100g', calories: 56, cat: '\u6c34\u4ea7' },
  { name: '\u91d1\u67aa\u9c7c\u7f50\u5934', unit: '100g', calories: 198, cat: '\u6c34\u4ea7' },

  // === \u8c46\u5236\u54c1 ===
  { name: '\u8c46\u8150', unit: '100g', calories: 76, cat: '\u8c46\u5236\u54c1' },
  { name: '\u8c46\u8150\u5e72', unit: '100g', calories: 140, cat: '\u8c46\u5236\u54c1' },
  { name: '\u8c46\u6d46', unit: '1\u676f(250ml)', calories: 40, cat: '\u8c46\u5236\u54c1' },
  { name: '\u8c46\u6d46(\u751c)', unit: '1\u676f(250ml)', calories: 83, cat: '\u8c46\u5236\u54c1' },
  { name: '\u8c46\u8150\u8111', unit: '1\u7897(300g)', calories: 45, cat: '\u8c46\u5236\u54c1' },
  { name: '\u8150\u7af9', unit: '100g', calories: 459, cat: '\u8c46\u5236\u54c1' },

  // === \u852c\u83dc\u7c7b ===
  { name: '\u767d\u83dc', unit: '100g', calories: 13, cat: '\u852c\u83dc' },
  { name: '\u83e0\u83dc', unit: '100g', calories: 23, cat: '\u852c\u83dc' },
  { name: '\u897f\u5170\u82b1', unit: '100g', calories: 34, cat: '\u852c\u83dc' },
  { name: '\u756a\u8304', unit: '100g', calories: 18, cat: '\u852c\u83dc' },
  { name: '\u9ec4\u74dc', unit: '100g', calories: 15, cat: '\u852c\u83dc' },
  { name: '\u80e1\u841d\u535c', unit: '100g', calories: 37, cat: '\u852c\u83dc' },
  { name: '\u767d\u841d\u535c', unit: '100g', calories: 16, cat: '\u852c\u83dc' },
  { name: '\u8304\u5b50', unit: '100g', calories: 21, cat: '\u852c\u83dc' },
  { name: '\u9752\u6912', unit: '100g', calories: 20, cat: '\u852c\u83dc' },
  { name: '\u82b9\u83dc', unit: '100g', calories: 13, cat: '\u852c\u83dc' },
  { name: '\u97ed\u83dc', unit: '100g', calories: 25, cat: '\u852c\u83dc' },
  { name: '\u751f\u83dc', unit: '100g', calories: 13, cat: '\u852c\u83dc' },
  { name: '\u6cb9\u9ea6\u83dc', unit: '100g', calories: 15, cat: '\u852c\u83dc' },
  { name: '\u7a7a\u5fc3\u83dc', unit: '100g', calories: 20, cat: '\u852c\u83dc' },
  { name: '\u8c46\u82bd', unit: '100g', calories: 18, cat: '\u852c\u83dc' },
  { name: '\u6d0b\u8471', unit: '100g', calories: 40, cat: '\u852c\u83dc' },
  { name: '\u849c\u82d4', unit: '100g', calories: 36, cat: '\u852c\u83dc' },
  { name: '\u85d5', unit: '100g', calories: 73, cat: '\u852c\u83dc' },
  { name: '\u5357\u74dc', unit: '100g', calories: 22, cat: '\u852c\u83dc' },
  { name: '\u51ac\u74dc', unit: '100g', calories: 11, cat: '\u852c\u83dc' },
  { name: '\u4e1d\u74dc', unit: '100g', calories: 20, cat: '\u852c\u83dc' },
  { name: '\u82e6\u74dc', unit: '100g', calories: 19, cat: '\u852c\u83dc' },
  { name: '\u8611\u83c7', unit: '100g', calories: 22, cat: '\u852c\u83dc' },
  { name: '\u9999\u83c7', unit: '100g', calories: 26, cat: '\u852c\u83dc' },
  { name: '\u91d1\u9488\u83c7', unit: '100g', calories: 32, cat: '\u852c\u83dc' },
  { name: '\u6728\u8033', unit: '100g', calories: 21, cat: '\u852c\u83dc' },
  { name: '\u6d77\u5e26', unit: '100g', calories: 12, cat: '\u852c\u83dc' },
  { name: '\u7d2b\u83dc', unit: '100g', calories: 35, cat: '\u852c\u83dc' },

  // === \u6c34\u679c\u7c7b ===
  { name: '\u82f9\u679c', unit: '1\u4e2a(200g)', calories: 106, cat: '\u6c34\u679c' },
  { name: '\u9999\u8549', unit: '1\u6839(120g)', calories: 111, cat: '\u6c34\u679c' },
  { name: '\u6a59\u5b50', unit: '1\u4e2a(200g)', calories: 96, cat: '\u6c34\u679c' },
  { name: '\u6a58\u5b50', unit: '1\u4e2a(100g)', calories: 44, cat: '\u6c34\u679c' },
  { name: '\u897f\u74dc', unit: '1\u5757(300g)', calories: 93, cat: '\u6c34\u679c' },
  { name: '\u8461\u8404', unit: '100g', calories: 69, cat: '\u6c34\u679c' },
  { name: '\u8349\u8393', unit: '100g', calories: 32, cat: '\u6c34\u679c' },
  { name: '\u84dd\u8393', unit: '100g', calories: 57, cat: '\u6c34\u679c' },
  { name: '\u7315\u7334\u6843', unit: '1\u4e2a(100g)', calories: 61, cat: '\u6c34\u679c' },
  { name: '\u8292\u679c', unit: '1\u4e2a(200g)', calories: 70, cat: '\u6c34\u679c' },
  { name: '\u68a8', unit: '1\u4e2a(200g)', calories: 88, cat: '\u6c34\u679c' },
  { name: '\u6843\u5b50', unit: '1\u4e2a(200g)', calories: 84, cat: '\u6c34\u679c' },
  { name: '\u6a31\u6843', unit: '100g', calories: 50, cat: '\u6c34\u679c' },
  { name: '\u67da\u5b50', unit: '1\u74e3(100g)', calories: 42, cat: '\u6c34\u679c' },
  { name: '\u706b\u9f99\u679c', unit: '1\u4e2a(300g)', calories: 165, cat: '\u6c34\u679c' },
  { name: '\u77f3\u69b4', unit: '100g', calories: 147, cat: '\u6c34\u679c' },
  { name: '\u725b\u6cb9\u679c', unit: '1\u4e2a(150g)', calories: 240, cat: '\u6c34\u679c' },
  { name: '\u54c8\u5bc6\u74dc', unit: '1\u5757(200g)', calories: 68, cat: '\u6c34\u679c' },
  { name: '\u83e0\u841d', unit: '100g', calories: 44, cat: '\u6c34\u679c' },
  { name: '\u8354\u679d', unit: '10\u9897(200g)', calories: 142, cat: '\u6c34\u679c' },

  // === \u5976\u5236\u54c1 ===
  { name: '\u5168\u8102\u725b\u5976', unit: '1\u676f(250ml)', calories: 163, cat: '\u5976\u5236\u54c1' },
  { name: '\u8131\u8102\u725b\u5976', unit: '1\u676f(250ml)', calories: 88, cat: '\u5976\u5236\u54c1' },
  { name: '\u9178\u5976(\u539f\u5473)', unit: '1\u676f(200g)', calories: 144, cat: '\u5976\u5236\u54c1' },
  { name: '\u9178\u5976(\u679c\u5473)', unit: '1\u676f(200g)', calories: 180, cat: '\u5976\u5236\u54c1' },
  { name: '\u5976\u916a', unit: '1\u7247(20g)', calories: 66, cat: '\u5976\u5236\u54c1' },

  // === \u96f6\u98df/\u996e\u6599 ===
  { name: '\u53ef\u4e50', unit: '1\u7f50(330ml)', calories: 139, cat: '\u996e\u6599' },
  { name: '\u96ea\u78a7', unit: '1\u7f50(330ml)', calories: 151, cat: '\u996e\u6599' },
  { name: '\u6a59\u6c41', unit: '1\u676f(250ml)', calories: 113, cat: '\u996e\u6599' },
  { name: '\u5564\u9152', unit: '1\u7f50(330ml)', calories: 106, cat: '\u996e\u6599' },
  { name: '\u7ea2\u9152', unit: '1\u676f(150ml)', calories: 128, cat: '\u996e\u6599' },
  { name: '\u62ff\u94c1\u5496\u5561', unit: '1\u676f(360ml)', calories: 176, cat: '\u996e\u6599' },
  { name: '\u7f8e\u5f0f\u5496\u5561', unit: '1\u676f(360ml)', calories: 10, cat: '\u996e\u6599' },
  { name: '\u5976\u8336(\u73cd\u73e0)', unit: '1\u676f(500ml)', calories: 350, cat: '\u996e\u6599' },
  { name: '\u5976\u8336(\u539f\u5473)', unit: '1\u676f(500ml)', calories: 265, cat: '\u996e\u6599' },
  { name: '\u85af\u7247', unit: '1\u5305(75g)', calories: 410, cat: '\u96f6\u98df' },
  { name: '\u997c\u5e72', unit: '100g', calories: 433, cat: '\u96f6\u98df' },
  { name: '\u5de7\u514b\u529b', unit: '1\u5757(50g)', calories: 273, cat: '\u96f6\u98df' },
  { name: '\u51b0\u6dc7\u6dcb', unit: '1\u7403(100g)', calories: 207, cat: '\u96f6\u98df' },
  { name: '\u86cb\u7cd5', unit: '1\u5757(100g)', calories: 347, cat: '\u96f6\u98df' },
  { name: '\u575a\u679c(\u6df7\u5408)', unit: '100g', calories: 607, cat: '\u96f6\u98df' },
  { name: '\u6838\u6843', unit: '100g', calories: 654, cat: '\u96f6\u98df' },
  { name: '\u674f\u4ec1', unit: '100g', calories: 579, cat: '\u96f6\u98df' },
  { name: '\u74dc\u5b50', unit: '100g', calories: 574, cat: '\u96f6\u98df' },
  { name: '\u8fa3\u6761', unit: '1\u5305(100g)', calories: 450, cat: '\u96f6\u98df' },

  // === \u5916\u5356/\u5feb\u9910 ===
  { name: '\u6c49\u5821', unit: '1\u4e2a(200g)', calories: 456, cat: '\u5feb\u9910' },
  { name: '\u85af\u6761(\u5927)', unit: '1\u4efd(150g)', calories: 468, cat: '\u5feb\u9910' },
  { name: '\u70b8\u9e21', unit: '1\u5757(100g)', calories: 289, cat: '\u5feb\u9910' },
  { name: '\u62ab\u8428', unit: '1\u7247(150g)', calories: 320, cat: '\u5feb\u9910' },
  { name: '\u9ebb\u8fa3\u70eb', unit: '1\u4efd(500g)', calories: 350, cat: '\u5feb\u9910' },
  { name: '\u706b\u9505', unit: '1\u987f(\u4f30\u7b97)', calories: 1500, cat: '\u5feb\u9910' },
  { name: '\u9ebb\u8fa3\u9999\u9505', unit: '1\u4efd(400g)', calories: 600, cat: '\u5feb\u9910' },
  { name: '\u9ec4\u7116\u9e21\u7c73\u996d', unit: '1\u4efd', calories: 680, cat: '\u5feb\u9910' },
  { name: '\u6c99\u53bf\u5c0f\u5403(\u9e21\u817f\u996d)', unit: '1\u4efd', calories: 550, cat: '\u5feb\u9910' },
  { name: '\u5170\u5dde\u62c9\u9762', unit: '1\u7897', calories: 500, cat: '\u5feb\u9910' },
  { name: '\u87ba\u86f3\u7c89', unit: '1\u7897', calories: 550, cat: '\u5feb\u9910' },
  { name: '\u7c73\u7ebf', unit: '1\u7897', calories: 480, cat: '\u5feb\u9910' },
  { name: '\u9178\u8fa3\u7c89', unit: '1\u7897', calories: 400, cat: '\u5feb\u9910' },
  { name: '\u51c9\u76ae', unit: '1\u4efd(350g)', calories: 350, cat: '\u5feb\u9910' },

  // === \u5bb6\u5e38\u83dc ===
  { name: '\u897f\u7ea2\u67ff\u7092\u86cb', unit: '1\u4efd(250g)', calories: 210, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u9ebb\u5a46\u8c46\u8150', unit: '1\u4efd(250g)', calories: 290, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u5bab\u4fdd\u9e21\u4e01', unit: '1\u4efd(250g)', calories: 330, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u9c7c\u9999\u8089\u4e1d', unit: '1\u4efd(250g)', calories: 310, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u7cd6\u918b\u91cc\u810a', unit: '1\u4efd(250g)', calories: 410, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u6e05\u84b8\u9c7c', unit: '1\u6761(300g)', calories: 270, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u6c34\u716e\u9c7c', unit: '1\u4efd(400g)', calories: 580, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u9178\u83dc\u9c7c', unit: '1\u4efd(400g)', calories: 480, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u7ea2\u70e7\u6392\u9aa8', unit: '1\u4efd(250g)', calories: 520, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u7092\u9752\u83dc', unit: '1\u4efd(200g)', calories: 60, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u5730\u4e09\u9c9c', unit: '1\u4efd(300g)', calories: 330, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u5e72\u7178\u56db\u5b63\u8c46', unit: '1\u4efd(200g)', calories: 260, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u53ef\u4e50\u9e21\u7fc5', unit: '1\u4efd(300g)', calories: 480, cat: '\u5bb6\u5e38\u83dc' },
  { name: '\u849c\u84c9\u897f\u5170\u82b1', unit: '1\u4efd(200g)', calories: 80, cat: '\u5bb6\u5e38\u83dc' },
];

// \u641c\u7d22\u98df\u7269
function searchFood(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return FOOD_DB.filter(f => f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30);
}

// ============================================================
// \u521d\u59cb\u5316
// ============================================================

let initialized = false;
let weightChart = null;

export async function initWeight() {
  if (initialized) return;
  initialized = true;
}

// ============================================================
// \u4f53\u91cd\u8bb0\u5f55
// ============================================================

async function addWeight(data) {
  const record = {
    id: genId(),
    date: data.date || today(),
    time: data.time,
    weight: parseFloat(data.weight),
    note: data.note || '',
    createdAt: new Date().toISOString(),
  };
  await put('weights', record);
  return record;
}

async function getWeightRecords(days = 30) {
  const all = await getAll('weights');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return all
    .filter(w => new Date(w.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ============================================================
// \u996e\u98df\u8bb0\u5f55
// ============================================================

async function addMeal(data) {
  const meal = {
    id: genId(),
    date: data.date || today(),
    mealType: data.mealType,
    foods: data.foods || [],
    totalCalories: data.totalCalories || 0,
    imageBase64: data.imageBase64 || null,
    source: data.source || 'manual',
    createdAt: new Date().toISOString(),
  };
  await put('meals', meal);
  return meal;
}

async function getTodayMeals() {
  return await getByIndex('meals', 'date', today());
}

async function getWeekMeals() {
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return await getByRange('meals', 'date', fmtDate(weekAgo), fmtDate(now));
}

// ============================================================
// \u6e32\u67d3：\u51cf\u80a5\u7ba1\u7406\u4e3b\u9875\u9762
// ============================================================

let currentTab = 'weight';

export async function renderWeight(container) {
  container.innerHTML = `
    <div class="filter-tabs">
      <button class="filter-tab ${currentTab==='weight'?'active':''}" onclick="window.__weightTab('weight')">\u4f53\u91cd\u8bb0\u5f55</button>
      <button class="filter-tab ${currentTab==='diet'?'active':''}" onclick="window.__weightTab('diet')">\u996e\u98df\u8bb0\u5f55</button>
      <button class="filter-tab ${currentTab==='advice'?'active':''}" onclick="window.__weightTab('advice')">\u996e\u98df\u63a8\u8350</button>
    </div>
    <div id="weight-content"></div>
    <button class="fab" onclick="window.__weightAdd()">+</button>
  `;

  window.__weightTab = (t) => { currentTab = t; renderWeight(container); };
  window.__weightAdd = () => {
    if (currentTab === 'weight') showAddWeightDialog(container);
    else if (currentTab === 'diet') showAddMealDialog(container);
    else showGenerateAdviceDialog(container);
  };

  await renderWeightContent();
}

async function renderWeightContent() {
  const content = document.getElementById('weight-content');
  if (!content) return;

  if (currentTab === 'weight') {
    await renderWeightTab(content);
  } else if (currentTab === 'diet') {
    await renderDietTab(content);
  } else {
    await renderAdviceTab(content);
  }
}

// ============================================================
// \u4f53\u91cd Tab
// ============================================================

async function renderWeightTab(container) {
  const records = await getWeightRecords(30);
  const targetWeight = await getSetting('targetWeight', '');

  const latest = records.length > 0 ? records[records.length - 1] : null;
  const prev = records.length > 1 ? records[records.length - 2] : null;
  const change = latest && prev ? round(latest.weight - prev.weight, 1) : 0;

  container.innerHTML = `
    <div class="weight-display">
      <div class="weight-current">${latest ? latest.weight : '--'}<span class="weight-unit"> kg</span></div>
      ${change !== 0 ? `<div class="weight-change ${change < 0 ? 'down' : 'up'}">${change < 0 ? '↓' : '↑'} ${Math.abs(change)} kg</div>` : ''}
      ${targetWeight ? `<div class="text-sm text-gray mt-8">\u76ee\u6807\u4f53\u91cd：${targetWeight} kg</div>` : ''}
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">? \u4f53\u91cd\u8d8b\u52bf（30\u5929）</span></div>
      <div class="chart-container"><canvas id="weight-chart"></canvas></div>
    </div>

    <div class="card">
      <div class="card-title"><span class="title-left">? \u6700\u8fd1\u8bb0\u5f55</span></div>
      ${records.length > 0 ? `
      <ul class="weight-record-list">
        ${records.slice(-10).reverse().map(r => `
          <li class="weight-record-item" onclick="window.__editWeight('${r.id}')" style="cursor:pointer">
            <div>
              <div class="text-sm font-bold">${r.weight} kg</div>
              <div class="text-xs text-gray">${fmtDate(r.date)} ${r.time === 'morning' ? '?\u65e9\u4e0a' : '?\u665a\u4e0a'}${r.note ? ' · ' + escapeHtml(r.note) : ''}</div>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="task-edit" onclick="event.stopPropagation();window.__editWeight('${r.id}')">?</button>
              <button class="task-delete" onclick="event.stopPropagation();window.__delWeight('${r.id}')">?</button>
            </div>
          </li>
        `).join('')}
      </ul>` : '<div class="empty-state"><div class="empty-icon">??</div><div class="empty-text">\u6682\u65e0\u4f53\u91cd\u8bb0\u5f55</div></div>'}
    </div>
  `;

  window.__delWeight = async (id) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u8bb0\u5f55？')) {
      await del('weights', id);
      renderWeightTab(container);
    }
  };
  window.__editWeight = (id) => showEditWeightDialog(container, id);

  if (records.length > 0) {
    drawWeightChart(records, targetWeight);
  }
}

function drawWeightChart(records, targetWeight) {
  const ctx = document.getElementById('weight-chart');
  if (!ctx) return;
  if (weightChart) weightChart.destroy();

  const dayMap = {};
  records.forEach(r => {
    if (!dayMap[r.date] || new Date(r.createdAt) > new Date(dayMap[r.date].createdAt)) {
      dayMap[r.date] = r;
    }
  });
  const sorted = Object.values(dayMap).sort((a, b) => new Date(a.date) - new Date(b.date));

  const labels = sorted.map(r => fmtDate(r.date).slice(5));
  const data = sorted.map(r => r.weight);

  const datasets = [{
    label: '\u4f53\u91cd (kg)',
    data,
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.1)',
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointBackgroundColor: '#2563eb',
  }];

  if (targetWeight) {
    datasets.push({
      label: '\u76ee\u6807',
      data: sorted.map(() => parseFloat(targetWeight)),
      borderColor: '#10b981',
      borderDash: [5, 5],
      fill: false,
      pointRadius: 0,
    });
  }

  weightChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        y: { ticks: { font: { size: 11 } } },
        x: { ticks: { font: { size: 10 }, maxRotation: 0 } },
      }
    }
  });
}

function round(num, decimals = 1) {
  const f = Math.pow(10, decimals);
  return Math.round(num * f) / f;
}

// ============================================================
// \u6dfb\u52a0\u4f53\u91cd\u5bf9\u8bdd\u6846
// ============================================================

function showAddWeightDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <input type="date" id="weight-date" value="${today()}">
      </div>
      <div class="form-group">
        <label>\u4f53\u91cd (kg)</label>
        <input type="number" id="weight-value" step="0.1" placeholder="\u5982：65.5" autofocus>
      </div>
      <div class="form-group">
        <label>\u79f0\u91cd\u65f6\u95f4</label>
        <select id="weight-time">
          <option value="morning">? \u65e9\u4e0a</option>
          <option value="evening">? \u665a\u4e0a</option>
        </select>
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="weight-note" placeholder="\u5982：\u8fd0\u52a8\u540e、\u7a7a\u8179...">
      </div>
      <button class="btn-primary btn-full" onclick="window.__saveWeight()">\u4fdd\u5b58</button>
    </div>
  `;

  const sheet = openBottomSheet('\u8bb0\u5f55\u4f53\u91cd', html);
  window.__currentSheet = sheet;

  window.__saveWeight = async () => {
    const weight = document.getElementById('weight-value').value;
    if (!weight) { toast('\u8bf7\u8f93\u5165\u4f53\u91cd'); return; }
    const date = document.getElementById('weight-date').value || today();
    const time = document.getElementById('weight-time').value;
    const note = document.getElementById('weight-note').value;
    await addWeight({ weight, date, time, note });
    toast('\u4f53\u91cd\u5df2\u8bb0\u5f55');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };
}

// ============================================================
// \u7f16\u8f91\u4f53\u91cd\u5bf9\u8bdd\u6846
// ============================================================

async function showEditWeightDialog(container, id) {
  const all = await getAll('weights');
  const record = all.find(r => r.id === id);
  if (!record) { toast('\u8bb0\u5f55\u4e0d\u5b58\u5728'); return; }

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <input type="date" id="weight-date" value="${record.date}">
      </div>
      <div class="form-group">
        <label>\u4f53\u91cd (kg)</label>
        <input type="number" id="weight-value" step="0.1" value="${record.weight}">
      </div>
      <div class="form-group">
        <label>\u79f0\u91cd\u65f6\u95f4</label>
        <select id="weight-time">
          <option value="morning" ${record.time==='morning'?'selected':''}>? \u65e9\u4e0a</option>
          <option value="evening" ${record.time==='evening'?'selected':''}>? \u665a\u4e0a</option>
        </select>
      </div>
      <div class="form-group">
        <label>\u5907\u6ce8（\u53ef\u9009）</label>
        <input type="text" id="weight-note" value="${escapeHtml(record.note || '')}">
      </div>
      <button class="btn-primary btn-full" onclick="window.__updateWeight()">\u4fdd\u5b58\u4fee\u6539</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delWeightFromEdit('${id}')">\u5220\u9664\u6b64\u8bb0\u5f55</button>
    </div>
  `;

  const sheet = openBottomSheet('\u7f16\u8f91\u4f53\u91cd', html);

  window.__updateWeight = async () => {
    const weight = document.getElementById('weight-value').value;
    if (!weight) { toast('\u8bf7\u8f93\u5165\u4f53\u91cd'); return; }
    record.date = document.getElementById('weight-date').value || today();
    record.time = document.getElementById('weight-time').value;
    record.weight = parseFloat(weight);
    record.note = document.getElementById('weight-note').value;
    record.updatedAt = new Date().toISOString();
    await put('weights', record);
    toast('\u5df2\u4fee\u6539');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };

  window.__delWeightFromEdit = async (delId) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u8bb0\u5f55？')) {
      await del('weights', delId);
      toast('\u5df2\u5220\u9664');
      sheet.close();
      renderWeight(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// \u996e\u98df Tab
// ============================================================

async function renderDietTab(container) {
  const todayMeals = await getTodayMeals();
  const totalCalories = todayMeals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
  const targetCalories = 1100;

  container.innerHTML = `
    <div class="calorie-summary">
      <div class="calorie-summary-item">
        <div class="calorie-summary-num">${totalCalories}</div>
        <div class="calorie-summary-label">\u4eca\u65e5\u6444\u5165(\u5361)</div>
      </div>
      <div class="calorie-summary-item">
        <div class="calorie-summary-num">${targetCalories}</div>
        <div class="calorie-summary-label">\u5efa\u8bae\u76ee\u6807</div>
      </div>
      <div class="calorie-summary-item">
        <div class="calorie-summary-num">${Math.max(0, targetCalories - totalCalories)}</div>
        <div class="calorie-summary-label">\u5269\u4f59</div>
      </div>
    </div>

    ${todayMeals.length > 0 ? todayMeals.map(m => `
      <div class="meal-card">
        <div class="meal-header" onclick="window.__editMeal('${m.id}')" style="cursor:pointer">
          <span class="meal-type-badge">${m.mealType}</span>
          <span class="meal-calories">${m.totalCalories} \u5361</span>
        </div>
        <div class="meal-foods" onclick="window.__editMeal('${m.id}')" style="cursor:pointer">
          ${(m.foods || []).map(f => `<span class="meal-food-tag">${escapeHtml(f.name)} ${f.calories}\u5361</span>`).join('')}
        </div>
        ${m.imageBase64 ? `<img class="meal-image" src="${m.imageBase64}" alt="\u98df\u7269" onclick="window.__editMeal('${m.id}')">` : ''}
        <div class="flex-between mt-8">
          <span class="text-xs text-gray">${m.source === 'ai' ? '? AI\u8bc6\u522b' : m.source === 'photo' ? '? \u7167\u7247\u8bb0\u5f55' : '?? \u624b\u52a8\u5f55\u5165'} · ${fmtDate(m.date)}</span>
          <div style="display:flex;gap:4px">
            <button class="task-edit" onclick="window.__editMeal('${m.id}')">?</button>
            <button class="task-delete" onclick="window.__delMeal('${m.id}')">?</button>
          </div>
        </div>
      </div>
    `).join('') : '<div class="empty-state"><div class="empty-icon">??</div><div class="empty-text">\u4eca\u5929\u8fd8\u6ca1\u6709\u996e\u98df\u8bb0\u5f55</div></div>'}
  `;

  window.__delMeal = async (id) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u996e\u98df\u8bb0\u5f55？')) {
      await del('meals', id);
      renderDietTab(container);
    }
  };
  window.__editMeal = (id) => showEditMealDialog(container, id);
}

// ============================================================
// \u6dfb\u52a0\u996e\u98df\u5bf9\u8bdd\u6846（\u98df\u7269\u641c\u7d22 + \u624b\u52a8 + \u62cd\u7167）
// ============================================================

function showAddMealDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <input type="date" id="meal-date" value="${today()}">
      </div>
      <div class="form-group">
        <label>\u7528\u9910\u7c7b\u578b</label>
        <select id="meal-type">
          <option value="\u65e9\u9910">? \u65e9\u9910</option>
          <option value="\u5348\u9910">?? \u5348\u9910</option>
          <option value="\u665a\u9910">? \u665a\u9910</option>
          <option value="\u52a0\u9910">? \u52a0\u9910</option>
        </select>
      </div>

      <div class="form-group">
        <label>? \u641c\u7d22\u98df\u7269（\u8f93\u5165\u540d\u79f0\u641c\u7d22\u5185\u7f6e\u6570\u636e\u5e93）</label>
        <input type="text" id="food-search" placeholder="\u5982：\u7c73\u996d、\u9e21\u86cb、\u7ea2\u70e7\u8089..." autocomplete="off">
        <div id="food-search-results" style="max-height:200px;overflow-y:auto;margin-top:8px"></div>
      </div>

      <div class="form-group">
        <label>\u5df2\u9009\u98df\u7269</label>
        <div id="selected-foods-list">
          <div class="text-xs text-gray" id="no-foods-hint">\u5c1a\u672a\u6dfb\u52a0\u98df\u7269，\u8bf7\u641c\u7d22\u5e76\u70b9\u51fb\u6dfb\u52a0</div>
        </div>
        <div class="flex-between mt-8">
          <span class="text-sm text-gray">\u603b\u8ba1：<span id="foods-total-cal" class="font-bold">0</span> \u5361</span>
          <button class="btn-outline" onclick="window.__addManualFoodRow()" style="font-size:13px">+ \u624b\u52a8\u8f93\u5165</button>
        </div>
      </div>

      <div class="form-group">
        <label>\u98df\u7269\u7167\u7247（\u53ef\u9009）</label>
        <div class="meal-photo-area" onclick="document.getElementById('meal-photo-input').click()" style="border:2px dashed var(--gray-300);border-radius:12px;padding:20px;text-align:center;cursor:pointer">
          <div id="meal-photo-preview" class="meal-photo-placeholder">
            <div style="font-size:36px">?</div>
            <div class="text-sm text-gray">\u70b9\u51fb\u62cd\u7167\u6216\u9009\u62e9\u56fe\u7247</div>
            <div class="text-xs text-gray mt-8">\u4e5f\u53ef\u7528AI\u8bc6\u522b\u5361\u8def\u91cc（\u9700\u914d\u7f6eAPI Key）</div>
          </div>
          <input type="file" id="meal-photo-input" accept="image/*" capture="environment" style="display:none">
        </div>
      </div>

      <div id="ai-result-area"></div>

      <div class="flex gap-8 mt-16">
        <button class="btn-outline" style="flex:1" onclick="window.__saveMealOnly()">\u4ec5\u4fdd\u5b58\u7167\u7247</button>
        <button class="btn-primary" style="flex:1" onclick="window.__saveMeal()">\u4fdd\u5b58\u8bb0\u5f55</button>
      </div>
    </div>
  `;

  const sheet = openBottomSheet('\u8bb0\u5f55\u996e\u98df', html);
  window.__currentSheet = sheet;

  let currentImageBase64 = null;
  let recognizedFoods = [];
  let selectedFoods = []; // \u7528\u6237\u5df2\u9009\u7684\u98df\u7269\u5217\u8868

  // ---- \u98df\u7269\u641c\u7d22\u529f\u80fd ----
  const searchInput = document.getElementById('food-search');
  const resultsDiv = document.getElementById('food-search-results');
  let searchTimer;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query.length === 0) {
        resultsDiv.innerHTML = '';
        return;
      }
      const results = searchFood(query);
      if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="text-xs text-gray" style="padding:8px">\u672a\u627e\u5230\u5339\u914d\u98df\u7269，\u53ef\u624b\u52a8\u8f93\u5165</div>';
        return;
      }
      resultsDiv.innerHTML = results.map((f, i) => `
        <div class="food-search-item" onclick="window.__selectFood(${i})" 
             style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100);cursor:pointer;font-size:14px"
             onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
          <div>
            <span style="font-weight:500">${escapeHtml(f.name)}</span>
            <span class="text-xs text-gray" style="margin-left:6px">${escapeHtml(f.unit)}</span>
          </div>
          <span style="font-weight:600;color:var(--warning)">${f.calories} \u5361</span>
        </div>
      `).join('');
      // \u5b58\u50a8\u5f53\u524d\u641c\u7d22\u7ed3\u679c\u4f9b\u9009\u62e9\u4f7f\u7528
      window.__currentSearchResults = results;
    }, 200);
  });

  window.__currentSearchResults = [];

  window.__selectFood = (idx) => {
    const food = window.__currentSearchResults[idx];
    if (!food) return;
    // \u6dfb\u52a0\u5230\u5df2\u9009\u5217\u8868
    selectedFoods.push({ name: food.name, unit: food.unit, calories: food.calories, grams: 0 });
    renderSelectedFoods();
    searchInput.value = '';
    resultsDiv.innerHTML = '';
    searchInput.focus();
  };

  function renderSelectedFoods() {
    const list = document.getElementById('selected-foods-list');
    const hint = document.getElementById('no-foods-hint');
    if (selectedFoods.length === 0) {
      list.innerHTML = '<div class="text-xs text-gray" id="no-foods-hint">\u5c1a\u672a\u6dfb\u52a0\u98df\u7269，\u8bf7\u641c\u7d22\u5e76\u70b9\u51fb\u6dfb\u52a0</div>';
    } else {
      list.innerHTML = selectedFoods.map((f, i) => `
        <div class="selected-food-row" style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--gray-50);border-radius:8px;margin-bottom:6px">
          <div style="flex:1">
            <div class="text-sm">${escapeHtml(f.name)}</div>
            <div class="text-xs text-gray">${escapeHtml(f.unit)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:600;font-size:14px;color:var(--warning);white-space:nowrap">${f.calories} \u5361</span>
            <button onclick="window.__removeSelectedFood(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:2px 6px">?</button>
          </div>
        </div>
      `).join('');
    }
    // \u66f4\u65b0\u603b\u5361\u8def\u91cc
    const total = selectedFoods.reduce((sum, f) => sum + f.calories, 0);
    document.getElementById('foods-total-cal').textContent = total;
  }

  window.__removeSelectedFood = (idx) => {
    selectedFoods.splice(idx, 1);
    renderSelectedFoods();
  };

  // ---- \u624b\u52a8\u8f93\u5165 ----
  window.__addManualFoodRow = () => {
    const list = document.getElementById('selected-foods-list');
    // \u9690\u85cf\u63d0\u793a
    const hint = document.getElementById('no-foods-hint');
    if (hint) hint.remove();

    const row = document.createElement('div');
    row.className = 'manual-food-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px;background:var(--warning-bg);border-radius:8px;margin-bottom:6px';
    row.innerHTML = `
      <input type="text" placeholder="\u98df\u7269\u540d" style="flex:1;padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px" data-manual-name>
      <input type="number" placeholder="\u5361\u8def\u91cc" style="width:70px;padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px" data-manual-cal>
      <button onclick="this.parentElement.remove();window.__recalcManualTotal()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:2px">?</button>
    `;
    list.appendChild(row);
  };

  window.__recalcManualTotal = () => {
    let manualTotal = 0;
    document.querySelectorAll('[data-manual-cal]').forEach(input => {
      manualTotal += parseInt(input.value) || 0;
    });
    const dbTotal = selectedFoods.reduce((sum, f) => sum + f.calories, 0);
    document.getElementById('foods-total-cal').textContent = dbTotal + manualTotal;
  };

  // \u76d1\u542c\u624b\u52a8\u8f93\u5165\u53d8\u5316
  document.getElementById('selected-foods-list').addEventListener('input', (e) => {
    if (e.target.dataset.manualCal) {
      window.__recalcManualTotal();
    }
  });

  // ---- \u62cd\u7167 + AI \u8bc6\u522b ----
  document.getElementById('meal-photo-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('meal-photo-preview');
    preview.innerHTML = '<div class="spinner"></div><p>\u5904\u7406\u4e2d...</p>';

    try {
      currentImageBase64 = await compressImage(file, 800);
      preview.innerHTML = `<img src="${currentImageBase64}" style="width:100%;border-radius:8px">`;

      const resultArea = document.getElementById('ai-result-area');
      resultArea.innerHTML = '<div class="text-sm text-gray" style="padding:12px">? AI\u8bc6\u522b\u4e2d...</div>';

      const result = await recognizeFood(currentImageBase64);
      if (result.success) {
        recognizedFoods = result.data.foods;
        resultArea.innerHTML = `
          <div class="card" style="margin:0;background:var(--success-bg);box-shadow:none">
            <div class="flex-between mb-8">
              <span class="font-bold" style="color:var(--success)">? AI\u8bc6\u522b\u6210\u529f</span>
              <span class="font-bold">${result.data.totalCalories} \u5361</span>
            </div>
            <div id="recognized-foods">
              ${result.data.foods.map((f, i) => `
                <div class="flex-between text-sm" style="padding:4px 0">
                  <input type="text" value="${escapeHtml(f.name)}" style="flex:1;border:none;background:transparent;font-size:14px" data-food-idx="${i}" data-field="name">
                  <input type="number" value="${f.calories}" style="width:60px;text-align:right;border:1px solid var(--gray-200);border-radius:4px;padding:2px 4px;font-size:13px" data-food-idx="${i}" data-field="calories">
                  <span class="text-xs text-gray">\u5361</span>
                  <button onclick="window.__addAiFoodToSelected(${i})" style="background:var(--success);color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:12px;cursor:pointer;margin-left:8px">+\u6dfb\u52a0</button>
                </div>
              `).join('')}
            </div>
            <div class="text-xs text-gray mt-8">${result.data.description || ''}</div>
          </div>
        `;
      } else if (result.error === 'NO_API_KEY') {
        resultArea.innerHTML = `
          <div class="card" style="margin:0;background:var(--warning-bg);box-shadow:none">
            <div class="text-sm" style="color:var(--warning)">
              ?? ${result.message}
            </div>
            <div class="text-xs text-gray mt-8">\u53ef\u4f7f\u7528\u4e0a\u65b9\u98df\u7269\u641c\u7d22\u529f\u80fd\u67e5\u627e\u5361\u8def\u91cc</div>
          </div>
        `;
      } else {
        resultArea.innerHTML = `<div class="text-sm" style="color:var(--danger)">? \u8bc6\u522b\u5931\u8d25：${escapeHtml(result.error)}</div>`;
      }
    } catch (err) {
      preview.innerHTML = '<div style="color:var(--danger)">\u56fe\u7247\u5904\u7406\u5931\u8d25</div>';
    }
  };

  window.__addAiFoodToSelected = (idx) => {
    const f = recognizedFoods[idx];
    if (!f) return;
    selectedFoods.push({ name: f.name, unit: '', calories: f.calories, grams: f.grams || 0 });
    renderSelectedFoods();
  };

  // ---- \u4fdd\u5b58 ----
  window.__saveMeal = async () => {
    const date = document.getElementById('meal-date').value || today();
    const mealType = document.getElementById('meal-type').value;
    const foods = [...selectedFoods];

    // \u6536\u96c6\u624b\u52a8\u8f93\u5165
    document.querySelectorAll('.manual-food-row').forEach(row => {
      const nameInput = row.querySelector('[data-manual-name]');
      const calInput = row.querySelector('[data-manual-cal]');
      const name = nameInput ? nameInput.value.trim() : '';
      const cal = calInput ? parseInt(calInput.value) || 0 : 0;
      if (name) foods.push({ name, calories: cal, grams: 0, unit: '' });
    });

    if (foods.length === 0) {
      toast('\u8bf7\u6dfb\u52a0\u81f3\u5c11\u4e00\u79cd\u98df\u7269');
      return;
    }

    const totalCalories = foods.reduce((sum, f) => sum + (f.calories || 0), 0);
    await addMeal({
      date,
      mealType,
      foods,
      totalCalories,
      imageBase64: currentImageBase64,
      source: currentImageBase64 ? 'manual' : 'manual',
    });

    toast('\u996e\u98df\u5df2\u8bb0\u5f55');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };

  window.__saveMealOnly = async () => {
    if (!currentImageBase64) {
      toast('\u8bf7\u5148\u4e0a\u4f20\u98df\u7269\u7167\u7247');
      return;
    }
    const date = document.getElementById('meal-date').value || today();
    const mealType = document.getElementById('meal-type').value;
    await addMeal({
      date,
      mealType,
      foods: [],
      totalCalories: 0,
      imageBase64: currentImageBase64,
      source: 'photo',
    });
    toast('\u7167\u7247\u5df2\u4fdd\u5b58');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };
}

// ============================================================
// \u7f16\u8f91\u996e\u98df\u5bf9\u8bdd\u6846（\u542b\u98df\u7269\u641c\u7d22）
// ============================================================

async function showEditMealDialog(container, id) {
  const all = await getAll('meals');
  const meal = all.find(m => m.id === id);
  if (!meal) { toast('\u8bb0\u5f55\u4e0d\u5b58\u5728'); return; }

  const html = `
    <div class="settings-form">
      <div class="form-group">
        <label>\u65e5\u671f</label>
        <input type="date" id="meal-date" value="${meal.date}">
      </div>
      <div class="form-group">
        <label>\u7528\u9910\u7c7b\u578b</label>
        <select id="meal-type">
          <option value="\u65e9\u9910" ${meal.mealType==='\u65e9\u9910'?'selected':''}>? \u65e9\u9910</option>
          <option value="\u5348\u9910" ${meal.mealType==='\u5348\u9910'?'selected':''}>?? \u5348\u9910</option>
          <option value="\u665a\u9910" ${meal.mealType==='\u665a\u9910'?'selected':''}>? \u665a\u9910</option>
          <option value="\u52a0\u9910" ${meal.mealType==='\u52a0\u9910'?'selected':''}>? \u52a0\u9910</option>
        </select>
      </div>

      <div class="form-group">
        <label>? \u641c\u7d22\u98df\u7269\u6dfb\u52a0\u5230\u5217\u8868</label>
        <input type="text" id="edit-food-search" placeholder="\u5982：\u7c73\u996d、\u9e21\u86cb、\u7ea2\u70e7\u8089..." autocomplete="off">
        <div id="edit-food-search-results" style="max-height:200px;overflow-y:auto;margin-top:8px"></div>
      </div>

      <div class="form-group">
        <label>\u98df\u7269\u5217\u8868</label>
        <div id="edit-foods-list"></div>
        <div class="flex-between mt-8">
          <span class="text-sm text-gray">\u603b\u8ba1：<span id="edit-foods-total" class="font-bold">${meal.totalCalories || 0}</span> \u5361</span>
          <button class="btn-outline" onclick="window.__addEditManualFood()" style="font-size:13px">+ \u624b\u52a8\u8f93\u5165</button>
        </div>
      </div>

      ${meal.imageBase64 ? `
      <div class="form-group">
        <label>\u5df2\u6709\u7167\u7247</label>
        <img src="${meal.imageBase64}" style="max-height:120px;border-radius:8px">
      </div>
      ` : ''}
      <button class="btn-primary btn-full" onclick="window.__updateMeal()">\u4fdd\u5b58\u4fee\u6539</button>
      <button class="btn-danger-outline btn-full mt-8" onclick="window.__delMealFromEdit('${id}')">\u5220\u9664\u6b64\u8bb0\u5f55</button>
    </div>
  `;

  const sheet = openBottomSheet('\u7f16\u8f91\u996e\u98df', html);

  // \u5f53\u524d\u7f16\u8f91\u4e2d\u7684\u98df\u7269\u5217\u8868（\u4ece\u5df2\u6709\u8bb0\u5f55\u521d\u59cb\u5316）
  let editFoods = (meal.foods || []).map(f => ({ ...f }));

  function renderEditFoods() {
    const list = document.getElementById('edit-foods-list');
    if (editFoods.length === 0) {
      list.innerHTML = '<div class="text-xs text-gray">\u6682\u65e0\u98df\u7269，\u8bf7\u641c\u7d22\u6dfb\u52a0</div>';
    } else {
      list.innerHTML = editFoods.map((f, i) => `
        <div class="edit-food-row" style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--gray-50);border-radius:8px;margin-bottom:6px">
          <div style="flex:1">
            <input type="text" value="${escapeHtml(f.name)}" style="border:none;background:transparent;font-size:14px;font-weight:500;width:100%" data-edit-name="${i}">
            <div class="text-xs text-gray">${escapeHtml(f.unit || '')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" value="${f.calories}" style="width:65px;text-align:right;border:1px solid var(--gray-200);border-radius:4px;padding:2px 4px;font-size:13px" data-edit-cal="${i}">
            <span class="text-xs text-gray">\u5361</span>
            <button onclick="window.__removeEditFood(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:2px 6px">?</button>
          </div>
        </div>
      `).join('');
    }
    // \u66f4\u65b0\u603b\u8ba1
    const total = editFoods.reduce((sum, f) => sum + (parseInt(f.calories) || 0), 0);
    document.getElementById('edit-foods-total').textContent = total;
  }

  renderEditFoods();

  // \u76d1\u542c\u98df\u7269\u540d\u548c\u5361\u8def\u91cc\u7684\u7f16\u8f91
  document.getElementById('edit-foods-list').addEventListener('input', (e) => {
    if (e.target.dataset.editName !== undefined) {
      editFoods[parseInt(e.target.dataset.editName)].name = e.target.value;
    }
    if (e.target.dataset.editCal !== undefined) {
      const idx = parseInt(e.target.dataset.editCal);
      editFoods[idx].calories = parseInt(e.target.value) || 0;
      // \u66f4\u65b0\u603b\u8ba1
      const total = editFoods.reduce((sum, f) => sum + (parseInt(f.calories) || 0), 0);
      document.getElementById('edit-foods-total').textContent = total;
    }
  });

  window.__removeEditFood = (idx) => {
    editFoods.splice(idx, 1);
    renderEditFoods();
  };

  window.__addEditManualFood = () => {
    editFoods.push({ name: '', unit: '', calories: 0, grams: 0 });
    renderEditFoods();
    // \u805a\u7126\u5230\u65b0\u6dfb\u52a0\u7684\u98df\u7269\u540d\u8f93\u5165\u6846
    setTimeout(() => {
      const inputs = document.querySelectorAll('[data-edit-name]');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 100);
  };

  // ---- \u98df\u7269\u641c\u7d22 ----
  const editSearchInput = document.getElementById('edit-food-search');
  const editResultsDiv = document.getElementById('edit-food-search-results');
  let editSearchTimer;

  editSearchInput.addEventListener('input', () => {
    clearTimeout(editSearchTimer);
    editSearchTimer = setTimeout(() => {
      const query = editSearchInput.value.trim();
      if (query.length === 0) {
        editResultsDiv.innerHTML = '';
        return;
      }
      const results = searchFood(query);
      if (results.length === 0) {
        editResultsDiv.innerHTML = '<div class="text-xs text-gray" style="padding:8px">\u672a\u627e\u5230\u5339\u914d\u98df\u7269</div>';
        return;
      }
      editResultsDiv.innerHTML = results.map((f, i) => `
        <div class="food-search-item" onclick="window.__editSelectFood(${i})" 
             style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100);cursor:pointer;font-size:14px"
             onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
          <div>
            <span style="font-weight:500">${escapeHtml(f.name)}</span>
            <span class="text-xs text-gray" style="margin-left:6px">${escapeHtml(f.unit)}</span>
          </div>
          <span style="font-weight:600;color:var(--warning)">${f.calories} \u5361</span>
        </div>
      `).join('');
      window.__editCurrentResults = results;
    }, 200);
  });

  window.__editCurrentResults = [];

  window.__editSelectFood = (idx) => {
    const food = window.__editCurrentResults[idx];
    if (!food) return;
    editFoods.push({ name: food.name, unit: food.unit, calories: food.calories, grams: 0 });
    renderEditFoods();
    editSearchInput.value = '';
    editResultsDiv.innerHTML = '';
  };

  // ---- \u4fdd\u5b58\u4fee\u6539 ----
  window.__updateMeal = async () => {
    const date = document.getElementById('meal-date').value || today();
    const mealType = document.getElementById('meal-type').value;

    // \u4ece DOM \u6536\u96c6\u6700\u65b0\u6570\u636e
    const foods = [];
    document.querySelectorAll('[data-edit-name]').forEach((input, i) => {
      const name = input.value.trim();
      const calInput = document.querySelector(`[data-edit-cal="${i}"]`);
      const cal = calInput ? parseInt(calInput.value) || 0 : 0;
      if (name) foods.push({ name, calories: cal, grams: 0, unit: editFoods[i]?.unit || '' });
    });

    const totalCalories = foods.reduce((sum, f) => sum + (f.calories || 0), 0);

    meal.date = date;
    meal.mealType = mealType;
    meal.foods = foods;
    meal.totalCalories = totalCalories;
    meal.updatedAt = new Date().toISOString();
    await put('meals', meal);
    toast('\u5df2\u4fee\u6539');
    sheet.close();
    renderWeight(document.getElementById('main-content'));
  };

  window.__delMealFromEdit = async (delId) => {
    if (await confirmDialog('\u5220\u9664\u8fd9\u6761\u996e\u98df\u8bb0\u5f55？')) {
      await del('meals', delId);
      toast('\u5df2\u5220\u9664');
      sheet.close();
      renderWeight(document.getElementById('main-content'));
    }
  };
}

// ============================================================
// \u996e\u98df\u63a8\u8350 Tab
// ============================================================

async function renderAdviceTab(container) {
  const cachedAdvice = await getSetting('lastDietAdvice', null);
  const adviceDate = await getSetting('lastAdviceDate', '');

  container.innerHTML = `
    <div id="advice-content">
      ${cachedAdvice ? renderAdviceContent(cachedAdvice, adviceDate) : `
        <div class="empty-state">
          <div class="empty-icon">?</div>
          <div class="empty-text">\u6682\u65e0\u996e\u98df\u63a8\u8350</div>
          <div class="text-xs text-gray mt-8">\u70b9\u51fb\u53f3\u4e0b\u89d2 + \u751f\u6210\u6bcf\u5468\u996e\u98df\u63a8\u8350</div>
        </div>
      `}
    </div>
  `;
}

function renderAdviceContent(advice, dateStr) {
  const isRuleBased = advice.source === 'rule-based';
  return `
    <div class="card">
      <div class="flex-between mb-8">
        <span class="font-bold">? \u996e\u98df\u63a8\u8350</span>
        <span class="text-xs text-gray">${dateStr || ''} ${isRuleBased ? '· \u57fa\u7840\u7248' : '· AI\u7248'}</span>
      </div>

      ${advice.assessment ? `
      <div class="mb-16">
        <div class="text-sm font-bold mb-8">? \u672c\u5468\u8bc4\u4f30</div>
        <div class="text-sm" style="color:var(--gray-600);line-height:1.6">${escapeHtml(advice.assessment)}</div>
      </div>` : ''}

      ${advice.advice ? `
      <div class="mb-16">
        <div class="text-sm font-bold mb-8">? \u5065\u5eb7\u5efa\u8bae</div>
        <div class="text-sm" style="color:var(--gray-600);line-height:1.6">${escapeHtml(advice.advice)}</div>
      </div>` : ''}
    </div>

    ${advice.recommendations ? `
    <div class="card">
      <div class="card-title"><span class="title-left">?? \u63a8\u8350\u98df\u8c31</span></div>
      ${advice.recommendations.breakfast ? `
        <div class="mb-16">
          <div class="text-sm font-bold text-warning mb-8">? \u65e9\u9910</div>
          ${advice.recommendations.breakfast.map(m => `<div class="text-sm" style="padding:4px 0">? ${escapeHtml(m.name)} <span class="text-gray">(${m.calories}\u5361)</span></div>`).join('')}
        </div>` : ''}
      ${advice.recommendations.lunch ? `
        <div class="mb-16">
          <div class="text-sm font-bold text-warning mb-8">?? \u5348\u9910</div>
          ${advice.recommendations.lunch.map(m => `<div class="text-sm" style="padding:4px 0">? ${escapeHtml(m.name)} <span class="text-gray">(${m.calories}\u5361)</span></div>`).join('')}
        </div>` : ''}
      ${advice.recommendations.dinner ? `
        <div class="mb-16">
          <div class="text-sm font-bold text-warning mb-8">? \u665a\u9910</div>
          ${advice.recommendations.dinner.map(m => `<div class="text-sm" style="padding:4px 0">? ${escapeHtml(m.name)} <span class="text-gray">(${m.calories}\u5361)</span></div>`).join('')}
        </div>` : ''}
    </div>` : ''}

    ${advice.avoid ? `
    <div class="card">
      <div class="card-title"><span class="title-left">? \u9700\u907f\u514d\u98df\u7269</span></div>
      ${advice.avoid.map(a => `<div class="text-sm" style="padding:4px 0;color:var(--danger)">? ${escapeHtml(typeof a === 'string' ? a : a.name)}</div>`).join('')}
    </div>` : ''}

    ${advice.recommend ? `
    <div class="card">
      <div class="card-title"><span class="title-left">? \u63a8\u8350\u98df\u7269</span></div>
      ${advice.recommend.map(r => `<div class="text-sm" style="padding:4px 0;color:var(--success)">? ${escapeHtml(typeof r === 'string' ? r : r.name)}</div>`).join('')}
    </div>` : ''}
  `;
}

// ============================================================
// \u751f\u6210\u996e\u98df\u63a8\u8350
// ============================================================

function showGenerateAdviceDialog(container) {
  const html = `
    <div class="settings-form">
      <div class="text-sm" style="color:var(--gray-600);line-height:1.6;margin-bottom:16px">
        \u5c06\u6839\u636e\u4f60\u672c\u5468\u7684\u996e\u98df\u8bb0\u5f55、\u4f53\u91cd\u53d8\u5316\u548c\u5065\u5eb7\u6307\u6807（\u4f4e\u5bc6\u5ea6\u8102\u86cb\u767d\u8fc7\u9ad8、\u80c6\u56fa\u9187\u8fc7\u9ad8）\u751f\u6210\u4e2a\u6027\u5316\u996e\u98df\u63a8\u8350。
      </div>
      <div class="form-group">
        <label>\u751f\u6210\u65b9\u5f0f</label>
        <select id="advice-mode">
          <option value="ai">? AI\u751f\u6210（\u9700\u914d\u7f6eAPI Key，\u66f4\u7cbe\u51c6）</option>
          <option value="rule">? \u57fa\u7840\u7248（\u57fa\u4e8e\u5065\u5eb7\u6307\u6807，\u65e0\u9700API Key）</option>
        </select>
      </div>
      <button class="btn-primary btn-full" onclick="window.__genAdvice()">\u751f\u6210\u63a8\u8350</button>
    </div>
  `;

  const sheet = openBottomSheet('\u751f\u6210\u996e\u98df\u63a8\u8350', html);
  window.__currentSheet = sheet;

  window.__genAdvice = async () => {
    const mode = document.getElementById('advice-mode').value;
    sheet.close();

    const content = document.getElementById('weight-content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div><p>\u751f\u6210\u4e2d...</p></div>';

    const weekMeals = await getWeekMeals();
    const weightRecords = await getWeightRecords(7);
    const healthProfile = await getSetting('healthProfile', {
      healthIndicators: ['\u4f4e\u5bc6\u5ea6\u8102\u86cb\u767d\u8fc7\u9ad8', '\u80c6\u56fa\u9187\u8fc7\u9ad8'],
      dietRestrictions: ['\u4f4e\u80c6\u56fa\u9187', '\u4f4e\u9971\u548c\u8102\u80aa', '\u9ad8\u7ea4\u7ef4', '\u5c11\u6cb9\u70b8'],
    });

    let weightTrend = null;
    if (weightRecords.length >= 2) {
      const sorted = weightRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
      weightTrend = {
        start: sorted[0].weight,
        end: sorted[sorted.length - 1].weight,
        diff: round(sorted[sorted.length - 1].weight - sorted[0].weight, 1),
      };
    }

    let result;
    if (mode === 'rule') {
      result = { success: true, data: ruleBasedDietAdvice(weekMeals, healthProfile) };
    } else {
      result = await generateDietRecommendation(weekMeals, weightTrend, healthProfile);
      if (!result.success && result.error === 'NO_API_KEY') {
        result = { success: true, data: ruleBasedDietAdvice(weekMeals, healthProfile) };
        toast('\u672a\u914d\u7f6eAPI Key，\u5df2\u4f7f\u7528\u57fa\u7840\u7248\u63a8\u8350');
      }
    }

    if (result.success) {
      await setSetting('lastDietAdvice', result.data);
      await setSetting('lastAdviceDate', fmtDate(new Date()));
      renderAdviceTab(content);
      toast('\u996e\u98df\u63a8\u8350\u5df2\u751f\u6210');
    } else {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">?</div><div class="empty-text">\u751f\u6210\u5931\u8d25：${escapeHtml(result.error)}</div></div>`;
    }
  };
}

// ============================================================
// \u9996\u9875 Dashboard \u5361\u7247
// ============================================================

export async function dashboardWeight() {
  const records = await getWeightRecords(7);
  const latest = records.length > 0 ? records[records.length - 1] : null;
  const prev = records.length > 1 ? records[0] : null;
  const change = latest && prev ? round(latest.weight - prev.weight, 1) : 0;

  const todayMeals = await getTodayMeals();
  const totalCalories = todayMeals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);

  return `
    <div class="dash-card" onclick="window.__navigate('weight')" style="cursor:pointer">
      <div class="dash-card-header">
        <div class="dash-card-title">?? \u5065\u5eb7\u7ba1\u7406</div>
        <div class="dash-card-more">\u67e5\u770b\u8be6\u60c5 ?</div>
      </div>
      <div class="dash-stats">
        <div class="dash-stat primary">
          <div class="dash-stat-num">${latest ? latest.weight : '--'}</div>
          <div class="dash-stat-label">\u5f53\u524d\u4f53\u91cd(kg)</div>
        </div>
        <div class="dash-stat ${change < 0 ? 'success' : change > 0 ? 'danger' : ''}">
          <div class="dash-stat-num">${change === 0 ? '--' : (change < 0 ? '↓' : '↑') + Math.abs(change)}</div>
          <div class="dash-stat-label">\u672c\u5468\u53d8\u5316</div>
        </div>
        <div class="dash-stat warning">
          <div class="dash-stat-num">${totalCalories}</div>
          <div class="dash-stat-label">\u4eca\u65e5\u5361\u8def\u91cc</div>
        </div>
      </div>
    </div>
  `;
}
