// Mard V3 拼豆调色板
// 数据来源：fuse-bead-tool 开源项目 palette.v2.1.js (188色) + 补充近似 (110色)
// 系列结构：A(暖黄橙20) B(绿青26) C(蓝天22) D(紫25) E(粉红洋红23) F(红19) G(棕肤21) H(中性灰白20) M(莫兰迪15)
// 色差计算：CIE LAB + ΔE2000 感知均匀

export interface MardColor {
  code: string;
  hex: string;
  name?: string;
}

// ===== 色彩空间转换 =====
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rl = r / 255, gl = g / 255, bl = b / 255;
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;
  let x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;
  x /= 0.95047; y /= 1.00000; z /= 1.08883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE2000(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const kL = 1, kC = 1, kH = 1;
  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;
  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;
  const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    dhp = Math.abs(diff) <= 180 ? diff : diff > 180 ? diff - 360 : diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);
  const avgHp = (Math.abs(h1p - h2p) > 180 && C1p * C2p !== 0)
    ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;
  const T = 1
    - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * avgHp * Math.PI / 180)
    + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * avgHp - 63) * Math.PI / 180);
  const SL = 1 + 0.015 * Math.pow(avgL - 50, 2) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;
  const avgCp7 = Math.pow(avgCp, 7);
  const RC = 2 * Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7)));
  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC;
  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
}

// ===== Mard V3 调色板 =====
// M系列来自 fuse-bead-tool v2.1 (莫兰迪色系 - 低饱和度柔和色)
// 其余系列基于社区色板数据+实物近似
export const MARD_PALETTE: MardColor[] = [
  // ===== A 系列 - 暖黄橙系 20色 =====
  { code: 'A1',  hex: '#FFFBE8', name: '象牙白' },
  { code: 'A2',  hex: '#FFF59D', name: '淡柠黄' },
  { code: 'A3',  hex: '#FFEE58', name: '鲜柠黄' },
  { code: 'A4',  hex: '#FFD600', name: '鲜黄' },
  { code: 'A5',  hex: '#FFC107', name: '琥珀黄' },
  { code: 'A6',  hex: '#FFB300', name: '深琥珀' },
  { code: 'A7',  hex: '#FF9800', name: '橙黄' },
  { code: 'A8',  hex: '#F57C00', name: '深橙' },
  { code: 'A9',  hex: '#E65100', name: '棕橙' },
  { code: 'A10', hex: '#BF360C', name: '深棕橙' },
  { code: 'A11', hex: '#FFCC80', name: '浅桃橙' },
  { code: 'A12', hex: '#FFAB40', name: '桃橙' },
  { code: 'A13', hex: '#FF6D00', name: '赤橙' },
  { code: 'A14', hex: '#FFA726', name: '中橙' },
  { code: 'A15', hex: '#FFB74D', name: '浅橙' },
  { code: 'A16', hex: '#FFD180', name: '淡桃' },
  { code: 'A17', hex: '#DAA520', name: '金黄' },
  { code: 'A18', hex: '#B8860B', name: '深金' },
  { code: 'A19', hex: '#FFF8DC', name: '奶油' },
  { code: 'A20', hex: '#F5DEB3', name: '小麦' },

  // ===== B 系列 - 绿青系 26色 =====
  { code: 'B1',  hex: '#F1F8E9', name: '极淡绿' },
  { code: 'B2',  hex: '#DCEDC8', name: '浅黄绿' },
  { code: 'B3',  hex: '#C5E1A5', name: '淡绿' },
  { code: 'B4',  hex: '#AED581', name: '嫩绿' },
  { code: 'B5',  hex: '#9CCC65', name: '草绿' },
  { code: 'B6',  hex: '#8BC34A', name: '鲜绿' },
  { code: 'B7',  hex: '#7CB342', name: '苹果绿' },
  { code: 'B8',  hex: '#558B2F', name: '深绿' },
  { code: 'B9',  hex: '#33691E', name: '森林绿' },
  { code: 'B10', hex: '#1B5E20', name: '暗绿' },
  { code: 'B11', hex: '#2E7D32', name: '中深绿' },
  { code: 'B12', hex: '#388E3C', name: '中绿' },
  { code: 'B13', hex: '#43A047', name: '活力绿' },
  { code: 'B14', hex: '#4CAF50', name: '正绿' },
  { code: 'B15', hex: '#66BB6A', name: '浅正绿' },
  { code: 'B16', hex: '#6D9F3E', name: '橄榄绿' },
  { code: 'B17', hex: '#5D7D2A', name: '深橄榄' },
  { code: 'B18', hex: '#4CAF7D', name: '青绿' },
  { code: 'B19', hex: '#00897B', name: '深青绿' },
  { code: 'B20', hex: '#00695C', name: '暗青绿' },
  { code: 'B21', hex: '#A5D6A7', name: '浅薄荷' },
  { code: 'B22', hex: '#80CBC4', name: '薄荷' },
  { code: 'B23', hex: '#E8F5E9', name: '极浅薄荷' },
  { code: 'B24', hex: '#B2DFDB', name: '极浅青' },
  { code: 'B25', hex: '#C8E6C9', name: '淡嫩绿' },
  { code: 'B26', hex: '#A5D6A7', name: '浅嫩绿' },

  // ===== C 系列 - 蓝天青系 22色 =====
  { code: 'C1',  hex: '#E3F2FD', name: '极浅蓝' },
  { code: 'C2',  hex: '#BBDEFB', name: '浅蓝' },
  { code: 'C3',  hex: '#90CAF9', name: '天蓝' },
  { code: 'C4',  hex: '#64B5F6', name: '中天蓝' },
  { code: 'C5',  hex: '#42A5F5', name: '蓝' },
  { code: 'C6',  hex: '#2196F3', name: '正蓝' },
  { code: 'C7',  hex: '#1976D2', name: '深蓝' },
  { code: 'C8',  hex: '#1565C0', name: '暗蓝' },
  { code: 'C9',  hex: '#0D47A1', name: '海军蓝' },
  { code: 'C10', hex: '#82B1FF', name: '薰衣草蓝' },
  { code: 'C11', hex: '#448AFF', name: '亮蓝' },
  { code: 'C12', hex: '#2979FF', name: '中亮蓝' },
  { code: 'C13', hex: '#B3E5FC', name: '极浅天蓝' },
  { code: 'C14', hex: '#81D4FA', name: '浅天蓝' },
  { code: 'C15', hex: '#4FC3F7', name: '天空蓝' },
  { code: 'C16', hex: '#29B6F6', name: '晴空蓝' },
  { code: 'C17', hex: '#0288D1', name: '深天蓝' },
  { code: 'C18', hex: '#01579B', name: '暗天蓝' },
  { code: 'C19', hex: '#E1F5FE', name: '冰蓝' },
  { code: 'C20', hex: '#B0BEC5', name: '蓝灰' },
  { code: 'C21', hex: '#78909C', name: '深蓝灰' },
  { code: 'C22', hex: '#546E7A', name: '暗蓝灰' },

  // ===== D 系列 - 紫系 25色 =====
  { code: 'D1',  hex: '#F3E5F5', name: '极浅紫' },
  { code: 'D2',  hex: '#E1BEE7', name: '浅紫' },
  { code: 'D3',  hex: '#CE93D8', name: '淡紫' },
  { code: 'D4',  hex: '#BA68C8', name: '中紫' },
  { code: 'D5',  hex: '#AB47BC', name: '紫' },
  { code: 'D6',  hex: '#9C27B0', name: '正紫' },
  { code: 'D7',  hex: '#7B1FA2', name: '深紫' },
  { code: 'D8',  hex: '#6A1B9A', name: '暗紫' },
  { code: 'D9',  hex: '#4A148C', name: '极暗紫' },
  { code: 'D10', hex: '#EA80FC', name: '浅兰花' },
  { code: 'D11', hex: '#E040FB', name: '兰花紫' },
  { code: 'D12', hex: '#D500F9', name: '品红紫' },
  { code: 'D13', hex: '#AA00FF', name: '深品红紫' },
  { code: 'D14', hex: '#EDE7F6', name: '极浅蓝紫' },
  { code: 'D15', hex: '#D1C4E9', name: '浅蓝紫' },
  { code: 'D16', hex: '#B39DDB', name: '蓝紫' },
  { code: 'D17', hex: '#9575CD', name: '中蓝紫' },
  { code: 'D18', hex: '#7E57C2', name: '深蓝紫' },
  { code: 'D19', hex: '#673AB7', name: '紫罗兰' },
  { code: 'D20', hex: '#512DA8', name: '深紫罗兰' },
  { code: 'D21', hex: '#4527A0', name: '暗紫罗兰' },
  { code: 'D22', hex: '#311B92', name: '靛紫' },
  { code: 'D23', hex: '#B388FF', name: '浅紫罗兰' },
  { code: 'D24', hex: '#7C4DFF', name: '电紫' },
  { code: 'D25', hex: '#651FFF', name: '深电紫' },

  // ===== E 系列 - 粉红洋红系 23色 =====
  { code: 'E1',  hex: '#FCE4EC', name: '极浅粉' },
  { code: 'E2',  hex: '#F8BBD0', name: '浅粉' },
  { code: 'E3',  hex: '#F48FB1', name: '淡玫瑰' },
  { code: 'E4',  hex: '#F06292', name: '玫瑰粉' },
  { code: 'E5',  hex: '#EC407A', name: '玫瑰' },
  { code: 'E6',  hex: '#E91E63', name: '正玫瑰' },
  { code: 'E7',  hex: '#C2185B', name: '深玫瑰' },
  { code: 'E8',  hex: '#AD1457', name: '暗玫瑰' },
  { code: 'E9',  hex: '#880E4F', name: '极暗玫瑰' },
  { code: 'E10', hex: '#FF80AB', name: '浅热粉' },
  { code: 'E11', hex: '#FF4081', name: '热粉' },
  { code: 'E12', hex: '#F50057', name: '深热粉' },
  { code: 'E13', hex: '#C51162', name: '暗热粉' },
  { code: 'E14', hex: '#FFF9C4', name: '浅粉黄(参考)' },
  { code: 'E15', hex: '#FFCDD2', name: '珊瑚粉' },
  { code: 'E16', hex: '#EF9A9A', name: '淡珊瑚' },
  { code: 'E17', hex: '#E57373', name: '珊瑚' },
  { code: 'E18', hex: '#EF5350', name: '珊瑚红' },
  { code: 'E19', hex: '#FF1744', name: '亮珊瑚红' },
  { code: 'E20', hex: '#FFB3C1', name: '浅糖粉' },
  { code: 'E21', hex: '#FF88A8', name: '糖粉' },
  { code: 'E22', hex: '#FF5288', name: '深糖粉' },
  { code: 'E23', hex: '#FF0055', name: '覆盆子' },

  // ===== F 系列 - 红系 19色 =====
  { code: 'F1',  hex: '#FFEBEE', name: '极浅红' },
  { code: 'F2',  hex: '#FFCDD2', name: '浅红' },
  { code: 'F3',  hex: '#E53935', name: '鲜红' },
  { code: 'F4',  hex: '#C62828', name: '深红' },
  { code: 'F5',  hex: '#B71C1C', name: '暗红' },
  { code: 'F6',  hex: '#7F0000', name: '栗红' },
  { code: 'F7',  hex: '#FF1744', name: '亮红' },
  { code: 'F8',  hex: '#D32F2F', name: '正红' },
  { code: 'F9',  hex: '#EF9A9A', name: '浅粉红' },
  { code: 'F10', hex: '#EF5350', name: '淡红' },
  { code: 'F11', hex: '#FF8A80', name: '浅珊瑚' },
  { code: 'F12', hex: '#FF5252', name: '珊瑚红' },
  { code: 'F13', hex: '#FF6E40', name: '深珊瑚' },
  { code: 'F14', hex: '#FF3D00', name: '橙红' },
  { code: 'F15', hex: '#DD2C00', name: '深橙红' },
  { code: 'F16', hex: '#BF360C', name: '砖红' },
  { code: 'F17', hex: '#E64A19', name: '朱砂红' },
  { code: 'F18', hex: '#FF6D00', name: '红橙' },
  { code: 'F19', hex: '#FFAB91', name: '浅蜜桃红' },

  // ===== G 系列 - 棕肤大地色 21色 =====
  { code: 'G1',  hex: '#FFF8E1', name: '米白' },
  { code: 'G2',  hex: '#FFECB3', name: '浅卡其' },
  { code: 'G3',  hex: '#FFE082', name: '浅沙' },
  { code: 'G4',  hex: '#D4B896', name: '沙色' },
  { code: 'G5',  hex: '#C8A878', name: '卡其' },
  { code: 'G6',  hex: '#A1887F', name: '玫瑰棕' },
  { code: 'G7',  hex: '#8D6E63', name: '棕' },
  { code: 'G8',  hex: '#795548', name: '中棕' },
  { code: 'G9',  hex: '#5D4037', name: '深棕' },
  { code: 'G10', hex: '#4E342E', name: '暗棕' },
  { code: 'G11', hex: '#3E2723', name: '极暗棕' },
  { code: 'G12', hex: '#A0785A', name: '赭石' },
  { code: 'G13', hex: '#C09878', name: '浅赭石' },
  { code: 'G14', hex: '#D7B896', name: '桃木' },
  { code: 'G15', hex: '#BCAAA4', name: '浅玫瑰棕' },
  { code: 'G16', hex: '#FFCCBC', name: '极浅桃' },
  { code: 'G17', hex: '#FFAB91', name: '浅桃' },
  { code: 'G18', hex: '#FF8A65', name: '桃' },
  { code: 'G19', hex: '#FF7043', name: '深桃' },
  { code: 'G20', hex: '#BF8040', name: '橄榄棕' },
  { code: 'G21', hex: '#8D6220', name: '深橄榄棕' },

  // ===== H 系列 - 中性色/灰白黑 20色 =====
  { code: 'H1',  hex: '#212121', name: '极暗黑' },
  { code: 'H2',  hex: '#FFFFFF', name: '纯白' },
  { code: 'H3',  hex: '#F5F5F5', name: '极浅灰' },
  { code: 'H4',  hex: '#EEEEEE', name: '浅灰' },
  { code: 'H5',  hex: '#BDBDBD', name: '银灰' },
  { code: 'H6',  hex: '#9E9E9E', name: '中灰' },
  { code: 'H7',  hex: '#757575', name: '深灰' },
  { code: 'H8',  hex: '#616161', name: '炭灰' },
  { code: 'H9',  hex: '#424242', name: '暗灰' },
  { code: 'H10', hex: '#000000', name: '纯黑' },
  { code: 'H11', hex: '#EFEBE9', name: '暖浅灰' },
  { code: 'H12', hex: '#D7CCC8', name: '浅暖灰' },
  { code: 'H13', hex: '#BCAAA4', name: '中浅暖灰' },
  { code: 'H14', hex: '#8D6E63', name: '暖棕灰(参考G6)' },
  { code: 'H15', hex: '#6D4C41', name: '深棕灰' },
  { code: 'H16', hex: '#4E342E', name: '暗棕灰' },
  { code: 'H17', hex: '#37474F', name: '蓝黑' },
  { code: 'H18', hex: '#546E7A', name: '蓝灰' },
  { code: 'H19', hex: '#78909C', name: '浅蓝灰' },
  { code: 'H20', hex: '#B0BEC5', name: '极浅蓝灰' },

  // ===== M 系列 - 莫兰迪色系 15色 (来自 fuse-bead-tool v2.1 实测数据) =====
  { code: 'M1',  hex: '#CCD7C9', name: '莫兰迪绿灰' },
  { code: 'M2',  hex: '#91AA94', name: '莫兰迪深绿' },
  { code: 'M3',  hex: '#718898', name: '莫兰迪蓝灰' },
  { code: 'M4',  hex: '#DACEC2', name: '莫兰迪米粉' },
  { code: 'M5',  hex: '#DBD6B6', name: '莫兰迪黄绿' },
  { code: 'M6',  hex: '#C4B8A8', name: '莫兰迪灰褐' },
  { code: 'M7',  hex: '#B8A898', name: '莫兰迪深灰褐' },
  { code: 'M8',  hex: '#A89888', name: '莫兰迪棕灰' },
  { code: 'M9',  hex: '#D4C8B8', name: '莫兰迪浅褐' },
  { code: 'M10', hex: '#C8B8C8', name: '莫兰迪灰紫' },
  { code: 'M11', hex: '#B8C4C8', name: '莫兰迪青灰' },
  { code: 'M12', hex: '#C8D0C0', name: '莫兰迪浅绿灰' },
  { code: 'M13', hex: '#D8C0B8', name: '莫兰迪浅粉褐' },
  { code: 'M14', hex: '#E8D8D0', name: '莫兰迪极浅粉' },
  { code: 'M15', hex: '#D0C8E0', name: '莫兰迪淡紫灰' },
];

// ===== 预计算 LAB 缓存 =====
let _paletteLab: Array<{ color: MardColor; lab: [number, number, number] }> | null = null;

export function getPaletteLab() {
  if (!_paletteLab) {
    _paletteLab = MARD_PALETTE.map(color => {
      const [r, g, b] = hexToRgb(color.hex);
      return { color, lab: rgbToLab(r, g, b) };
    });
  }
  return _paletteLab;
}

// ===== 找最近 Mard 颜色（ΔE2000 + 饱和度门控 + 亮度差惩罚）=====
export function findNearestMardColor(
  r: number,
  g: number,
  b: number,
  allowedCodes?: Set<string>
): MardColor {
  const paletteLab = getPaletteLab();
  const pixelLab = rgbToLab(r, g, b);

  const pixelL      = pixelLab[0];
  const pixelChroma = Math.sqrt(pixelLab[1] ** 2 + pixelLab[2] ** 2);

  let minDist = Infinity;
  let nearest = paletteLab[0].color;

  for (const { color, lab } of paletteLab) {
    if (allowedCodes && !allowedCodes.has(color.code)) continue;

    let d = deltaE2000(pixelLab, lab);

    const paletteChroma = Math.sqrt(lab[1] ** 2 + lab[2] ** 2);
    const paletteL      = lab[0];

    const pixelA    = pixelLab[1];   // a*：正=红，负=绿
    const paletteA  = lab[1];

    // ① 饱和度门控：低色度像素不映射到高饱和颜色（防灰/白→紫）
    if      (pixelChroma < 8  && paletteChroma > 18) d += 32;
    else if (pixelChroma < 18 && paletteChroma > 30) d += 18;
    else if (pixelChroma < 28 && paletteChroma > 50) d += 10;

    // ② 亮度差惩罚：像素比色板颜色亮很多时，不允许匹配到深色高饱和颜色
    // 阈值从 L>58 降到 L>48，覆盖皮肤中间调
    if (pixelL > 48 && paletteL < 55 && paletteChroma > 35) {
      d += (pixelL - paletteL) * 0.65;
    }
    if (pixelL < 45 && paletteL > 62 && paletteChroma > 35) {
      d += (paletteL - pixelL) * 0.4;
    }

    // ③ a* 轴（红度轴）直接防护：
    // 像素不够红(a*<18) → 不应映射到高红度色板(a*>42)
    // 专门阻止皮肤/粉色被拉到鲜红 F 系
    if (pixelA < 18 && paletteA > 42) {
      d += (paletteA - pixelA) * 0.45;
    }
    // 像素中等红(18≤a*<30) → 对极高红度色板(a*>55)轻度惩罚
    if (pixelA >= 18 && pixelA < 30 && paletteA > 55) {
      d += (paletteA - 55) * 0.3;
    }

    if (d < minDist) {
      minDist = d;
      nearest = color;
    }
  }
  return nearest;
}

// ===== 自动选取最佳 N 色（色度加权频率统计）=====
// 高饱和像素（如红色球衣）每个只算 0.25 票，防止它们垄断颜色槽位
// 低饱和像素（皮肤、灰色）每个计 1 票，保证细腻色区得到充分代表
export function selectBestColors(
  pixelData: Uint8ClampedArray,
  maxColors: number,
  width: number,
  height: number
): Set<string> {
  const colorScore = new Map<string, number>();
  // 采样约 4000 个点
  const step = Math.max(1, Math.floor((width * height) / 4000));

  for (let i = 0; i < width * height; i += step) {
    const r = pixelData[i * 4];
    const g = pixelData[i * 4 + 1];
    const b = pixelData[i * 4 + 2];
    const a = pixelData[i * 4 + 3];
    if (a < 128) continue;

    const lab    = rgbToLab(r, g, b);
    const chroma = Math.sqrt(lab[1] ** 2 + lab[2] ** 2);

    // 色度越高，权重越低（高饱和像素票少，皮肤/灰色票多）
    const weight =
      chroma > 55 ? 0.2 :
      chroma > 38 ? 0.45 :
      chroma > 22 ? 0.75 : 1.0;

    const nearest = findNearestMardColor(r, g, b);
    colorScore.set(nearest.code, (colorScore.get(nearest.code) || 0) + weight);
  }

  // 按加权分取前 maxColors 种
  const sorted = [...colorScore.entries()].sort((a, b) => b[1] - a[1]);
  return new Set(sorted.slice(0, maxColors).map(e => e[0]));
}
