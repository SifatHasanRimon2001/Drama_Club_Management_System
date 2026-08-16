import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { LivePageRefresh } from "@/components/live-refresh";
import { publicFetchFresh } from "@/lib/server";
import type { PublicAbout } from "@/lib/types";
import { Icon } from "@/components/icons";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const about = await publicFetchFresh<PublicAbout>("/api/public/about");

  if (about?.maintenanceMode) {
    return <MaintenanceScreen clubName={about?.clubName || "BRAC University Drama Club"} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/* Styling lives in the .skip-link rule so the focus treatment is defined
          once rather than as a chain of focus: variants. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <PublicNav clubName={about?.clubName || "BRAC University Drama Club"} logoUrl={about?.logoUrl} />
      <main id="main-content" className="flex-1">
        <LivePageRefresh />
        {children}
      </main>
      <PublicFooter
        clubName={about?.clubName || "BRAC University Drama Club"}
        contactEmail={about?.contactEmail || undefined}
      />
    </div>
  );
}

function MaintenanceScreen({ clubName }: { clubName: string }) {
  return (
    <div className="grain relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-4 text-center">
      <div className="aurora" aria-hidden="true" />
      <span className="relative flex size-16 items-center justify-center rounded-2xl border border-accent-soft-strong bg-accent-soft text-accent-ink">
        <Icon name="warn" size={26} />
      </span>
      <h1 className="display-title relative mt-7 text-ink">
        {clubName} is undergoing <span className="gradient-text">maintenance</span>
      </h1>
      <p className="relative mt-5 max-w-md text-[16px] leading-relaxed text-sub">
        We&apos;re making some improvements behind the scenes. Check back shortly —
        the stage will be ready soon.
      </p>
    </div>
  );
}
