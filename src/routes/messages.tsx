import { createFileRoute } from "@tanstack/react-router";
import { Archive, MessageCircle, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/marketplace/auth";
import { MessageService } from "@/marketplace/services";
import type { Conversation, Message } from "@/marketplace/types";
import { PageLoading } from "@/components/site/PageLoading";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages - ArtDera" },
      { name: "description", content: "Protected marketplace conversations on ArtDera." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, ready } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    MessageService.listConversations().then((result) => {
      if (result.data) {
        setConversations(result.data);
        const requested = new URLSearchParams(window.location.search).get("conversation");
        setSelected(
          result.data.some((item) => item.id === requested)
            ? requested!
            : (result.data[0]?.id ?? ""),
        );
      } else setNotice(result.error?.message ?? "Messages could not be loaded.");
      setLoading(false);
    });
  }, [ready, user]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    MessageService.getConversation(selected).then((result) => {
      if (result.data) {
        setMessages(result.data.messages);
        void MessageService.markRead(selected);
      } else setNotice(result.error?.message ?? "This conversation could not be opened.");
    });
  }, [selected]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("message") ?? "").trim();
    if (!text || !selected) return;
    const result = await MessageService.send(selected, text);
    if (result.data) {
      setMessages((current) => [...current, result.data!]);
      event.currentTarget.reset();
    } else setNotice(result.error?.message ?? "The message could not be sent.");
  };

  if (!ready) return <PageLoading label="Loading your messages" />;
  if (!user)
    return (
      <div className="container-editorial py-20 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-[var(--indigo)]" />
        <h1 className="mt-5 font-display text-5xl">Sign in to open your messages.</h1>
        <a href="/auth/login?redirect=/messages" className="btn-primary mt-6">
          Sign In
        </a>
      </div>
    );

  return (
    <div className="container-editorial py-12 lg:py-16">
      <div className="eyebrow">Protected messages</div>
      <h1 className="mt-3 font-display text-5xl">Conversations</h1>
      {notice && (
        <p className="mt-4 rounded-xl bg-[var(--porcelain)] p-4 text-sm" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading conversations…</p>
      ) : conversations.length ? (
        <div className="mt-8 grid min-h-[560px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--porcelain)] md:grid-cols-[280px_1fr]">
          <aside className="border-b border-[var(--color-border)] md:border-b-0 md:border-r">
            <div className="p-4 text-xs text-muted-foreground">
              {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
            </div>
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                onClick={() => setSelected(conversation.id)}
                className={`block w-full border-t border-[var(--color-border)] p-4 text-left ${selected === conversation.id ? "bg-[var(--ivory)]" : ""}`}
              >
                <div className="font-semibold">Artwork conversation</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {conversation.status} ·{" "}
                  {new Date(conversation.lastMessageAt).toLocaleDateString()}
                </div>
                {conversation.unreadCount > 0 && (
                  <span className="mt-2 inline-flex rounded-full bg-[var(--oxblood)] px-2 py-0.5 text-[10px] text-white">
                    {conversation.unreadCount} new
                  </span>
                )}
              </button>
            ))}
          </aside>
          <main className="flex min-h-[480px] flex-col">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
              <span className="font-semibold">Secure ArtDera thread</span>
              <button
                type="button"
                onClick={() =>
                  void MessageService.changeStatus(selected, "archive").then((result) => {
                    if (result.error) return setNotice(result.error.message);
                    if (result.data)
                      setConversations((current) =>
                        current.map((item) => (item.id === result.data!.id ? result.data! : item)),
                      );
                    setNotice("Conversation archived.");
                  })
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border"
                aria-label="Archive conversation"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[80%] rounded-2xl p-3 text-sm ${message.senderId === user.id ? "ml-auto bg-[var(--ink)] text-white" : "bg-[var(--ivory)]"}`}
                >
                  <p>{message.body}</p>
                  {message.attachments?.map((attachment) => (
                    <a
                      key={attachment.url}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block font-semibold underline"
                    >
                      {attachment.name}
                    </a>
                  ))}
                  <time className="mt-1 block text-[10px] opacity-55">
                    {new Date(message.createdAt).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
            <form
              onSubmit={submit}
              className="flex gap-2 border-t border-[var(--color-border)] p-4"
            >
              <input
                required
                name="message"
                maxLength={4000}
                className="art-field flex-1"
                placeholder="Write a protected message…"
              />
              <button className="btn-primary" aria-label="Send message">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </main>
        </div>
      ) : (
        <div className="mx-auto mt-12 max-w-xl text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-[var(--indigo)]" />
          <h2 className="mt-5 font-display text-4xl">No conversations yet.</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Ask a creator about dimensions, framing, commissions or delivery.
          </p>
          <a href="/discover" className="btn-primary mt-7">
            Find a Work to Discuss
          </a>
        </div>
      )}
    </div>
  );
}
