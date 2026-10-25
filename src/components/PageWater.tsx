/**
 * The page is the glass. A fixed body of water sits behind everything and
 * its surface rises as you scroll, so reading the page fills it.
 *
 * Driven entirely by a CSS scroll timeline: no scroll listener, no state,
 * nothing on the main thread per frame. Browsers without scroll-driven
 * animation get a still, part-full page, which is a fine picture rather
 * than a broken one.
 *
 * The water is a deep tint rather than the bright cyan of the vessel,
 * because text has to stay readable once the surface passes it.
 */
export default function PageWater() {
    return (
        <div className="page-water" aria-hidden="true">
            <div className="page-water-body">
                <svg
                    className="page-water-surface"
                    viewBox="0 0 1200 48"
                    preserveAspectRatio="none"
                    width="100%"
                    height="48"
                >
                    <path
                        className="page-water-wave back"
                        d="M0 26 q 150 -20 300 0 q 150 20 300 0 q 150 -20 300 0 q 150 20 300 0 q 150 -20 300 0 q 150 20 300 0 q 150 -20 300 0 q 150 20 300 0 L2400 48 L0 48 Z"
                    />
                    <path
                        className="page-water-wave front"
                        d="M0 30 q 150 -16 300 0 q 150 16 300 0 q 150 -16 300 0 q 150 16 300 0 q 150 -16 300 0 q 150 16 300 0 q 150 -16 300 0 q 150 16 300 0 L2400 48 L0 48 Z"
                    />
                    <path
                        className="page-water-crest"
                        fill="none"
                        d="M0 30 q 150 -16 300 0 q 150 16 300 0 q 150 -16 300 0 q 150 16 300 0 q 150 -16 300 0 q 150 16 300 0 q 150 -16 300 0 q 150 16 300 0"
                    />
                </svg>
                <div className="page-water-depth" />
            </div>
        </div>
    );
}
