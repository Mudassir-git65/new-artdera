import { Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Heart,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store as StoreIcon,
  Tag,
  User,
  Users,
  Video,
  Globe,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth";
import { ARTWORKS, REVIEWS } from "./data";
import { formatPKR } from "./config";
import {
  FollowService,
  MessageService,
  NotificationService,
  OrderService,
  ShippingQuoteService,
  UserService,
  WishlistService,
  type ShippingQuote,
} from "./services";
import type { Artwork, Notification, Store } from "./types";
import { PageLoading } from "@/components/site/PageLoading";
import { AffiliateDashboard } from "./affiliate";

const navigation = [
  ["Profile", "profile", User],
  ["Orders", "orders", ShoppingBag],
  ["Wishlist", "wishlist", Heart],
  ["Followed Artists", "followed-artists", Users],
  ["Messages", "messages", MessageCircle],
  ["Offers", "offers", Tag],
  ["Shipping Quotes", "quotes", Globe],
  ["Video Consultations", "video-consultations", Video],
  ["Addresses", "addresses", MapPin],
  ["Reviews", "reviews", Star],
  ["Notifications", "notifications", Bell],
  ["Ambassador", "ambassador", Handshake],
  ["Security", "security", LockKeyhole],
  ["Settings", "settings", Settings],
] as const;

export function BuyerDashboard({ section = "profile" }: { section?: string }) {
  const { user, ready, logout } = useAuth();
  const returnPath = section === "profile" ? "/account" : `/account/${section}`;
  if (!ready) return <PageLoading label="Loading your collector account" />;
  if (!user)
    return (
      <div className="container-editorial flex min-h-[65vh] items-center justify-center py-14">
        <div className="max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-8 text-center">
          <LockKeyhole className="mx-auto h-9 w-9 text-[var(--oxblood)]" />
          <h1 className="mt-5 font-display text-4xl">Sign in required.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to view your purchases, saved work, messages and account settings.
          </p>
          <Link to="/auth/login" search={{ redirect: returnPath }} className="btn-primary mt-6">
            Sign in
          </Link>
        </div>
      </div>
    );
  const title = navigation.find((item) => item[1] === section)?.[0] ?? "Profile";
  const sellerWorkspace = ["artist", "gallery", "gallery_staff"].includes(user.role);
  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-[#f2ede4]">
      <div className="container-editorial py-8">
        <div className="mb-6">
          <div className="eyebrow">Your account</div>
          <h1 className="mt-2 font-display text-5xl">{title}</h1>
        </div>
        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          <aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-3 lg:sticky lg:top-28">
            <div className="border-b border-[var(--color-border)] p-3">
              <div className="font-semibold">{user.fullName}</div>
              <div className="mt-1 text-xs text-muted-foreground">{user.email}</div>
            </div>
            <nav
              className="no-scrollbar mt-3 flex gap-2 overflow-x-auto lg:grid"
              aria-label="Account navigation"
            >
              {navigation.map(([label, slug, Icon]) => (
                <a
                  key={slug}
                  href={slug === "profile" ? "/account" : `/account/${slug}`}
                  className={`flex min-h-11 min-w-max items-center gap-3 rounded-xl px-3 text-xs font-semibold ${section === slug ? "bg-[var(--ink)] text-[var(--ivory)]" : "hover:bg-[var(--ivory)]"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              ))}
            </nav>
            <div className="border-t border-[var(--color-border)] pt-3 mt-3 space-y-1">
              <a
                href={sellerWorkspace ? "/artist/dashboard" : "/sell"}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-[var(--oxblood)] px-3 text-xs font-semibold text-[var(--ivory)] hover:opacity-90 transition-opacity"
              >
                <StoreIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1">
                  {sellerWorkspace ? "Open seller dashboard" : "Start selling on ArtDera"}
                </span>
              </a>
              <button
                onClick={() => {
                  void logout().finally(() => window.location.assign("/"));
                }}
                className="flex min-h-11 w-full items-center gap-3 px-3 text-xs font-semibold text-muted-foreground"
              >
                <LockKeyhole className="h-4 w-4" />
                Log out
              </button>
            </div>
          </aside>
          <main className="min-w-0">
            <BuyerSection section={section} />
          </main>
        </div>
      </div>
    </div>
  );
}

function BuyerSection({ section }: { section: string }) {
  switch (section) {
    case "orders":
      return <BuyerOrders />;
    case "wishlist":
      return <BuyerWishlist />;
    case "followed-artists":
      return <FollowedArtists />;
    case "messages":
      return <BuyerMessages />;
    case "offers":
      return <Offers />;
    case "quotes":
      return <BuyerQuotes />;
    case "video-consultations":
      return <Consultations />;
    case "addresses":
      return <Addresses />;
    case "reviews":
      return <BuyerReviews />;
    case "notifications":
      return <BuyerNotifications />;
    case "ambassador":
      return <AffiliateDashboard />;
    case "security":
      return <Security />;
    case "settings":
      return <BuyerSettings />;
    default:
      return <BuyerProfile />;
  }
}
function BuyerProfile() {
  const { user } = useAuth();
  const [savedCount, setSavedCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  useEffect(() => {
    void Promise.all([WishlistService.list(), FollowService.list()]).then(([saved, following]) => {
      setSavedCount(saved.data?.length ?? 0);
      setFollowingCount(following.data?.length ?? 0);
    });
  }, []);
  const orders = user ? OrderService.listFor(user.id, "buyer") : [];
  const reviews = user ? REVIEWS.filter((review) => review.buyerId === user.id) : [];
  return (
    <div className="space-y-6">
      <BuyerPanel>
        <div className="grid gap-7 md:grid-cols-[1fr_auto]">
          <div>
            <div className="eyebrow">Welcome back</div>
            <h2 className="mt-2 font-display text-4xl">
              {user?.fullName}, your collection is taking shape.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Continue a conversation, check your preparing order or revisit work saved for later.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="/discover" className="btn-primary">
                Explore Art
              </a>
              <a href="/account/orders" className="btn-ghost">
                Track order
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Orders", String(orders.length)],
              ["Saved", String(savedCount)],
              ["Following", String(followingCount)],
              ["Reviews", String(reviews.length)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-28 rounded-xl bg-[var(--ivory)] p-4 text-center">
                <div className="font-display text-3xl">{value}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </BuyerPanel>
      <div className="grid gap-6 xl:grid-cols-2">
        <BuyerPanel>
          <div className="eyebrow">Explore the current catalogue</div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {ARTWORKS.slice(0, 3).map((item) => (
              <a key={item.id} href={`/product/${item.slug}`}>
                <img
                  src={item.images[0].url}
                  alt={item.title}
                  className="aspect-[4/5] w-full rounded-lg object-cover"
                />
                <div className="mt-2 truncate text-xs font-semibold">{item.title}</div>
              </a>
            ))}
          </div>
        </BuyerPanel>
        <BuyerPanel>
          <div className="eyebrow">Buyer protection</div>
          <div className="mt-5 space-y-3">
            {[
              "Seller information stays inside ArtDera before purchase.",
              "Order status and delivery milestones are visible in your account.",
              "Return eligibility is shown before checkout.",
            ].map((value) => (
              <div
                key={value}
                className="flex gap-3 rounded-xl bg-[var(--ivory)] p-4 text-xs leading-relaxed"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--indigo)]" />
                {value}
              </div>
            ))}
          </div>
        </BuyerPanel>
      </div>
    </div>
  );
}
function BuyerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(() => (user ? OrderService.listFor(user.id, "buyer") : []));
  useEffect(() => {
    void OrderService.refresh("buyer").then(() => {
      if (user) setOrders(OrderService.listFor(user.id, "buyer"));
    });
  }, [user]);
  return (
    <BuyerPanel>
      <div className="eyebrow">Orders</div>
      <div className="mt-5 space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="rounded-2xl border border-[var(--color-border)] p-5">
            <div className="grid gap-5 md:grid-cols-[90px_1fr_auto]">
              <img
                src={order.items[0].image}
                alt=""
                className="h-28 w-full rounded-lg object-cover"
              />
              <div>
                <div className="text-xs text-muted-foreground">{order.orderNumber}</div>
                <h2 className="mt-1 font-display text-2xl">{order.items[0].title}</h2>
                <div className="mt-2 text-sm font-semibold">{formatPKR(order.total)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="chip">{order.status}</span>
                  <span className="chip">Delivery to {order.deliveryCity}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    void OrderService.shipping(order.id).then((result) => {
                      if (result.error) return toast.error(result.error.message);
                      const shipment = result.data;
                      if (!shipment)
                        return toast.info("A shipment has not been created for this order yet.");
                      toast.info(
                        shipment.trackingNumber
                          ? `Tracking ${shipment.trackingNumber} · ${shipment.status}`
                          : `Shipment status: ${shipment.status}`,
                      );
                    })
                  }
                  className="btn-primary"
                >
                  Track order
                </button>
                <a href="/account/messages" className="btn-ghost">
                  Message artist
                </a>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-5 gap-1">
              {["Payment Confirmed", "Seller Confirmed", "Preparing", "Shipped", "Delivered"].map(
                (label, index, steps) => {
                  const current = steps.indexOf(
                    order.status === "Paid"
                      ? "Payment Confirmed"
                      : order.status === "Out for Delivery"
                        ? "Shipped"
                        : order.status === "Inspection Period" || order.status === "Completed"
                          ? "Delivered"
                          : order.status,
                  );
                  return (
                    <div key={label} className="text-center">
                      <div
                        className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[10px] ${current >= index ? "bg-[var(--success)] text-white" : "bg-[var(--ivory)]"}`}
                      >
                        {current >= index ? <Check className="h-3 w-3" /> : index + 1}
                      </div>
                      <div className="mt-2 text-[9px] text-muted-foreground">{label}</div>
                    </div>
                  );
                },
              )}
            </div>
          </article>
        ))}
        {!orders.length && (
          <BuyerEmpty
            icon={Package}
            title="No orders yet."
            body="Orders will appear here after checkout."
          />
        )}
      </div>
    </BuyerPanel>
  );
}
function BuyerWishlist() {
  const [items, setItems] = useState<Artwork[]>([]);
  useEffect(() => {
    void WishlistService.list().then((result) => {
      if (result.data) setItems(result.data);
      else if (result.error) toast.error(result.error.message);
    });
  }, []);
  return (
    <BuyerPanel>
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Saved artworks</div>
          <h2 className="mt-2 font-display text-3xl">{items.length} works to revisit</h2>
        </div>
        <a href="/discover" className="btn-ghost">
          Explore more
        </a>
      </div>
      {items.length ? (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
          {items.map((item) => (
            <article key={item.id}>
              <div className="relative">
                <a href={`/product/${item.slug}`}>
                  <img
                    src={item.images[0].url}
                    alt={item.title}
                    className="aspect-[4/5] w-full rounded-xl object-cover"
                  />
                </a>
                <button
                  onClick={() =>
                    void WishlistService.remove(item.id).then((result) => {
                      if (result.error) return toast.error(result.error.message);
                      setItems((values) => values.filter((value) => value.id !== item.id));
                    })
                  }
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--porcelain)]"
                  aria-label={`Remove ${item.title}`}
                >
                  <Heart className="h-4 w-4" fill="currentColor" />
                </button>
              </div>
              <div className="mt-3 font-display text-xl">{item.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{formatPKR(item.price)}</div>
            </article>
          ))}
        </div>
      ) : (
        <BuyerEmpty
          icon={Heart}
          title="Your wishlist is empty."
          body="Save work while you compare scale, colour and placement."
        />
      )}
    </BuyerPanel>
  );
}
function FollowedArtists() {
  const [stores, setStores] = useState<Store[]>([]);
  useEffect(() => {
    void FollowService.list().then((result) => {
      if (result.data) setStores(result.data);
      else if (result.error) toast.error(result.error.message);
    });
  }, []);
  return (
    <BuyerPanel>
      <div className="eyebrow">Followed stores</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {stores.map((store) => (
          <article
            key={store.id}
            className="overflow-hidden rounded-2xl border border-[var(--color-border)]"
          >
            <img src={store.coverImage} alt="" className="h-28 w-full object-cover" />
            <div className="p-4">
              <div className="flex items-center gap-3">
                <img
                  src={store.profileImage}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-display text-xl">{store.name}</div>
                  <div className="text-xs text-muted-foreground">{store.location}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <a href={`/store/${store.slug}`} className="btn-primary flex-1">
                  View store
                </a>
                <button
                  onClick={() =>
                    void FollowService.unfollow(store.id).then((result) => {
                      if (result.error) return toast.error(result.error.message);
                      setStores((items) => items.filter((item) => item.id !== store.id));
                      toast.success("Store unfollowed");
                    })
                  }
                  className="btn-ghost"
                >
                  Following
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!stores.length && (
        <BuyerEmpty
          icon={Users}
          title="You are not following any stores."
          body="Follow a store to keep it close at hand."
        />
      )}
    </BuyerPanel>
  );
}
function BuyerMessages() {
  return (
    <BuyerPanel>
      <div className="py-10 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-[var(--oxblood)]" />
        <h2 className="mt-4 font-display text-3xl">Protected marketplace messages</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Conversations, offers and consultation requests are loaded from your authenticated
          account.
        </p>
        <a href="/messages" className="btn-primary mt-5">
          Open messages
        </a>
      </div>
    </BuyerPanel>
  );
}
function Offers() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Array<Record<string, any>>>([]);
  useEffect(() => {
    void MessageService.listConversations().then(async (result) => {
      if (!result.data) return;
      const details = await Promise.all(
        result.data
          .filter((conversation) => conversation.buyerId === user?.id)
          .map((conversation) => MessageService.getConversation(conversation.id)),
      );
      setOffers(details.flatMap((detail) => detail.data?.offers ?? []));
    });
  }, [user?.id]);
  return (
    <BuyerPanel>
      <div className="eyebrow">Offers</div>
      <div className="mt-5 space-y-4">
        {offers.map((offer) => {
          const artwork = ARTWORKS.find((item) => item.id === offer.artworkId);
          const update = async (action: "accept" | "reject" | "withdraw") => {
            const result = await MessageService.updateOffer(offer.id, action);
            if (result.error) return toast.error(result.error.message);
            setOffers((items) =>
              items.map((item) =>
                item.id === offer.id
                  ? {
                      ...item,
                      status:
                        action === "accept"
                          ? "Accepted"
                          : action === "reject"
                            ? "Rejected"
                            : "Withdrawn",
                    }
                  : item,
              ),
            );
          };
          return (
            <article
              key={offer.id}
              className="grid gap-5 rounded-2xl border border-[var(--color-border)] p-5 sm:grid-cols-[100px_1fr_auto]"
            >
              {artwork && (
                <img
                  src={artwork.images[0].url}
                  alt=""
                  className="aspect-[4/5] w-full rounded-lg object-cover"
                />
              )}
              <div>
                <div className="font-display text-2xl">{artwork?.title ?? "Artwork offer"}</div>
                <div className="mt-4 text-sm">
                  Your offer <strong>{formatPKR(Number(offer.amount))}</strong>
                </div>
                {offer.counterPrice && (
                  <div className="mt-2 text-sm">
                    Artist counter <strong>{formatPKR(Number(offer.counterPrice))}</strong>
                  </div>
                )}
              </div>
              <div>
                <span className="chip">{offer.status}</span>
                {["Pending", "Countered"].includes(String(offer.status)) && (
                  <div className="mt-4 grid gap-2">
                    {offer.status === "Countered" && (
                      <button onClick={() => void update("accept")} className="btn-primary">
                        Accept
                      </button>
                    )}
                    <button
                      onClick={() =>
                        void update(offer.status === "Pending" ? "withdraw" : "reject")
                      }
                      className="btn-ghost"
                    >
                      {offer.status === "Pending" ? "Withdraw" : "Decline"}
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!offers.length && (
        <BuyerEmpty
          icon={Tag}
          title="No offers yet."
          body="Offers made through ArtDera will appear here."
        />
      )}
    </BuyerPanel>
  );
}
function Consultations() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Array<Record<string, any>>>([]);
  useEffect(() => {
    void MessageService.listConversations().then(async (result) => {
      if (!result.data) return;
      const details = await Promise.all(
        result.data
          .filter((conversation) => conversation.buyerId === user?.id)
          .map((conversation) => MessageService.getConversation(conversation.id)),
      );
      setConsultations(details.flatMap((detail) => detail.data?.consultations ?? []));
    });
  }, [user?.id]);
  return (
    <BuyerPanel>
      <div className="eyebrow">Video consultations</div>
      <div className="mt-5 space-y-4">
        {consultations.map((consultation) => (
          <div
            key={consultation.id}
            className="rounded-2xl border border-[var(--color-border)] p-5"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row">
              <div>
                <span className="chip">{String(consultation.status).replaceAll("_", " ")}</span>
                <h2 className="mt-4 font-display text-3xl">Private artwork viewing</h2>
                <div className="mt-2 text-xs text-muted-foreground">
                  <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                  {new Date(consultation.preferredDate).toLocaleDateString("en-PK")} ·{" "}
                  {consultation.preferredTime} {consultation.timezone}
                </div>
              </div>
              <div className="flex gap-2">
                {consultation.meetingLink && (
                  <a
                    href={consultation.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary"
                  >
                    Open meeting
                  </a>
                )}
                {["requested", "accepted", "alternate_suggested"].includes(
                  String(consultation.status),
                ) && (
                  <button
                    onClick={() =>
                      void MessageService.updateConsultation(consultation.id, {
                        action: "cancel",
                      }).then((result) => {
                        if (result.error) return toast.error(result.error.message);
                        setConsultations((items) =>
                          items.map((item) =>
                            item.id === consultation.id ? { ...item, status: "cancelled" } : item,
                          ),
                        );
                      })
                    }
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!consultations.length && (
        <BuyerEmpty
          icon={Video}
          title="No consultations scheduled."
          body="Request a private artwork viewing from a product or store page."
        />
      )}
    </BuyerPanel>
  );
}
function Addresses() {
  return (
    <BuyerPanel>
      <div className="eyebrow">Delivery addresses</div>
      <h2 className="mt-2 font-display text-3xl">Entered securely during checkout.</h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        ArtDera snapshots the delivery and billing address onto each order. It does not expose an
        address publicly or invent a saved default address for your account.
      </p>
      <a href="/cart" className="btn-primary mt-6">
        Go to cart
      </a>
    </BuyerPanel>
  );
}
function BuyerReviews() {
  const { user } = useAuth();
  const reviews = user ? REVIEWS.filter((review) => review.buyerId === user.id) : [];
  return (
    <BuyerPanel>
      <div className="eyebrow">Your reviews</div>
      <div className="mt-5 space-y-4">
        {reviews.map((review) => (
          <article key={review.id} className="rounded-2xl border border-[var(--color-border)] p-5">
            <div className="flex text-amber-500">
              {Array.from({ length: review.rating }, (_, index) => (
                <Star key={index} className="h-4 w-4" fill="currentColor" />
              ))}
            </div>
            <h2 className="mt-3 font-semibold">{review.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{review.body}</p>
            <span className="chip mt-4">{review.status}</span>
          </article>
        ))}
      </div>
      {!reviews.length && (
        <BuyerEmpty
          icon={Star}
          title="No reviews yet."
          body="A review can be submitted after an eligible order is completed."
        />
      )}
    </BuyerPanel>
  );
}
function BuyerNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  useEffect(() => {
    void NotificationService.list().then((result) => {
      if (result.data) setItems(result.data);
      else if (result.error) toast.error(result.error.message);
    });
  }, []);
  return (
    <BuyerPanel>
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Notifications</div>
          <h2 className="mt-2 font-display text-3xl">Updates that matter.</h2>
        </div>
        <button
          onClick={() =>
            void NotificationService.readAll().then((result) => {
              if (result.error) return toast.error(result.error.message);
              setItems((values) => values.map((item) => ({ ...item, read: true })));
            })
          }
          className="btn-ghost"
        >
          Mark all read
        </button>
      </div>
      <div className="mt-5 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex gap-4 rounded-xl p-4 ${item.read ? "border border-[var(--color-border)]" : "bg-[var(--ivory)]"}`}
          >
            <Bell className="h-4 w-4 text-[var(--oxblood)]" />
            <div className="flex-1">
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.body}</div>
            </div>
            <button
              onClick={() =>
                void NotificationService.remove(item.id).then((result) => {
                  if (result.error) return toast.error(result.error.message);
                  setItems((values) => values.filter((value) => value.id !== item.id));
                })
              }
              className="text-xs text-muted-foreground"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </BuyerPanel>
  );
}
function Security() {
  return (
    <div className="space-y-6">
      <BuyerPanel>
        <div className="eyebrow">Password and sessions</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() =>
              void UserService.revokeOtherSessions().then((result) =>
                result.error
                  ? toast.error(result.error.message)
                  : toast.success(`${result.data?.revoked ?? 0} other sessions signed out`),
              )
            }
            className="btn-ghost justify-start"
          >
            <ShieldCheck className="h-4 w-4" />
            Sign out other sessions
          </button>
        </div>
      </BuyerPanel>
      <BuyerPanel>
        <div className="eyebrow">Current session</div>
        <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--ivory)] p-4">
          <div>
            <div className="font-semibold">This browser</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Active now · protected by an HTTP-only session cookie
            </div>
          </div>
          <span className="chip">Current</span>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          The API validates this session and the account role again for every protected request.
        </p>
      </BuyerPanel>
    </div>
  );
}
function BuyerSettings() {
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    email: true,
    inApp: true,
    marketing: false,
    orderUpdates: true,
    messageUpdates: true,
  });
  useEffect(() => {
    void NotificationService.preferences().then((result) => {
      if (result.data) setPreferences(result.data);
    });
  }, []);
  return (
    <div className="space-y-6">
      <BuyerPanel>
        <div className="eyebrow">Notification preferences</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Email notifications", "email"],
            ["In-app notifications", "inApp"],
            ["Recommendations", "marketing"],
            ["Order updates", "orderUpdates"],
            ["Messages and offers", "messageUpdates"],
          ].map(([label, key]) => (
            <label
              key={key}
              className="flex min-h-12 items-center justify-between rounded-xl border border-[var(--color-border)] px-4 text-sm"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(preferences[key])}
                onChange={(event) =>
                  setPreferences((current) => ({ ...current, [key]: event.target.checked }))
                }
                className="accent-[var(--oxblood)]"
              />
            </label>
          ))}
        </div>
        <button
          onClick={() =>
            void NotificationService.updatePreferences(preferences).then((result) =>
              result.error ? toast.error(result.error.message) : toast.success("Preferences saved"),
            )
          }
          className="btn-primary mt-6"
        >
          Save preferences
        </button>
      </BuyerPanel>
    </div>
  );
}
function BuyerQuotes() {
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void ShippingQuoteService.list().then((result) => {
      if (result.data) setQuotes(result.data);
      else toast.error(result.error?.message ?? "Failed to load shipping quotes.");
      setLoading(false);
    });
  }, []);

  const acceptQuote = async (id: string) => {
    const result = await ShippingQuoteService.accept(id);
    if (result.error) return toast.error(result.error.message);
    toast.success("Quote accepted. You can now continue to secure checkout.");
    setQuotes((items) =>
      items.map((item) => (item.id === id ? { ...item, status: "accepted" } : item)),
    );
  };

  if (loading) {
    return (
      <BuyerPanel>
        <div className="py-10 text-center">Loading your quotes...</div>
      </BuyerPanel>
    );
  }

  return (
    <BuyerPanel>
      <div className="eyebrow">Shipping Quotes</div>
      <div className="mt-5 space-y-4">
        {quotes.map((quote) => (
          <article
            key={quote.id}
            className="grid gap-5 rounded-2xl border border-[var(--color-border)] p-5 md:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="font-display text-2xl">Artwork Delivery to {quote.country}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Requested for: {String(quote.artwork?.title ?? quote.artworkId)}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Destination: {quote.shippingAddress}, {quote.city}
                {quote.province ? `, ${quote.province}` : ""}, {quote.postalCode}, {quote.country}
              </div>
              {quote.quotedShippingCost !== undefined && (
                <div className="mt-4 text-sm">
                  Shipping and packaging:{" "}
                  <strong>
                    {formatPKR(quote.quotedShippingCost + (quote.quotedPackagingCost ?? 0))}
                  </strong>
                  {quote.estimatedDeliveryTime ? ` · ${quote.estimatedDeliveryTime}` : ""}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end justify-between gap-4">
              <span className="chip uppercase">{quote.status}</span>
              {["quote_provided", "quote_sent"].includes(quote.status) && (
                <button onClick={() => void acceptQuote(quote.id)} className="btn-primary">
                  Accept Quote
                </button>
              )}
              {quote.status === "accepted" && (
                <a
                  href={`/checkout?shippingQuoteId=${encodeURIComponent(quote.id)}`}
                  className="btn-primary"
                >
                  Continue to Checkout
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
      {!quotes.length && (
        <BuyerEmpty
          icon={Globe}
          title="No shipping quotes requested."
          body="For international orders, you can request a custom shipping quote from the artwork page."
        />
      )}
    </BuyerPanel>
  );
}

function BuyerPanel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] p-5 md:p-6">
      {children}
    </section>
  );
}
function BuyerEmpty({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="py-14 text-center">
      <Icon className="mx-auto h-8 w-8 text-[var(--oxblood)]" />
      <h2 className="mt-4 font-display text-3xl">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <a href="/discover" className="btn-primary mt-5">
        Explore Art
      </a>
    </div>
  );
}
