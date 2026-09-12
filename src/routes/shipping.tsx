import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, PackageCheck, Globe2 } from "lucide-react";
import { generateMeta, generateBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/shipping")({
  head: () => {
    const seo = generateMeta({
      title: "Art Packaging & Delivery Timelines | ArtDera Shipping Policy",
      description:
        "Learn about ArtDera's art packaging standards, tracked courier shipping across Pakistan and international destinations, insurance, and dispatch timelines.",
      canonicalPath: "/shipping",
    });

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Shipping & Delivery", path: "/shipping" },
            ]),
          ),
        },
      ],
    };
  },
  component: ShippingPage,
});

function ShippingPage() {
  return (
    <div className="container-editorial py-12 lg:py-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li>
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li>/</li>
          <li className="font-semibold text-foreground">Shipping Policy</li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <div className="eyebrow">Logistics &amp; Care</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl">
          Artwork Packaging &amp; Tracked Shipping
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Artwork requires specialized handling. ArtDera enforces strict packaging guidelines so
          your canvas, paper work, or framed glass arrives in pristine condition.
        </p>
      </header>

      <section className="mt-16 grid gap-8 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <PackageCheck className="h-6 w-6 text-[var(--indigo)]" />
          <h2 className="mt-4 font-display text-2xl">Museum Packaging</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Works are wrapped in acid-free glassine paper, corner guards, bubble wrap, and
            reinforced heavy-duty wooden or cardboard crates.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <Truck className="h-6 w-6 text-[var(--indigo)]" />
          <h2 className="mt-4 font-display text-2xl">Tracked Dispatch</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            All orders are shipped via vetted courier partners with real-time tracking numbers sent
            directly to your email and account dashboard.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--porcelain)] p-6">
          <Globe2 className="h-6 w-6 text-[var(--indigo)]" />
          <h2 className="mt-4 font-display text-2xl">Nationwide &amp; Global</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We support deliveries across all major cities in Pakistan as well as international
            shipping for overseas collectors.
          </p>
        </div>
      </section>

      <section className="mt-16 max-w-3xl">
        <h2 className="font-display text-3xl">International Shipping Quotes</h2>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            For international collectors, we offer a dedicated shipping quote process to ensure you
            receive the most accurate and competitive shipping rate for your artwork.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Request a Quote:</strong> Click the "Request Shipping Quote" button on any
              artwork page. Fill in your delivery details, including your country and postal code.
            </li>
            <li>
              <strong>Logistics Calculation:</strong> Our team works with premium international
              couriers (such as DHL, FedEx) to calculate a secure and insured shipping rate based on
              the artwork's dimensions, weight, and your location.
            </li>
            <li>
              <strong>Review and Accept:</strong> You will receive a notification in your buyer
              dashboard within 24-48 hours with the finalized shipping price.
            </li>
            <li>
              <strong>Checkout:</strong> Once you accept the quote, you can proceed to checkout. The
              shipping fee will be automatically added to your cart, and you can complete your
              purchase securely.
            </li>
          </ul>
          <p className="mt-4 border-l-2 border-[var(--oxblood)] pl-4 italic text-foreground">
            Note: International buyers are responsible for any customs duties, taxes, or import fees
            levied by their respective countries.
          </p>
        </div>
      </section>
    </div>
  );
}
