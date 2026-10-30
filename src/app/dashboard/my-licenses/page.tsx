"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Key, Download, ShieldCheck, Copy, Check, ExternalLink, Laptop, RefreshCw, AlertCircle } from 'lucide-react';
import { SOFTWARE_PRODUCTS } from '@/lib/software-catalog';

interface UserLicense {
  id: string;
  softwareSlug: string;
  softwareName: string;
  licenseKey: string;
  purchasedAt: string;
  status: 'active' | 'pending_verification' | 'expired';
  activatedDevices: number;
  maxDevices: number;
  downloadUrl: string;
}

export default function MyLicensesDashboardPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Mock purchased licenses list for demonstration & client UI
  const mockLicenses: UserLicense[] = [
    {
      id: 'lic-101',
      softwareSlug: 'The Accounts-pharmacy-vip',
      softwareName: 'The Accounts VIP Pharmacy POS & ERP',
      licenseKey: 'HBX-PHARM-89A12-45F89-99B01',
      purchasedAt: '2026-08-10',
      status: 'active',
      activatedDevices: 1,
      maxDevices: 2,
      downloadUrl: '/downloads/TheAccounts_Pharmacy_Setup.exe',
    },
    {
      id: 'lic-102',
      softwareSlug: 'The Accounts-restaurant-pos',
      softwareName: 'The Accounts Restaurant & Cafe POS',
      licenseKey: 'HBX-RESTO-77C34-12D90-44E55',
      purchasedAt: '2026-08-15',
      status: 'active',
      activatedDevices: 1,
      maxDevices: 1,
      downloadUrl: '/downloads/TheAccounts_Restaurant_Setup.exe',
    }
  ];

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-lg font-black text-slate-100 tracking-tight flex items-center gap-3">
            <Key className="w-8 h-8 text-emerald-400" />
            <span>My Desktop Software Licenses</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your purchased software licenses, view serial activation keys, and download installer setups.
          </p>
        </div>

        <Link
          href="/softwares"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all text-center"
        >
          Buy New Software License
        </Link>
      </div>

      {/* Licenses List */}
      <div className="space-y-4">
        {mockLicenses.map((lic) => {
          const productInfo = SOFTWARE_PRODUCTS.find(p => p.slug === lic.softwareSlug);

          return (
            <div 
              key={lic.id}
              className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto shadow-xl backdrop-blur-md relative overflow-hidden"
            >
              {/* Status Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">{lic.softwareName}</h3>
                    <p className="text-xs text-slate-400">Purchased on {lic.purchasedAt} � Lifetime Valid</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active License
                  </span>
                </div>
              </div>

              {/* License Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Serial Key Box */}
                <div className="md:col-span-2 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Product Serial Key</span>
                  <div className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 rounded-lg border border-slate-800/80 font-mono text-emerald-300 font-bold text-sm sm:text-base">
                    <span className="select-all tracking-wider">{lic.licenseKey}</span>
                    <button
                      onClick={() => handleCopy(lic.licenseKey)}
                      className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Copy Key"
                    >
                      {copiedKey === lic.licenseKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Paste this serial key inside your desktop application to complete activation.
                  </p>
                </div>

                {/* Device Activation Info */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Device Activations</span>
                    <div className="flex items-center gap-2 mt-2">
                      <Laptop className="w-5 h-5 text-blue-400" />
                      <span className="text-lg font-bold text-slate-200">{lic.activatedDevices} / {lic.maxDevices} PC(s) Active</span>
                    </div>
                  </div>

                  <a
                    href={lic.downloadUrl}
                    download
                    className="w-full py-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Installer (.exe)</span>
                  </a>
                </div>

              </div>

              {/* Activation Instructions Helper */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/60 text-xs text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>How to Activate on your Computer:</span>
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 pt-1">
                  <li>Download and install the setup file on your Windows PC.</li>
                  <li>Launch the application and copy your computer&apos;s Hardware ID (HWID).</li>
                  <li>Enter the Product Key above and click <strong>Activate Software</strong>.</li>
                </ol>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
