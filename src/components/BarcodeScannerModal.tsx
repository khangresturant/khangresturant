import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, Loader2, Play, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);

  // Initialize and list cameras
  useEffect(() => {
    if (!isOpen) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Set default camera (back camera preferred if available)
          const backCam = devices.find((device) =>
            device.label.toLowerCase().includes("back") ||
            device.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          toast.error("No camera hardware found on this device.");
        }
      })
      .catch((err) => {
        console.error("Failed to get cameras: ", err);
        toast.error("Camera access denied or blocked by browser settings.");
      });

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async (cameraId: string) => {
    if (!cameraId) return;
    setLoading(true);
    try {
      if (qrCodeInstanceRef.current) {
        await stopCamera();
      }

      const instance = new Html5Qrcode("camera-scanner-viewfinder");
      qrCodeInstanceRef.current = instance;

      await instance.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 320, height: 160 },
          aspectRatio: 1.333333,
        },
        (decodedText) => {
          playBeep();
          onScanSuccess(decodedText);
          stopCamera();
          onClose();
        },
        (errorMessage) => {
          // Silent frame read failures
        }
      );
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Start camera failed: ", err);
      toast.error("Failed to start camera: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
      } catch (err) {
        console.error("Stop camera error: ", err);
      }
    }
    qrCodeInstanceRef.current = null;
    setIsCameraActive(false);
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn("Audio context beep failed: ", e);
    }
  };

  // Automatically start camera once selectedCameraId is resolved
  useEffect(() => {
    if (isOpen && selectedCameraId && !isCameraActive && !loading) {
      startCamera(selectedCameraId);
    }
  }, [isOpen, selectedCameraId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-indigo-50 text-indigo-650 rounded-lg flex items-center justify-center">
                  <Camera size={16} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Camera Barcode Scanner
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">The Accounts Point of Sale</p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="h-7 w-7 rounded-full hover:bg-slate-200 text-slate-450 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col items-center gap-4">
              {/* Camera Selector Dropdown */}
              {cameras.length > 1 && (
                <div className="w-full space-y-1">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">
                    Choose Scanner Device
                  </label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startCamera(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 h-9.5 rounded-xl px-3 text-xs font-bold text-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {cameras.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.label || `Camera ${device.id.substring(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Viewfinder element */}
              <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center">
                {isCameraActive && (
                  <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-80 h-40 border-[1px] border-slate-700/30 rounded-xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]">
                      {/* High-Tech Glowing Corner Brackets */}
                      <div className="absolute -top-[2px] -left-[2px] w-5 h-5 border-t-[3px] border-l-[3px] border-emerald-500 rounded-tl-lg shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <div className="absolute -top-[2px] -right-[2px] w-5 h-5 border-t-[3px] border-r-[3px] border-emerald-500 rounded-tr-lg shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <div className="absolute -bottom-[2px] -left-[2px] w-5 h-5 border-b-[3px] border-l-[3px] border-emerald-500 rounded-bl-lg shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <div className="absolute -bottom-[2px] -right-[2px] w-5 h-5 border-b-[3px] border-r-[3px] border-emerald-500 rounded-br-lg shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      
                      <motion.div
                        animate={{ top: ["4%", "96%", "4%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute left-1.5 right-1.5 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                      />
                    </div>
                    <p className="text-[10px] text-white font-bold tracking-wide mt-3 bg-slate-950/80 px-3 py-1 rounded-full">
                      Align barcode within the framing guide
                    </p>
                  </div>
                )}

                <div id="camera-scanner-viewfinder" className="w-full h-full object-cover" />

                {loading && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-2 text-white z-20">
                    <Loader2 size={24} className="animate-spin text-indigo-400" />
                    <span className="text-xs font-bold">Accessing camera stream...</span>
                  </div>
                )}

                {!isCameraActive && !loading && (
                  <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-3 text-white p-6 text-center z-20">
                    <Camera size={36} className="text-slate-500" />
                    <div>
                      <p className="text-xs font-black">Camera Stream Inactive</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                        The camera was stopped or permission was denied.
                      </p>
                    </div>
                    <button
                      onClick={() => startCamera(selectedCameraId)}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      <Play size={12} />
                      Start Camera
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              {isCameraActive ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Square size={12} />
                  Stop Feed
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
