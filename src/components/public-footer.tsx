import Link from "next/link";
import { ClubLogo } from "@/components/club-logo";
import { Container } from "@/components/ui/layout";

export function PublicFooter({
  clubName,
  contactEmail,
}: {
  clubName: string;
  contactEmail?: string;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-gray-200/80 bg-gray-950 text-left dark:border-white/8 dark:bg-[#0a0f1a]">
      <Container size="page" className="pt-12 pb-10">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <ClubLogo size={28} />
              <span className="font-display text-left text-[14px] font-bold tracking-tight text-gray-100">
                {clubName || "BRAC University Drama Club"}
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-gray-400">
              Creating unforgettable performances, one production at a time.
            </p>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-300">
              Explore
            </h4>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { href: "/about", label: "About Us" },
                { href: "/committee", label: "Committee" },
                { href: "/departments", label: "Departments" },
                { href: "/productions", label: "Productions" },
                { href: "/events", label: "Events" },
                { href: "/gallery", label: "Gallery" },
                { href: "/recruitment", label: "Recruitment" },
                { href: "/contact", label: "Contact" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-gray-400 transition hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-300">
              Members
            </h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/login"
                  className="text-[13px] text-gray-400 transition hover:text-white"
                >
                  Member Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-[13px] text-gray-400 transition hover:text-white"
                >
                  Create an Account
                </Link>
              </li>
              {contactEmail && (
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="inline-block max-w-full break-all text-[13px] leading-relaxed text-gray-400 transition hover:text-white"
                  >
                    {contactEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/8 pt-6 sm:justify-between">
          <p className="text-center text-[12px] leading-relaxed text-gray-500 sm:text-left">
            © {year} {clubName || "BRAC University Drama Club"}. All rights reserved.
          </p>
          <p className="text-[12px] text-gray-500">Made with passion for the stage.</p>
        </div>
      </Container>
    </footer>
  );
}
