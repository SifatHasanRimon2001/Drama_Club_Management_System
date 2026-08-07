import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
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
    return <MaintenanceScreen clubName={about?.clubName || "Drama Club"} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas dark:bg-black">
      <PublicNav clubName={about?.clubName || "Drama Club"} logoUrl={about?.logoUrl} />
      <main className="flex-1">{children}</main>
      <PublicFooter
        clubName={about?.clubName || "Drama Club"}
        contactEmail={about?.contactEmail || undefined}
      />
    </div>
  );
}

function MaintenanceScreen({ clubName }: { clubName: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center dark:bg-black">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent dark:bg-accent/20">
        <Icon name="warn" size={26} />
      </span>
      <h1 className="display-title mt-6 text-ink dark:text-gray-50">
        {clubName} is undergoing maintenance
      </h1>
      <p className="mt-4 max-w-md text-[16px] leading-relaxed text-sub dark:text-gray-400">
        We&apos;re making some improvements behind the scenes. Check back shortly —
        the stage will be ready soon.
      </p>
    </div>
  );
}
