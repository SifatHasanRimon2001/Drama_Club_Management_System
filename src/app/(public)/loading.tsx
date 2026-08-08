import { SkeletonBlock } from "@/components/ui/feedback";
import { Container, Grid } from "@/components/ui/layout";

export default function PublicLoading() {
  return (
    <Container size="article" className="pb-24 pt-28">
      <SkeletonBlock className="h-3.5 w-24" />
      <SkeletonBlock className="mt-4 h-12 w-3/4 max-w-xl" />
      <SkeletonBlock className="mt-5 h-5 w-2/3 max-w-md" />
      <Grid preset="cards" className="mt-14">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-44" />
        ))}
      </Grid>
    </Container>
  );
}
