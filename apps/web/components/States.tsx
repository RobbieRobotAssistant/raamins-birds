export function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square w-full bg-[#ece8dd]" />
          <div className="mt-2 h-3 w-3/4 bg-[#ece8dd]" />
          <div className="mt-1.5 h-2 w-1/2 bg-[#ece8dd]" />
        </div>
      ))}
    </div>
  );
}

export function LoadingRows() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-6 w-full bg-[#ece8dd]" />
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="border hairline border-dashed py-16 text-center">
      <p className="serif text-lg text-muted">{message}</p>
      <p className="label mt-2">check back soon</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="border hairline border-dashed py-12 text-center">
      <p className="serif text-lg text-ink">Could not load data.</p>
      <p className="label mt-2">{message}</p>
    </div>
  );
}
