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
    <footer className="relative border-t border-gray-200/80 bg-gray-950 text-left dark:border-line dark:bg-surface-dark">
      <Container size="wide" className="pt-12 pb-10 2xl:max-w-[1440px]">
        <div className="grid gap-10 sm:grid-cols-3">
          <div className="grid content-start gap-3">
            <div className="grid grid-flow-col auto-cols-max items-center gap-2.5">
              <ClubLogo size={28} />
              <span className="min-w-0 font-display text-left text-[14px] font-bold tracking-tight text-gray-100">
                {clubName || "BRAC University Drama Club"}
              </span>
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed text-gray-400">
              Creating unforgettable performances, one production at a time.
            </p>
          </div>
          <div className="grid content-start gap-3">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-300">
              Explore
            </h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
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
          <div className="grid content-start gap-3">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-300">
              Members
            </h4>
            <ul className="grid gap-y-2">
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
