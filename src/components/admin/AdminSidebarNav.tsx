"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_SECTIONS } from "@/lib/admin/admin-nav";

type AdminSidebarNavProps = {
  showCollapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
};

function isLinkActive(pathname: string, path: string): boolean {
  if (path === "/admin") return pathname === "/admin";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function AdminSidebarNav({ showCollapsed, isMobile, onClose }: AdminSidebarNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5 custom-scrollbar min-h-0">
      {ADMIN_NAV_SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1">
          {!showCollapsed ? (
            <div className="flex items-center gap-2 px-2 mb-2">
              <span className="admin-sb-section-dot h-1.5 w-1.5 rounded-full" />
              <p className="admin-sb-section-label text-[10px] font-black uppercase tracking-[0.18em]">
                {section.title}
              </p>
            </div>
          ) : (
            <div className="admin-sb-divider border-t my-2 mx-1" />
          )}
          <div className="space-y-0.5">
            {section.links.map((link) => {
              const active = isLinkActive(pathname, link.path);
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => isMobile && onClose()}
                  aria-current={active ? "page" : undefined}
                  title={showCollapsed ? link.name : undefined}
                  className={`admin-sb-nav-link group relative flex items-center rounded-xl transition-all duration-200 ${
                    showCollapsed ? "justify-center p-3" : "gap-3 px-3.5 py-2.5"
                  } ${active ? "is-active" : ""}`}
                >
                  <Icon
                    size={18}
                    className={`admin-sb-nav-icon shrink-0 transition-all duration-200 ${
                      active ? "text-white" : "group-hover:scale-110"
                    }`}
                  />
                  {!showCollapsed && (
                    <div className="min-w-0 flex-1">
                      <span
                        className={`block text-[13px] font-semibold tracking-wide truncate ${
                          active ? "text-white" : "admin-sb-text-primary"
                        }`}
                      >
                        {link.name}
                      </span>
                      {link.description ? (
                        <span className="block text-[10px] font-medium truncate admin-sb-meta mt-0.5">
                          {link.description}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {showCollapsed && (
                    <div className="admin-sb-tooltip absolute left-full ml-3 px-3 py-1.5 text-xs rounded-lg border opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-200 whitespace-nowrap shadow-2xl z-50 font-semibold">
                      {link.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
