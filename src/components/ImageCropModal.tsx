import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, Move } from 'lucide-react';

interface ImageCropModalProps {
  file: File;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

const CROP_VIEW_SIZE = 280;
const OUTPUT_SIZE = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  file,
  onCancel,
  onConfirm,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Compute rendered base dimensions (at zoom=1) so the shorter rotated side exactly fills CROP_VIEW_SIZE
  const getBaseDims = useCallback(
    (natW: number, natH: number, rot: number) => {
      const swapped = rot % 180 !== 0;
      const effW = swapped ? natH : natW;
      const effH = swapped ? natW : natH;
      const scale = Math.max(CROP_VIEW_SIZE / effW, CROP_VIEW_SIZE / effH);
      return {
        effW,
        effH,
        baseScale: scale,
        renderW: effW * scale,
        renderH: effH * scale,
      };
    },
    []
  );

  const clampOffset = useCallback(
    (nextX: number, nextY: number, nextZoom: number, rot = rotation) => {
      if (!imgNatural) return { x: 0, y: 0 };
      const { renderW, renderH } = getBaseDims(imgNatural.w, imgNatural.h, rot);
      const maxX = Math.max(0, (renderW * nextZoom - CROP_VIEW_SIZE) / 2);
      const maxY = Math.max(0, (renderH * nextZoom - CROP_VIEW_SIZE) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, nextX)),
        y: Math.max(-maxY, Math.min(maxY, nextY)),
      };
    },
    [imgNatural, rotation, getBaseDims]
  );

  const updateZoom = useCallback(
    (nextZoomRaw: number) => {
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoomRaw));
      setZoom(nextZoom);
      setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom));
    },
    [clampOffset]
  );

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    setOffset((prev) => clampOffset(prev.x, prev.y, zoom, nextRot));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      pinchStartRef.current = null;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offset.x,
        oy: offset.y,
      };
    } else if (pointersRef.current.size === 2) {
      dragStartRef.current = null;
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchStartRef.current = { dist: Math.max(dist, 10), zoom };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = dist / pinchStartRef.current.dist;
      updateZoom(pinchStartRef.current.zoom * ratio);
      return;
    }

    if (pointersRef.current.size === 1 && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOffset(clampOffset(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy, zoom));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0];
      dragStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        ox: offset.x,
        oy: offset.y,
      };
    } else {
      dragStartRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.14 : -0.14;
    updateZoom(zoom + delta);
  };

  const handleConfirmCrop = () => {
    const img = imgRef.current;
    if (!img || !imgNatural) return;
    setProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setProcessing(false);
        return;
      }

      const { baseScale } = getBaseDims(imgNatural.w, imgNatural.h, rotation);
      const ratio = OUTPUT_SIZE / CROP_VIEW_SIZE;
      const totalScale = baseScale * zoom * ratio;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.save();
      ctx.translate(OUTPUT_SIZE / 2 + offset.x * ratio, OUTPUT_SIZE / 2 + offset.y * ratio);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(totalScale, totalScale);
      ctx.drawImage(img, -imgNatural.w / 2, -imgNatural.h / 2, imgNatural.w, imgNatural.h);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      onConfirm(dataUrl);
    } finally {
      setProcessing(false);
    }
  };

  const baseDims = imgNatural ? getBaseDims(imgNatural.w, imgNatural.h, rotation) : null;
  const displayScale = baseDims ? baseDims.baseScale * zoom : 1;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm theme-surface rounded-2xl shadow-2xl border overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 theme-subtle border-b flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold font-serif-thai">ปรับขนาด & ครอปรูปโปรไฟล์</h3>
            <p className="text-[11px] theme-muted-text">
              ลากเพื่อจัดตำแหน่ง · ถ่าง 2 นิ้วหรือเลื่อนแถบเพื่อขยาย
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Crop Stage */}
        <div className="p-4 flex flex-col items-center gap-4">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{
              width: CROP_VIEW_SIZE,
              height: CROP_VIEW_SIZE,
              touchAction: 'none',
            }}
            className="relative rounded-2xl overflow-hidden bg-[#161B19] select-none cursor-grab active:cursor-grabbing shadow-inner"
          >
            {imageUrl && (
              <img
                ref={imgRef}
                src={imageUrl}
                alt="ครอปรูปภาพ"
                draggable={false}
                onLoad={(e) => {
                  const target = e.currentTarget;
                  setImgNatural({ w: target.naturalWidth, h: target.naturalHeight });
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: imgNatural ? imgNatural.w : 'auto',
                  height: imgNatural ? imgNatural.h : 'auto',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${displayScale})`,
                  transformOrigin: 'center center',
                }}
              />
            )}

            {/* Circular Avatar Cutout Mask Guide (dim outside, crystal clear inside) */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.52)',
                borderRadius: '9999px',
                border: '2px solid rgba(255, 255, 255, 0.92)',
              }}
            />

            {/* Subtle Drag Hint */}
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/55 text-white text-[10px] flex items-center gap-1">
              <Move className="w-3 h-3" />
              เลื่อนจัดหน้าให้อยู่ในวงกลม
            </div>
          </div>

          {/* Zoom Slider & Controls */}
          <div className="w-full space-y-2.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => updateZoom(zoom - 0.2)}
                className="p-1.5 rounded-lg border theme-subtle hover:bg-black/5 cursor-pointer"
                title="ย่อรูป"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={zoom}
                onChange={(e) => updateZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--theme-primary)] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => updateZoom(zoom + 0.2)}
                className="p-1.5 rounded-lg border theme-subtle hover:bg-black/5 cursor-pointer"
                title="ขยายรูป"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-semibold theme-muted-text w-10 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border theme-subtle text-xs font-medium hover:bg-black/5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                หมุนรูป 90°
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border theme-subtle text-xs font-medium hover:bg-black/5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                รีเซ็ต
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 theme-subtle border-t flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl border text-xs font-medium hover:bg-black/5 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!imgNatural || processing}
            onClick={handleConfirmCrop}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl theme-primary-btn text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            {processing ? 'กำลังประมวลผล...' : 'ใช้รูปนี้'}
          </button>
        </div>
      </div>
    </div>
  );
};
