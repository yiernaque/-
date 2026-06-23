'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  MARD_PALETTE,
  MardColor,
  hexToRgb,
  findNearestMardColor,
  selectBestColors,
} from './mardPalette';

const SIZES = [57, 125, 256] as const;
type GridSize = (typeof SIZES)[number];

interface Cell {
  code: string;
  hex: string;
}

interface GeneratedPattern {
  grid: Cell[][];
  gridW: number;   // 格子列数（保持原图宽高比）
  gridH: number;   // 格子行数
  colorStats: { color: MardColor; count: number }[];
}

// ===== 高质量降采样 =====
function downsampleCanvas(
  src: HTMLImageElement,
  targetW: number,
  targetH: number
): ImageData {
  const offscreen = document.createElement('canvas');
  offscreen.width = targetW;
  offscreen.height = targetH;
  const ctx = offscreen.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const srcW = src.naturalWidth;
  const srcH = src.naturalHeight;

  // 两步降采样减少混叠
  if (srcW > targetW * 2 || srcH > targetH * 2) {
    const mid = document.createElement('canvas');
    mid.width = Math.round(srcW / 2);
    mid.height = Math.round(srcH / 2);
    mid.getContext('2d')!.drawImage(src, 0, 0, mid.width, mid.height);
    ctx.drawImage(mid, 0, 0, targetW, targetH);
  } else {
    ctx.drawImage(src, 0, 0, targetW, targetH);
  }
  return ctx.getImageData(0, 0, targetW, targetH);
}

// ===== 去杂色：孤立像素替换为邻域主色 =====
function removeNoise(grid: Cell[][], gridW: number, gridH: number, passes = 2): Cell[][] {
  let result = grid.map(row => [...row]);

  for (let pass = 0; pass < passes; pass++) {
    const next = result.map(row => [...row]);
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const cur = result[y][x].code;
        const freq = new Map<string, number>();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < gridH && nx >= 0 && nx < gridW) {
              const code = result[ny][nx].code;
              freq.set(code, (freq.get(code) || 0) + 1);
            }
          }
        }
        // 当前色在邻域 ≤1 次 → 替换为多数邻居
        if ((freq.get(cur) || 0) <= 1) {
          let maxCnt = 0, maxCode = cur;
          freq.forEach((cnt, code) => { if (cnt > maxCnt) { maxCnt = cnt; maxCode = code; } });
          if (maxCode !== cur) {
            const c = MARD_PALETTE.find(p => p.code === maxCode)!;
            next[y][x] = { code: maxCode, hex: c.hex };
          }
        }
      }
    }
    result = next;
  }
  return result;
}

// ===== 生成图案（保持原图宽高比）=====
async function generatePattern(
  image: HTMLImageElement,
  maxSide: GridSize,
  maxColors: number
): Promise<GeneratedPattern> {
  // 1. 按原图比例计算格子数，最长边 = maxSide
  const imgW = image.naturalWidth;
  const imgH = image.naturalHeight;
  const scale = maxSide / Math.max(imgW, imgH);
  const gridW = Math.max(1, Math.round(imgW * scale));
  const gridH = Math.max(1, Math.round(imgH * scale));

  // 2. 降采样
  const imageData = downsampleCanvas(image, gridW, gridH);
  const { data } = imageData;

  // 3. 选取最佳 N 色（饱和度感知版）
  const allowed = selectBestColors(data, maxColors, gridW, gridH);

  // 4. 逐像素映射（带饱和度门控）
  const grid: Cell[][] = [];
  for (let y = 0; y < gridH; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < gridW; x++) {
      const idx = (y * gridW + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      if (a < 128) {
        row.push({ code: 'H2', hex: '#FFFFFF' });
      } else {
        const c = findNearestMardColor(r, g, b, allowed);
        row.push({ code: c.code, hex: c.hex });
      }
    }
    grid.push(row);
  }

  // 5. 去杂色
  const cleanGrid = removeNoise(grid, gridW, gridH, 2);

  // 6. 统计
  const countMap = new Map<string, number>();
  for (const row of cleanGrid) {
    for (const cell of row) {
      countMap.set(cell.code, (countMap.get(cell.code) || 0) + 1);
    }
  }
  const colorStats = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({
      color: MARD_PALETTE.find(p => p.code === code) || { code, hex: '#888', name: code },
      count,
    }));

  return { grid: cleanGrid, gridW, gridH, colorStats };
}

// ===== 渲染到 Canvas（含自适应 legend）=====
function renderPatternToCanvas(
  canvas: HTMLCanvasElement,
  pattern: GeneratedPattern,
  cellSize: number,
  showLabels: boolean
) {
  const { grid, gridW, gridH, colorStats } = pattern;

  // legend 尺寸随画布宽度自适应
  const canvasW = gridW * cellSize + 2;
  // 每个 legend item 宽度，至少 6 列
  const LEGEND_COLS = Math.max(6, Math.min(12, Math.floor(canvasW / 80)));
  const swatchSz = Math.max(20, Math.min(36, Math.floor(canvasW / (LEGEND_COLS * 3.5))));
  const itemW = Math.floor(canvasW / LEGEND_COLS);
  const itemH = swatchSz + 18;
  const legendBodyH = Math.ceil(colorStats.length / LEGEND_COLS) * itemH;
  const legendHeaderH = Math.max(28, Math.round(swatchSz * 0.8));
  const legendH = legendHeaderH + legendBodyH + 12;

  const totalW = canvasW;
  const totalH = gridH * cellSize + 2 + legendH;

  canvas.width = totalW;
  canvas.height = totalH;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalW, totalH);

  // ===== 绘制格子 =====
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const cell = grid[y][x];
      const px = 1 + x * cellSize;
      const py = 1 + y * cellSize;

      ctx.fillStyle = cell.hex;
      ctx.fillRect(px, py, cellSize, cellSize);

      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

      if (showLabels && cellSize >= 18) {
        const fontSize = Math.max(6, Math.min(11, Math.floor(cellSize * 0.38)));
        ctx.font = `bold ${fontSize}px "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const [r, g, b] = hexToRgb(cell.hex);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        ctx.fillStyle = lum > 0.5 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.90)';
        ctx.fillText(cell.code, px + cellSize / 2, py + cellSize / 2);
      }
    }
  }

  // 外框
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, gridW * cellSize, gridH * cellSize);

  // ===== Legend =====
  const legY0 = gridH * cellSize + 2;
  ctx.fillStyle = '#F7F7F7';
  ctx.fillRect(0, legY0, totalW, legendH);
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, legY0);
  ctx.lineTo(totalW, legY0);
  ctx.stroke();

  const headerFontSize = Math.max(10, Math.min(14, Math.round(swatchSz * 0.42)));
  ctx.font = `bold ${headerFontSize}px "PingFang SC", sans-serif`;
  ctx.fillStyle = '#444';
  ctx.textAlign = 'left';
  ctx.fillText(
    `颜色对照表  共${colorStats.length}色  /  ${gridW}×${gridH}格`,
    10,
    legY0 + legendHeaderH * 0.7
  );

  const codeFontSize = Math.max(8, Math.min(12, Math.round(swatchSz * 0.4)));
  const cntFontSize = Math.max(7, Math.min(10, Math.round(swatchSz * 0.32)));

  colorStats.forEach(({ color, count }, i) => {
    const col = i % LEGEND_COLS;
    const row = Math.floor(i / LEGEND_COLS);
    const ix = col * itemW + 6;
    const iy = legY0 + legendHeaderH + row * itemH + 4;

    ctx.fillStyle = color.hex;
    ctx.fillRect(ix, iy, swatchSz, swatchSz);
    ctx.strokeStyle = '#CCC';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(ix, iy, swatchSz, swatchSz);

    const tx = ix + swatchSz + 4;
    ctx.fillStyle = '#222';
    ctx.font = `bold ${codeFontSize}px "PingFang SC", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(color.code, tx, iy + swatchSz * 0.48);
    ctx.fillStyle = '#888';
    ctx.font = `${cntFontSize}px "PingFang SC", sans-serif`;
    ctx.fillText(`×${count}`, tx, iy + swatchSz * 0.82);
  });
}

function isLight(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

// ===== 主组件 =====
export default function PerlerPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageAspect, setImageAspect] = useState<string>('');
  const [maxSide, setMaxSide] = useState<GridSize>(57);
  const [maxColors, setMaxColors] = useState(16);
  const [pattern, setPattern] = useState<GeneratedPattern | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [viewScale, setViewScale] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 单元格显示像素（展示用，不影响导出）
  const CELL_PX = maxSide === 256 ? 8 : maxSide === 125 ? 12 : 18;

  const loadImage = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      const w = img.naturalWidth, h = img.naturalHeight;
      const g = (a: number, b: number): number => b === 0 ? a : g(b, a % b);
      const d = g(w, h);
      setImageAspect(`${w / d}:${h / d}  (${w}×${h}px)`);
    };
    img.src = url;
    setPattern(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) loadImage(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  };

  const handleGenerate = async () => {
    if (!image) return;
    setLoading(true);
    setPattern(null);
    try {
      const p = await generatePattern(image, maxSide, maxColors);
      setPattern(p);
      setViewScale(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pattern || !canvasRef.current) return;
    renderPatternToCanvas(canvasRef.current, pattern, CELL_PX, CELL_PX >= 18);
  }, [pattern, CELL_PX]);

  const handleExport = () => {
    if (!canvasRef.current || !pattern) return;
    // 导出时用固定较大 cellSize 保证清晰
    const exportCellPx = maxSide === 256 ? 14 : maxSide === 125 ? 18 : 24;
    const exportCanvas = document.createElement('canvas');
    renderPatternToCanvas(exportCanvas, pattern, exportCellPx, true);
    const link = document.createElement('a');
    link.download = `mard_${pattern.gridW}x${pattern.gridH}_${pattern.colorStats.length}colors.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  // 计算实际输出格数（用于 UI 提示）
  const previewGridW = image
    ? Math.max(1, Math.round(image.naturalWidth * maxSide / Math.max(image.naturalWidth, image.naturalHeight)))
    : maxSide;
  const previewGridH = image
    ? Math.max(1, Math.round(image.naturalHeight * maxSide / Math.max(image.naturalWidth, image.naturalHeight)))
    : maxSide;

  return (
    <div className="min-h-screen bg-[#F2F0EB]" style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", sans-serif' }}>
      {/* 顶栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🐾</span>
        <div>
          <h1 className="text-lg font-bold text-gray-800">拼豆稿子产出器</h1>
          <p className="text-xs text-gray-400">Mard V3 调色板 · 保持原图比例 · 自动去杂色</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

          {/* ===== 左栏 ===== */}
          <div className="space-y-4">
            {/* 上传 */}
            <div
              className={`border-2 border-dashed rounded-2xl transition-all cursor-pointer
                ${dragging ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white hover:border-amber-300'}`}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              {imageUrl ? (
                <div className="p-3">
                  {/* 用原生 img 保持宽高比展示 */}
                  <img src={imageUrl} alt="原图"
                    className="w-full rounded-xl object-contain bg-gray-50"
                    style={{ maxHeight: 240 }}
                  />
                  {imageAspect && (
                    <p className="text-[11px] text-center text-gray-400 mt-1.5">{imageAspect}</p>
                  )}
                  <p className="text-xs text-center text-gray-300 mt-0.5">点击重新上传</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                  <span className="text-4xl">📷</span>
                  <p className="text-sm font-medium">拖拽或点击上传图片</p>
                  <p className="text-xs">JPG / PNG / GIF / WebP</p>
                </div>
              )}
            </div>

            {/* 设置 */}
            <div className="bg-white rounded-2xl p-5 space-y-5 shadow-sm">
              <h2 className="font-bold text-gray-700">⚙️ 参数设置</h2>

              {/* 最长边格数 */}
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">
                  最长边格数
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => setMaxSide(s)}
                      className={`py-2 rounded-xl text-sm font-bold border-2 transition-all
                        ${maxSide === s
                          ? 'border-amber-400 bg-amber-400 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-300'
                        }`}
                    >
                      {s}格
                    </button>
                  ))}
                </div>
                {/* 实时显示实际输出格数 */}
                <p className="text-xs text-amber-600 mt-1.5 font-medium">
                  {image
                    ? `→ 实际输出：${previewGridW}×${previewGridH} 格`
                    : `最长边 ${maxSide} 格，另一边等比缩放`
                  }
                </p>
              </div>

              {/* 颜色数 */}
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 flex justify-between">
                  <span>最大颜色数</span>
                  <span className="text-amber-500 font-bold">{maxColors} 色</span>
                </label>
                <input
                  type="range" min={4} max={60} value={maxColors}
                  onChange={e => setMaxColors(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                  <span>4 极简</span><span>→</span><span>60 丰富</span>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!image || loading}
                className={`w-full py-3 rounded-xl font-bold text-base transition-all
                  ${!image || loading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-amber-400 hover:bg-amber-500 text-white shadow-md active:scale-95'
                  }`}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="animate-spin inline-block">⚙️</span> 生成中…</span>
                  : '🎨 生成拼豆稿'
                }
              </button>
            </div>

            {/* 移动端 legend */}
            {pattern && (
              <div className="bg-white rounded-2xl p-4 shadow-sm lg:hidden">
                <p className="text-sm font-bold text-gray-700 mb-2">颜色对照 · {pattern.colorStats.length} 色</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {pattern.colorStats.map(({ color, count }) => (
                    <div key={color.code} className="flex items-center gap-1.5">
                      <div className="w-7 h-7 rounded flex-shrink-0 border border-gray-200 flex items-center justify-center text-[8px] font-bold"
                        style={{ background: color.hex, color: isLight(color.hex) ? '#333' : '#fff' }}
                      >{color.code}</div>
                      <span className="text-[11px] text-gray-500">×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===== 右栏 ===== */}
          <div className="space-y-4 min-w-0">
            {!pattern && !loading && (
              <div className="bg-white rounded-2xl h-80 flex items-center justify-center text-gray-300">
                <div className="text-center">
                  <div className="text-5xl mb-3">🧩</div>
                  <p className="font-medium">上传图片 → 生成拼豆稿</p>
                  <p className="text-sm mt-1">保持原图宽高比 · Mard 色板 · 去杂色</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-3 animate-bounce">🎨</div>
                  <p className="font-bold text-amber-500">正在生成…</p>
                  <p className="text-sm text-gray-400 mt-1">ΔE2000 色差匹配 + 去杂色迭代</p>
                </div>
              </div>
            )}

            {pattern && (
              <>
                {/* 工具栏 */}
                <div className="bg-white rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-sm flex-wrap gap-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-bold text-gray-800">{pattern.gridW}×{pattern.gridH}</span>格 ·{' '}
                    <span className="font-bold text-amber-500">{pattern.colorStats.length}</span> 色 ·{' '}
                    <span className="text-gray-400">{(pattern.gridW * pattern.gridH).toLocaleString()} 颗豆</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setViewScale(s => Math.max(0.2, +(s - 0.1).toFixed(1)))}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">−</button>
                    <span className="text-sm text-gray-600 w-12 text-center">{Math.round(viewScale * 100)}%</span>
                    <button onClick={() => setViewScale(s => Math.min(3, +(s + 0.1).toFixed(1)))}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">+</button>
                    <button onClick={() => setViewScale(1)}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs">100%</button>
                    <button onClick={handleExport}
                      className="ml-1 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-sm font-bold">
                      ⬇ 导出
                    </button>
                  </div>
                </div>

                {/* Canvas 预览 */}
                <div className="bg-[#E8E6E1] rounded-2xl overflow-auto shadow-inner" style={{ maxHeight: '72vh' }}>
                  <div style={{
                    transform: `scale(${viewScale})`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.15s',
                    width: `${pattern.gridW * CELL_PX + 2}px`,
                    height: `${(pattern.gridH * CELL_PX + 2) * 1}px`  // legend 嵌在 canvas 里
                  }}>
                    <canvas ref={canvasRef} className="block shadow-lg" />
                  </div>
                </div>

                {/* PC 端 legend（页面级，大号） */}
                <div className="bg-white rounded-2xl p-5 shadow-sm hidden lg:block">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800">
                      🎨 颜色对照表
                    </h3>
                    <span className="text-sm text-gray-400">
                      共 <span className="text-amber-500 font-bold">{pattern.colorStats.length}</span> 色 ·{' '}
                      总计 <span className="font-medium">{(pattern.gridW * pattern.gridH).toLocaleString()}</span> 颗
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 xl:grid-cols-8 gap-2">
                    {pattern.colorStats.map(({ color, count }) => (
                      <div
                        key={color.code}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all cursor-default"
                        title={color.name || color.code}
                      >
                        {/* 色块放大到 44px */}
                        <div
                          className="w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center font-bold shadow-sm text-[10px]"
                          style={{
                            backgroundColor: color.hex,
                            color: isLight(color.hex) ? '#333' : '#fff',
                          }}
                        >
                          {color.code}
                        </div>
                        <div className="text-center">
                          <div className="text-[11px] font-bold text-gray-700 leading-tight">{color.code}</div>
                          <div className="text-[10px] text-gray-400 leading-tight">×{count}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
