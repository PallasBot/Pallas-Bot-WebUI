import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type HomeLazyRevealVariant = "account-social" | "version-dl" | "stats-4" | "stats-5";

const STAT_COUNTS: Record<"stats-4" | "stats-5", number> = {
  "stats-4": 4,
  "stats-5": 5,
};

function AccountSocialPlaceholder() {
  return (
    <div className="home-lazy-skel home-lazy-skel--account-social">
      <div className="home-lazy-skel__chip-row home-lazy-skel__chip-row--social">
        {[0, 1].map((n) => (
          <div key={`chip-social-${n}`} className="home-lazy-skel__chip skel-pulse">
            <div className="home-lazy-skel__chip-label" />
            <div className="home-lazy-skel__chip-value" />
          </div>
        ))}
      </div>
      <div className="home-lazy-skel__chip-row home-lazy-skel__chip-row--traffic">
        {[0, 1].map((n) => (
          <div key={`chip-traffic-${n}`} className="home-lazy-skel__chip skel-pulse">
            <div className="home-lazy-skel__chip-label" />
            <div className="home-lazy-skel__chip-value" />
          </div>
        ))}
      </div>
      <div className="home-lazy-skel__pending-row">
        {[0, 1].map((n) => (
          <div key={`pending-${n}`} className="home-lazy-skel__pending-card skel-pulse">
            <div className="home-lazy-skel__pending-title" />
            <div className="home-lazy-skel__pending-value" />
          </div>
        ))}
      </div>
    </div>
  );
}

function VersionDlPlaceholder() {
  return (
    <div className="home-lazy-skel home-lazy-skel--version-dl">
      {Array.from({ length: 4 }, (_, n) => (
        <div key={`ver-${n}`} className="home-lazy-skel__version-row skel-pulse" />
      ))}
    </div>
  );
}

function StatsGridPlaceholder({ count }: { count: number }) {
  return (
    <div
      className={cn(
        "home-lazy-skel home-lazy-skel--stats-grid",
        `home-lazy-skel--stats-grid-${count}`,
      )}
    >
      {Array.from({ length: count }, (_, n) => (
        <div key={`stat-${n}`} className="home-lazy-skel__stat-card skel-pulse">
          <div className="home-lazy-skel__stat-label" />
          <div className="home-lazy-skel__stat-value" />
          <div className="home-lazy-skel__stat-hint" />
        </div>
      ))}
    </div>
  );
}

function Placeholder({ variant }: { variant: HomeLazyRevealVariant }) {
  if (variant === "account-social") return <AccountSocialPlaceholder />;
  if (variant === "version-dl") return <VersionDlPlaceholder />;
  return <StatsGridPlaceholder count={STAT_COUNTS[variant]} />;
}

export default function HomeLazyReveal({
  loading = false,
  variant = "stats-4",
  stagger = true,
  ariaLabel = "加载中",
  children,
}: {
  loading?: boolean;
  variant?: HomeLazyRevealVariant;
  stagger?: boolean;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="home-lazy-reveal"
      aria-busy={loading || undefined}
      aria-label={loading ? ariaLabel : undefined}
    >
      {loading ? (
        <div className="home-lazy-reveal__placeholder" key="loading">
          <Placeholder variant={variant} />
        </div>
      ) : (
        <div
          key="ready"
          className={cn(
            "home-lazy-reveal__body",
            stagger && variant === "account-social" && "home-lazy-reveal__body--stagger-account",
            stagger && variant !== "account-social" && "home-lazy-reveal__body--stagger",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
