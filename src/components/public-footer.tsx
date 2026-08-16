import Link from "next/link";
import { ClubLogo } from "@/components/club-logo";
import { Container } from "@/components/ui/layout";
import { Icon } from "@/components/icons";

const EXPLORE_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/committee", label: "Committee" },
  { href: "/departments", label: "Departments" },
  { href: "/productions", label: "Productions" },
  { href: "/events", label: "Events" },
  { href: "/gallery", label: "Gallery" },
  { href: "/recruitment", label: "Recruitment" },
  { href: "/contact", label: "Contact" },
];

export function PublicFooter({
  clubName,
  contactEmail,
}: {
  clubName: string;
  contactEmail?: string;
}) {
  const year = new Date().getFullYear();
  const name = clubName || "BRAC University Drama Club";

  return (
    <footer className="relative isolate mt-auto overflow-hidden border-t border-line bg-card">
      {/* Violet horizon glow rising from the bottom edge — closes the page with
          the same ambient light the hero opens it with. */}
      <div
        className="pointer-events-none absolute inset-x-0 -bottom-40 h-80 bg-[radial-gradient(50%_100%_at_50%_100%,var(--color-accent-soft-strong),transparent_70%)]"
        aria-hidden="true"
      />

      <Container size="wide" className="relative pb-10 pt-16 2xl:max-w-[1440px]">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          {/* Identity */}
          <div className="grid content-start gap-4">
            <Link
              href="/"
              className="inline-grid min-h-11 w-fit grid-flow-col items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <ClubLogo size={30} />
              <span className="font-display min-w-0 text-[14.5px] font-bold tracking-[-0.02em] text-ink">
                {name}
              </span>
            </Link>
            <p className="max-w-xs text-[13px] leading-relaxed text-sub">
              Creating unforgettable performances, one production at a time.
            </p>
            {contactEmail && (
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex min-h-11 w-fit max-w-full items-center gap-2 break-all rounded-lg text-[13px] text-sub transition hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Icon name="mail" size={14} className="shrink-0 text-faint" />
                {contactEmail}
              </a>
            )}
          </div>

          {/* Explore */}
          <nav className="grid content-start gap-4" aria-label="Footer">
            <h2 className="label-caps">Explore</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {EXPLORE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-9 items-center rounded-lg text-[13px] text-sub transition-colors hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Members */}
          <nav className="grid content-start gap-4" aria-label="Member area">
            <h2 className="label-caps">Members</h2>
            <ul className="grid gap-y-1">
              <li>
                <Link
                  href="/login"
                  className="inline-flex min-h-9 items-center rounded-lg text-[13px] text-sub transition-colors hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Member Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="inline-flex min-h-9 items-center rounded-lg text-[13px] text-sub transition-colors hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Create an Account
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-9 items-center rounded-lg text-[13px] text-sub transition-colors hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Member Area
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <hr className="divider-glow mt-14" />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-between">
          <p className="text-center text-[12px] leading-relaxed text-faint sm:text-left">
            © {year} {name}. All rights reserved.
          </p>
          <p className="text-[12px] text-faint">Made with passion for the stage.</p>
        </div>
      </Container>
    </footer>
  );
}
