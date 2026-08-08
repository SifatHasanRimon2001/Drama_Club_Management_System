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
    <div className="flex min-h-dvh flex-col bg-canvas dark:bg-surface-dark">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-full focus:bg-gradient-to-br focus:from-gold-light focus:via-gold focus:to-[#1e40af] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center dark:bg-surface-dark">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent dark:bg-accent/20">
        <Icon name="warn" size={26} />
      </span>
      <h1 className="display-title mt-6 text-ink dark:text-[#faf4e6]">
        {clubName} is undergoing maintenance
      </h1>
      <p className="mt-4 max-w-md text-[16px] leading-relaxed text-sub dark:text-slate-400">
        We&apos;re making some improvements behind the scenes. Check back shortly —
        the stage will be ready soon.
      </p>
    </div>
  );
}
