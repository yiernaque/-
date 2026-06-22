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
  width: number;
  height: number;
  colorStats: { color: MardColor; count: number }[];
}

// ===== 图像处理：高质量降采样 =====
function downsampleCanvas(
  src: HTMLImageElement | HTMLCanvasElement,
  targetW: number,
  targetH: number
): ImageData {
  const offscreen = document.createElement('canvas');
  offscreen.width = targetW;
  offscreen.height = targetH;
  const ctx = offscreen.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 两步降采样减少混叠
  const srcW = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const srcH = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  if (srcW > targetW * 2 || srcH > targetH * 2) {
    const mid = document.createElement('canvas');
    mid.width = Math.round(srcW / 2);
    mid.height = Math.round(srcH / 2);
    const midCtx = mid.getContext('2d')!;
    midCtx.drawImage(src, 0, 0, mid.width, mid.height);
    ctx.drawImage(mid, 0, 0, targetW, targetH);
  } else {
    ctx.drawImage(src, 0, 0, targetW, targetH);
  }
  return ctx.getImageData(0, 0, targetW, targetH);
}

// ===== 去杂色：将孤立像素替换为周围主色 =====
function removeNoise(grid: Cell[][], passes: number = 2): Cell[][] {
  const h = grid.length;
  const w = grid[0].length;
  let result = grid.map(row => [...row]);

  for (let pass = 0; pass < passes; pass++) {
    const next = result.map(row => [...row]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cur = result[y][x].code;
        // 统计 3x3 邻域颜色频率
        const freq = new Map<string, number>();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
              const code = result[ny][nx].code;
              freq.set(code, (freq.get(code) || 0) + 1);
            }
          }
        }
        // 如果当前色在邻域中出现 ≤1 次，替换为邻域主色
        const curCount = freq.get(cur) || 0;
        if (curCount <= 1) {
          let maxCount = 0, maxCode = cur;
          freq.forEach((cnt, code) => { if (cnt > maxCount) { maxCount = cnt; maxCode = code; } });
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

// ===== 生成图案 =====
async function generatePattern(
  image: HTMLImageElement,
  gridSize: GridSize,
  maxColors: number
): Promise<GeneratedPattern> {
  // 1. 降采样到目标尺寸
  const imageData = downsampleCanvas(image, gridSize, gridSize);
  const { data, width, height } = imageData;

  // 2. 选取最佳 N 种颜色
  const allowed = selectBestColors(data, maxColors, width, height);

  // 3. 映射每个像素到 Mard 颜色
  const grid: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      if (a < 128) {
        // 透明 -> 白色
        row.push({ code: 'H2', hex: '#FFFFFF' });
      } else {
        const c = findNearestMardColor(r, g, b, allowed);
        row.push({ code: c.code, hex: c.hex });
      }
    }
    grid.push(row);
  }

  // 4. 去杂色（2次）
  const cleanGrid = removeNoise(grid, 2);

  // 5. 统计颜色使用
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

  return { grid: cleanGrid, width, height, colorStats };
}

// ===== 渲染到 Canvas =====
function renderPatternToCanvas(
  canvas: HTMLCanvasElement,
  pattern: GeneratedPattern,
  cellSize: number,
  showLabels: boolean
) {
  const { grid, width, height, colorStats } = pattern;
  const legendH = Math.ceil(colorStats.length / 6) * 44 + 48;
  const totalW = width * cellSize + 2;
  const totalH = height * cellSize + 2 + legendH;

  canvas.width = totalW;
  canvas.height = totalH;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalW, totalH);

  // 绘制像素格子
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      const px = 1 + x * cellSize;
      const py = 1 + y * cellSize;

      // 填色
      ctx.fillStyle = cell.hex;
      ctx.fillRect(px, py, cellSize, cellSize);

      // 格线
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

      // 标注色码（格子 ≥18px 才显示）
      if (showLabels && cellSize >= 18) {
        const fontSize = Math.max(6, Math.min(10, Math.floor(cellSize * 0.38)));
        ctx.font = `bold ${fontSize}px "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 自动调文字颜色
        const [r, g, b] = hexToRgb(cell.hex);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        ctx.fillStyle = luminance > 0.5 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.90)';
        ctx.fillText(cell.code, px + cellSize / 2, py + cellSize / 2);
      }
    }
  }

  // 外边框
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width * cellSize, height * cellSize);

  // ===== 图例 =====
  const legendY = height * cellSize + 6;
  const swatchSize = 28;
  const colsPerRow = 6;
  const itemW = Math.floor(totalW / colsPerRow);

  ctx.fillStyle = '#F8F8F8';
  ctx.fillRect(0, height * cellSize + 2, totalW, legendH);
  ctx.strokeStyle = '#DDD';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, height * cellSize + 2, totalW, legendH);

  ctx.font = `bold 11px "PingFang SC", sans-serif`;
  ctx.fillStyle = '#333';
  ctx.textAlign = 'left';
  ctx.fillText(`颜色对照表  共${colorStats.length}色 / ${width}×${height}`, 8, legendY + 14);

  colorStats.forEach(({ color, count }, i) => {
    const col = i % colsPerRow;
    const row = Math.floor(i / colsPerRow);
    const x = col * itemW + 8;
    const y = legendY + 28 + row * 44;

    // 色块
    ctx.fillStyle = color.hex;
    ctx.fillRect(x, y, swatchSize, swatchSize);
    ctx.strokeStyle = '#CCC';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, swatchSize, swatchSize);

    // 码 + 数量
    ctx.fillStyle = '#222';
    ctx.font = `bold 10px "PingFang SC", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(color.code, x + swatchSize + 4, y + 11);
    ctx.fillStyle = '#666';
    ctx.font = `9px "PingFang SC", sans-serif`;
    ctx.fillText(`×${count}`, x + swatchSize + 4, y + 24);
  });
}

// ===== 颜色亮度判断 =====
function isLight(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

export default function PerlerPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>(57);
  const [maxColors, setMaxColors] = useState(16);
  const [pattern, setPattern] = useState<GeneratedPattern | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [viewScale, setViewScale] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // 单元格像素（用于预览展示，不影响输出分辨率）
  const CELL_PX = gridSize === 256 ? 10 : gridSize === 125 ? 14 : 20;

  const loadImage = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => setImage(img);
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
      const p = await generatePattern(image, gridSize, maxColors);
      setPattern(p);
    } finally {
      setLoading(false);
    }
  };

  // 渲染到输出canvas
  useEffect(() => {
    if (!pattern || !canvasRef.current) return;
    const showLabels = CELL_PX >= 18;
    renderPatternToCanvas(canvasRef.current, pattern, CELL_PX, showLabels);
  }, [pattern, CELL_PX]);

  // 导出
  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `mard_${gridSize}x${gridSize}_${maxColors}colors.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#F2F0EB]" style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", sans-serif' }}>
      {/* 顶栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🐾</span>
        <div>
          <h1 className="text-lg font-bold text-gray-800">拼豆稿子产出器</h1>
          <p className="text-xs text-gray-400">Mard V3 调色板 · 57 / 125 / 256格</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ===== 左栏：上传 + 设置 ===== */}
          <div className="space-y-4">
            {/* 上传区 */}
            <div
              className={`border-2 border-dashed rounded-2xl transition-all cursor-pointer
                ${dragging ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white hover:border-amber-300 hover:bg-amber-50/30'}`}
              style={{ minHeight: 200 }}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              {imageUrl ? (
                <div className="p-3">
                  <img src={imageUrl} alt="原图" className="w-full rounded-xl object-contain" style={{ maxHeight: 220 }} />
                  <p className="text-xs text-center text-gray-400 mt-2">点击重新上传</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-52 gap-3 text-gray-400">
                  <span className="text-4xl">📷</span>
                  <p className="text-sm font-medium">拖拽或点击上传图片</p>
                  <p className="text-xs">支持 JPG / PNG / GIF / WebP</p>
                </div>
              )}
            </div>

            {/* 设置面板 */}
            <div className="bg-white rounded-2xl p-5 space-y-5 shadow-sm">
              <h2 className="font-bold text-gray-700">⚙️ 参数设置</h2>

              {/* 尺寸 */}
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-2 block">格子尺寸</label>
                <div className="grid grid-cols-3 gap-2">
                  {SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => setGridSize(s)}
                      className={`py-2 rounded-xl text-sm font-bold border-2 transition-all
                        ${gridSize === s
                          ? 'border-amber-400 bg-amber-400 text-white shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-300'
                        }`}
                    >
                      {s}×{s}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {gridSize === 57 && '57格 ≈ 小型图案，快速制作'}
                  {gridSize === 125 && '125格 ≈ 中型图案，细节适中'}
                  {gridSize === 256 && '256格 ≈ 大型图案，高精度细节'}
                </p>
              </div>

              {/* 颜色数 */}
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-2 flex justify-between">
                  <span>最大颜色数</span>
                  <span className="text-amber-500 font-bold">{maxColors} 色</span>
                </label>
                <input
                  type="range" min={4} max={60} value={maxColors}
                  onChange={e => setMaxColors(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>4色</span><span>极简</span><span>→</span><span>丰富</span><span>60色</span>
                </div>
              </div>

              {/* 生成按钮 */}
              <button
                onClick={handleGenerate}
                disabled={!image || loading}
                className={`w-full py-3 rounded-xl font-bold text-base transition-all
                  ${!image || loading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-amber-400 hover:bg-amber-500 text-white shadow-md hover:shadow-lg active:scale-95'
                  }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span> 生成中…
                  </span>
                ) : '🎨 生成拼豆稿'}
              </button>
            </div>

            {/* 颜色图例（手机端放这里） */}
            {pattern && (
              <div className="bg-white rounded-2xl p-5 shadow-sm lg:hidden">
                <h3 className="font-bold text-gray-700 mb-3">
                  颜色表 · 共 {pattern.colorStats.length} 色
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {pattern.colorStats.map(({ color, count }) => (
                    <div key={color.code} className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-md border border-gray-200 flex-shrink-0 flex items-center justify-center text-[8px] font-bold"
                        style={{
                          backgroundColor: color.hex,
                          color: isLight(color.hex) ? '#333' : '#fff'
                        }}
                      >
                        {color.code}
                      </div>
                      <span className="text-xs text-gray-500">×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===== 右栏：预览 + 输出 ===== */}
          <div className="lg:col-span-2 space-y-4">
            {!pattern && !loading && (
              <div className="bg-white rounded-2xl h-96 flex items-center justify-center text-gray-300">
                <div className="text-center">
                  <div className="text-6xl mb-4">🧩</div>
                  <p className="text-lg font-medium">上传图片后点击「生成拼豆稿」</p>
                  <p className="text-sm mt-1">支持 Mard V3 调色板 · 自动去除杂色</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-4 animate-bounce">🎨</div>
                  <p className="text-lg font-bold text-amber-500">正在生成…</p>
                  <p className="text-sm text-gray-400 mt-1">正在匹配 Mard 色号，消除杂色豆…</p>
                </div>
              </div>
            )}

            {pattern && (
              <>
                {/* 工具栏 */}
                <div className="bg-white rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
                  <div className="text-sm text-gray-600">
                    <span className="font-bold text-gray-800">{pattern.width}×{pattern.height}</span>
                    格 · <span className="font-bold text-amber-500">{pattern.colorStats.length}</span> 色 ·{' '}
                    <span className="text-gray-400">共 {pattern.width * pattern.height} 颗豆</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewScale(s => Math.max(0.3, s - 0.1))}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                    >−</button>
                    <span className="px-2 py-1 text-sm text-gray-600">{Math.round(viewScale * 100)}%</span>
                    <button
                      onClick={() => setViewScale(s => Math.min(2, s + 0.1))}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                    >+</button>
                    <button
                      onClick={handleExport}
                      className="ml-2 px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-sm font-bold shadow-sm"
                    >
                      ⬇ 导出 PNG
                    </button>
                  </div>
                </div>

                {/* Canvas 预览区 */}
                <div className="bg-white rounded-2xl overflow-auto shadow-sm" style={{ maxHeight: '70vh' }}>
                  <div
                    style={{ transform: `scale(${viewScale})`, transformOrigin: 'top left', transition: 'transform 0.2s' }}
                  >
                    <canvas ref={canvasRef} className="block" />
                  </div>
                </div>

                {/* PC端颜色图例 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm hidden lg:block">
                  <h3 className="font-bold text-gray-700 mb-3">
                    🎨 颜色对照表 · 共 <span className="text-amber-500">{pattern.colorStats.length}</span> 色
                  </h3>
                  <div className="grid grid-cols-4 xl:grid-cols-6 gap-2">
                    {pattern.colorStats.map(({ color, count }) => (
                      <div
                        key={color.code}
                        className="flex items-center gap-2 p-2 rounded-xl border border-gray-100 hover:border-amber-200 transition-all"
                      >
                        <div
                          className="w-9 h-9 rounded-lg border border-gray-200 flex-shrink-0 flex items-center justify-center text-[9px] font-bold shadow-sm"
                          style={{
                            backgroundColor: color.hex,
                            color: isLight(color.hex) ? '#333' : '#fff'
                          }}
                        >
                          {color.code}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-700">{color.code}</div>
                          <div className="text-xs text-gray-400">×{count}</div>
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
