import Image from "next/image";
import { FLAME9 } from "@/lib/deployment/flame9-brand";

type Props = {
  subtitle?: string;
  shopLogo?: string | null;
  shopName?: string | null;
};

export function Flame9PosHeaderBrand({ subtitle = "Restaurant POS Desk", shopLogo, shopName }: Props) {
  const logo = shopLogo || FLAME9.logoPath;
  const title = shopName || FLAME9.fullName;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-7 w-7 rounded-lg overflow-hidden ring-1 ring-[#FF4D00]/50 shrink-0 bg-zinc-900 flex items-center justify-center">
        {logo ? (
          <Image src={logo} alt="" width={28} height={28} className="h-full w-full object-contain" unoptimized />
        ) : (
          <span className="text-[10px] font-black text-[#FF8A3D]">F9</span>
        )}
      </div>
      <div className="min-w-0 leading-tight">
        <span className="font-display block text-xs tracking-wide text-white truncate">{title}</span>
        <span className="block text-[9px] font-semibold text-[#FF8A3D]/90 truncate">{subtitle}</span>
      </div>
    </div>
  );
}
