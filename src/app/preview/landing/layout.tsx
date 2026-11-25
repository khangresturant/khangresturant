const font = { className: "font-sans" };

export default function PreviewLandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${font.className} antialiased`}>{children}</div>;
}
