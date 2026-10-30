import { Plus_Jakarta_Sans } from "next/font/google";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function PreviewLandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${font.className} antialiased`}>{children}</div>;
}
