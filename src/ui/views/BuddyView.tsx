import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Bot, CheckSquare2, Clock3, MapPin, MessageCircle, MessageSquareText, Plus, Sparkles, UserRound } from "lucide-react";
import { respondToBuddy, type ClassBudStateV2 } from "../../domain";

interface Message {
  id: string;
  role: "buddy" | "user";
  body: string;
  choices?: Array<{ id: string; label: string }>;
}

const QUICK_PROMPTS = [
  { label: "What’s next?", icon: Clock3 },
  { label: "Where is Math?", icon: MapPin },
  { label: "Open tasks", icon: CheckSquare2 },
  { label: "Who teaches Game Design?", icon: UserRound },
];

export function BuddyView({ state }: { state: ClassBudStateV2 }) {
  const assistantName = state.settings.assistantName?.trim() || "Buddy";
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "buddy", body: `Hi Win — I’m ${assistantName}. Ask me about your timetable, rooms, teachers, or tasks.` },
  ]);
  const messageLogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = useMemo(() => QUICK_PROMPTS, []);

  useEffect(() => {
    const log = messageLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const response = respondToBuddy(trimmed, state);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", body: trimmed },
      { id: crypto.randomUUID(), role: "buddy", body: response.text, choices: response.choices },
    ]);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function newChat() {
    setMessages([
      { id: crypto.randomUUID(), role: "buddy", body: `Hi Win — I’m ${assistantName}. Ask me about your timetable, rooms, teachers, or tasks.` },
    ]);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(query);
  }

  return (
    <div className="page page--buddy">
      <header className="page-heading buddy-heading">
        <span className="buddy-avatar" aria-hidden="true"><Bot /></span>
        <div><p>Your private, offline school assistant</p><h1>{assistantName}</h1></div>
        <div className="buddy-heading__actions"><span className="offline-status"><i /> Offline &amp; private</span><button className="secondary-button secondary-button--small" type="button" onClick={newChat}><Plus aria-hidden="true" /> New chat</button></div>
      </header>
      <section className="buddy-panel" aria-label={`Chat with ${assistantName}`}>
        <div ref={messageLogRef} className="buddy-messages" role="log" aria-live="polite">
          {messages.length === 1 ? <div className="buddy-welcome"><span aria-hidden="true"><MessageSquareText /></span><h2>Chat with {assistantName}</h2><p>Ask about your timetable, rooms, teachers, or unfinished tasks. Everything stays on this device.</p></div> : messages.map((message) => (
            <div className={`message message--${message.role}`} key={message.id}>
              {message.role === "buddy" ? <span className="message__avatar" aria-hidden="true"><Sparkles /></span> : null}
              <div className="message__content">
                <p>{message.body}</p>
                {message.choices?.length ? (
                  <div className="message__choices" aria-label="Choose a subject">
                    {message.choices.map((choice) => (
                      <button key={choice.id} type="button" onClick={() => submit(choice.label)}>{choice.label}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="quick-prompts" aria-label="Suggested questions">
          {suggestions.map(({ label, icon: Icon }) => (
            <button key={label} type="button" onClick={() => submit(label)}><Icon aria-hidden="true" /> {label}</button>
          ))}
        </div>
        <form className="buddy-composer" onSubmit={onSubmit}>
          <MessageCircle aria-hidden="true" />
          <label className="sr-only" htmlFor="buddy-query">Ask Buddy</label>
          <textarea ref={inputRef} id="buddy-query" rows={1} value={query} placeholder={`Message ${assistantName}…`} maxLength={300} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(query);
            }
          }} />
          <button type="submit" aria-label="Send message" disabled={!query.trim()}><ArrowUp aria-hidden="true" /></button>
        </form>
        <p className="buddy-disclaimer">Buddy answers from your saved ClassBud data. No message leaves this device.</p>
      </section>
    </div>
  );
}
