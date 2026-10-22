import Header from "./Header";

// What a component page shows while its data loads. Kept outside the lazy
// ComponentDetail chunk so it is also the fallback while that chunk loads,
// and the page goes from skeleton to content with no blank frame in between.
export default function ComponentDetailSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-bg-secondary rounded w-48" />
          <div className="h-4 bg-bg-secondary rounded w-96" />
          <div className="h-64 bg-bg-secondary rounded" />
        </div>
      </div>
    </div>
  );
}
