import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export interface SerialScaleState {
  weight: number;
  isConnected: boolean;
  isMock: boolean;
  connectScale: () => Promise<void>;
  disconnectScale: () => Promise<void>;
  setMockWeight: (weight: number) => void;
}

export function useSerialScale(): SerialScaleState {
  const [weight, setWeight] = useState<number>(0.0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isMock, setIsMock] = useState<boolean>(false);
  
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(false);

  // Auto-detect if browser lacks WebSerial support
  useEffect(() => {
    if (typeof window !== "undefined" && !("serial" in navigator)) {
      setIsMock(true);
      console.warn("WebSerial API not supported in this browser. Mock scale mode enabled.");
    }
  }, []);

  const connectScale = async () => {
    if (isMock) {
      setIsConnected(true);
      toast.info("Mock scale connected. Adjust weight manually using UI controls.");
      return;
    }

    try {
      // Request user access to select COM port
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      
      portRef.current = port;
      setIsConnected(true);
      keepReadingRef.current = true;
      toast.success("Weighing scale connected!");

      readSerialData();
    } catch (err: any) {
      console.error("WebSerial connection failed:", err);
      setIsMock(true);
      setIsConnected(true);
      toast.warning("WebSerial connection failed. Switched to Mock Scale Mode.");
    }
  };

  const readSerialData = async () => {
    if (!portRef.current) return;

    while (portRef.current.readable && keepReadingRef.current) {
      readerRef.current = portRef.current.readable.getReader();
      try {
        let buffer = "";
        while (keepReadingRef.current) {
          const { value, done } = await readerRef.current.read();
          if (done) break;

          // Convert bytes to ASCII string
          const chunk = new TextDecoder().decode(value);
          buffer += chunk;

          // Parse matching carriage return / newline delimiters
          if (buffer.includes("\n") || buffer.includes("\r")) {
            const lines = buffer.split(/[\r\n]+/);
            // Process the last complete line
            const completeLine = lines[lines.length - 2];
            if (completeLine) {
              parseWeightLine(completeLine);
            }
            buffer = lines[lines.length - 1] || "";
          }
        }
      } catch (err) {
        console.error("Error reading serial scale data:", err);
      } finally {
        if (readerRef.current) {
          readerRef.current.releaseLock();
          readerRef.current = null;
        }
      }
    }
  };

  const parseWeightLine = (line: string) => {
    // Standard scale output format containing numbers: e.g., "ST,GS,+00.450kg" or "0.450"
    const match = line.match(/[-+]?[0-9]*\.[0-9]+/);
    if (match) {
      const parsedWeight = parseFloat(match[0]);
      if (!isNaN(parsedWeight)) {
        // Apply stabilization buffer logic (round to 3 decimal places)
        setWeight(Math.round(parsedWeight * 1000) / 1000);
      }
    }
  };

  const disconnectScale = async () => {
    keepReadingRef.current = false;
    
    if (readerRef.current) {
      await readerRef.current.cancel();
    }

    if (portRef.current) {
      await portRef.current.close();
      portRef.current = null;
    }

    setIsConnected(false);
    setWeight(0.0);
    toast.info("Weighing scale disconnected.");
  };

  const setMockWeight = (mockVal: number) => {
    if (isMock) {
      setWeight(Math.round(mockVal * 1000) / 1000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keepReadingRef.current = false;
    };
  }, []);

  return {
    weight,
    isConnected,
    isMock,
    connectScale,
    disconnectScale,
    setMockWeight
  };
}
