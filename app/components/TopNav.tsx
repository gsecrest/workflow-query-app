"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/",                  label: "RO Team Query" },
  { href: "/ro-attributes",     label: "RO Form Attributes" },
  { href: "/ro-workflow-blocks", label: "RO Workflow Blocks" },
  { href: "/bo-workflows",      label: "BO Workflow Attributes" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 px-8 py-0 flex items-center gap-0">
      <span className="text-sm font-bold text-gray-900 pr-8 py-4 border-r border-gray-200 mr-6 whitespace-nowrap">
        Ivanti Workflow Tools
      </span>
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              active
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
