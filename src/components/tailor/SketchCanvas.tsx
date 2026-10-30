"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Pencil, Eraser, Trash2, Download, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface SketchCanvasProps {
  /** Supabase Storage signed URL to load existing sketch */
  existingSketchUrl?: string;
  /** Called with base64 PNG data string when user saves */
  onSave: (base64Data: string) => Promise<void>;
  readOnly?: boolean;
}

type Tool = "pen" | "eraser";
type HistoryEntry = ImageData;

export function SketchCanvas({ existingSketchUrl, onSave, readOnly = false }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [brushSize, setBrushSize] = useState<number>(3);
  const [color, setColor] = useState<string>("#1e293b");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyPointerRef = useRef<number>(-1);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load existing sketch if URL provided
    if (existingSketchUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveHistory(ctx, canvas);
      };
      img.src = existingSketchUrl;
    } else {
      saveHistory(ctx, canvas);
    }
  }, [existingSketchUrl]);

  const saveHistory = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Trim forward history when drawing after undo
    historyRef.current = historyRef.current.slice(0, historyPointerRef.current + 1);
    historyRef.current.push(imageData);
    // Cap history to 30 snapshots to manage memory
    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    }
    historyPointerRef.current = historyRef.current.length - 1;
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  }, [readOnly]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPos.current) return;
    e.preventDefault();

    const pos = getPos(e, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? brushSize * 4 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPos.current = pos;
  }, [isDrawing, readOnly, tool, color, brushSize]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPos.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    saveHistory(ctx, canvas);
  }, [isDrawing]);

  const undo = () => {
    if (historyPointerRef.current <= 0) {
      toast.info("Nothing more to undo.");
      return;
    }
    historyPointerRef.current -= 1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(historyRef.current[historyPointerRef.current], 0, 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory(ctx, canvas);
    toast.info("Canvas cleared.");
  };

  const downloadSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `tailor-sketch-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    try {
      const base64 = canvas.toDataURL("image/png");
      await onSave(base64);
      toast.success("Sketch saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save sketch: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const COLORS = ["#1e293b", "#dc2626", "#2563eb", "#16a34a", "#9333ea", "#d97706", "#0891b2", "#be185d"];

  return (
    <div className="flex flex-col gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Tool buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTool("pen")}
              title="Pen"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${tool === "pen" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setTool("eraser")}
              title="Eraser"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${tool === "eraser" ? "bg-white shadow-sm text-rose-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Eraser size={14} />
            </button>
          </div>

          {/* Brush size */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Size:</span>
            <input
              type="range"
              min={1}
              max={20}
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-20 h-1 accent-indigo-600 cursor-pointer"
            />
            <span className="font-mono text-slate-700 w-4">{brushSize}</span>
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool("pen"); }}
                title={c}
                className={`h-5 w-5 rounded-full border-2 transition-all cursor-pointer ${color === c && tool === "pen" ? "border-indigo-500 scale-125" : "border-transparent hover:scale-110"}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); setTool("pen"); }}
              className="h-5 w-5 rounded-full cursor-pointer border-0 bg-transparent"
              title="Custom color"
            />
          </div>

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={undo} title="Undo" className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer">
              <Undo2 size={14} />
            </button>
            <button onClick={clearCanvas} title="Clear" className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer">
              <Trash2 size={14} />
            </button>
            <button onClick={downloadSketch} title="Download" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer">
              <Download size={14} />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
            >
              <Save size={12} />
              {isSaving ? "Saving..." : "Save Sketch"}
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="relative rounded-xl border-2 border-dashed border-slate-200 overflow-hidden" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={520}
          className="w-full h-auto block"
          style={{ cursor: tool === "eraser" ? "cell" : "crosshair", userSelect: "none" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {readOnly && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/5 rounded-xl pointer-events-none">
            <span className="text-xs font-semibold text-slate-400 bg-white/80 px-2 py-1 rounded-lg">Read Only</span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Draw custom stitching patterns and measurement guides. Supports touch and mouse inputs.
      </p>
    </div>
  );
}
