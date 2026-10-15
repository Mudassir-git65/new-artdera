import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useRouterState } from "@tanstack/react-router";
import { exhibitionLaunchIsLive } from "@/marketplace/exhibition-launch";

export function ExhibitionNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const landing = pathname === "/exhibition" || pathname === "/exhibition/";
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 45);
    const updateLaunch = () => setLive(exhibitionLaunchIsLive(Date.now()));
    update();
    updateLaunch();
    window.addEventListener("scroll", update, { passive: true });
    const timer = window.setInterval(updateLaunch, 1000);
    return () => {
      window.removeEventListener("scroll", update);
      window.clearInterval(timer);
    };
  }, []);
  const links = [
    ["The preview", "/exhibition#exhibition-preview"],
    ["The artists", "/exhibition#meet-the-artists"],
    ["Our story", "/exhibition#exhibition-story"],
  ];
  return (
    <header className={`launch-nav ${scrolled || menu || !landing ? "is-scrolled" : ""}`}>
      <div className="launch-nav-inner">
        <Logo variant="light" />
        <nav aria-label="Exhibition navigation" className="launch-nav-links">
          {links.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
          <a className="launch-market-link" href="/discover">
            Marketplace <ArrowUpRight size={12} />
          </a>
        </nav>
        <a
          className="launch-nav-cta"
          href={live ? "/exhibition#viewing-rooms" : "/exhibition#private-collector-preview"}
        >
          {live ? "Enter exhibition" : "Get early access"}
          <ArrowUpRight size={14} />
        </a>
        <button
          className="launch-menu-toggle"
          aria-label={menu ? "Close exhibition menu" : "Open exhibition menu"}
          aria-expanded={menu}
          aria-controls="exhibition-mobile-navigation"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menu && (
        <nav
          id="exhibition-mobile-navigation"
          aria-label="Mobile exhibition navigation"
          className="launch-mobile-nav"
        >
          {[...links, ["Explore the marketplace", "/discover"]].map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>
              {label}
              <ArrowUpRight size={18} />
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
export function ExhibitionFooter() {
  return (
    <footer className="launch-footer">
      <div>
        <Logo variant="light" />
        <p>Pakistan’s artists. A world of possibility.</p>
      </div>
      <nav aria-label="Exhibition footer">
        <a href="/discover">
          Explore ArtDera <ArrowUpRight size={13} />
        </a>
        <a href="/sell">For artists</a>
        <a href="/legal/privacy">Privacy</a>
        <a href="/help">Contact</a>
      </nav>
      <span>© {new Date().getFullYear()} ArtDera</span>
    </footer>
  );
}
