import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="not-found-surface px-4 text-center">
      <div className="max-w-md text-center">
        <div className="eyebrow-chip mx-auto">Signal lost</div>
        <h1 className="mt-7 text-7xl font-bold tracking-[-0.08em] text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="solar-button inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium transition-transform"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
