import Link from "next/link";
import { Icon } from "@/components/icons";

export function PublicFooter({
  clubName,
  contactEmail,
}: {
  clubName: string;
  contactEmail?: string;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-white/60 backdrop-blur dark:bg-white/[0.03]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-white">
                <Icon name="sparkles" size={14} />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-ink dark:text-gray-100">
                {clubName || "Drama Club"}
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-sub dark:text-gray-400">
              Creating unforgettable performances, one production at a time.
            </p>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold uppercase tracking-wider text-faint">
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
                    className="text-[13.5px] text-sub transition hover:text-accent dark:text-gray-400"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold uppercase tracking-wider text-faint">
              Members
            </h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/login"
                  className="text-[13.5px] text-sub transition hover:text-accent dark:text-gray-400"
                >
                  Member Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-[13.5px] text-sub transition hover:text-accent dark:text-gray-400"
                >
                  Create an Account
                </Link>
              </li>
              {contactEmail && (
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-[13.5px] text-sub transition hover:text-accent dark:text-gray-400"
                  >
                    {contactEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-10 flex items-center justify-between border-t border-line pt-6 dark:border-white/10">
          <p className="text-[12.5px] text-faint">
            © {year} {clubName || "Drama Club"}. All rights reserved.
          </p>
          <p className="text-[12.5px] text-faint">Made with passion for the stage.</p>
        </div>
      </div>
    </footer>
  );
}
