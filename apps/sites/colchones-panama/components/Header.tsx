"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV = [
  { label: "Mejores Colchones", href: "/mejores" },
  { label: "Guías", href: "/blog" },
  { label: "Blog", href: "/blog" },
  { label: "Quiz", href: "/quiz" },
  { label: "Sobre Nosotros", href: "/sobre" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-bg-light/95 dark:bg-bg-dark/95 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-gray-800"
          : "bg-bg-light dark:bg-bg-dark"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl select-none">🌙</span>
            <span className="font-serif font-bold text-xl text-primary dark:text-text-dark group-hover:text-accent-600 transition-colors">
              ColchonesPanamá
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded-lg transition-all"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/quiz"
              className="ml-3 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Hacer Quiz →
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-bg-light dark:bg-bg-dark px-4 py-4">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded-xl transition-all"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/quiz"
              onClick={() => setOpen(false)}
              className="mt-2 px-4 py-3 bg-accent-600 text-white text-sm font-semibold rounded-xl text-center"
            >
              Hacer Quiz →
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
