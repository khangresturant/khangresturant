export interface ElectronPrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export interface ElectronThermalPrintResult {
  success: boolean;
  printer?: string;
  error?: string;
}

export interface ElectronSystemInfo {
  version: string;
  platform: string;
  isDesktop: boolean;
  isPackaged: boolean;
}

export interface ElectronAPIBridge {
  isDesktop: boolean;
  getPrinters: () => Promise<ElectronPrinterInfo[]>;
  printThermalSilent: (
    html: string,
    printerName?: string,
    copies?: number
  ) => Promise<ElectronThermalPrintResult>;
  getSystemInfo: () => Promise<ElectronSystemInfo>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPIBridge;
  }
}
