import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import {
  BookOpen,
  Bot,
  CalendarDays,
  CheckSquare2,
  Command,
  ListPlus,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { ClassBudStateV2 } from "../../domain";
import { searchState, type SearchResult } from "../utils";

const NAVIGATION = [
  { to: "/today", label: "Today", icon: Sparkles },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/tasks", label: "Tasks", icon: CheckSquare2 },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/buddy", label: "Buddy", icon: Bot },
];
const MOBILE_NAVIGATION = NAVIGATION.filter(({ to }) => to !== "/subjects");

type AppShellProps = PropsWithChildren<{
  state: ClassBudStateV2;
  onAdd: () => void;
  onSelectSession: (id: string) => void;
  onEditTask: (id: string) => void;
  onEditSubject: (id: string) => void;
}>;

export function AppShell({ state, onAdd, onSelectSession, onEditTask, onEditSubject, children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const location = useLocation();
  const navigate = useNavigate();
  const results = useMemo(() => searchState(state, query), [query, state]);

  const openSearch = useCallback(() => {
    if (searchOpen) {
      inputRef.current?.focus();
      return;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : searchTriggerRef.current;
    restoreFocusRef.current = true;
    setSearchOpen(true);
  }, [searchOpen]);

  const closeSearch = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setSearchOpen(false);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const onDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onDialogKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onDialogKeyDown);
      if (restoreFocusRef.current) returnFocusRef.current?.focus();
    };
  }, [closeSearch, searchOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  function selectResult(result: SearchResult) {
    closeSearch(false);
    if (result.kind === "session") {
      onSelectSession(result.id);
      navigate("/schedule");
    } else if (result.kind === "task") {
      navigate("/tasks");
      onEditTask(result.id);
    } else {
      navigate("/subjects");
      onEditSubject(result.id);
    }
    setQuery("");
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header glass-surface">
        <NavLink className="brand" to="/today" aria-label="ClassBud home">
          <span className="brand__mark" aria-hidden="true">
            <CalendarDays />
          </span>
          <span>ClassBud <b>2.0</b></span>
        </NavLink>

        <nav className="primary-nav" aria-label="Primary navigation">
          {NAVIGATION.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "is-active" : "")}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <button
            ref={searchTriggerRef}
            className="search-trigger"
            type="button"
            aria-label="Search ClassBud"
            aria-expanded={searchOpen}
            onClick={openSearch}
          >
            <Search aria-hidden="true" />
            <span>Search</span>
            <kbd><Command aria-hidden="true" /> K</kbd>
          </button>
          <button
            className="primary-button primary-button--compact"
            type="button"
            aria-label={`Add from ${location.pathname.slice(1) || "ClassBud"}`}
            onClick={onAdd}
          >
            <Plus aria-hidden="true" />
            <span>Add</span>
          </button>
          <NavLink className="icon-button" to="/settings" aria-label="Open settings">
            <Settings aria-hidden="true" />
          </NavLink>
        </div>
      </header>

      {searchOpen ? (
        <div className="search-layer" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeSearch();
        }}>
          <section ref={dialogRef} className="command-menu" role="dialog" aria-modal="true" aria-label="Search ClassBud">
            <div className="command-menu__input">
              <Search aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                placeholder="Search subjects, rooms, teachers, tasks…"
                aria-label="Search"
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="icon-button icon-button--small" type="button" aria-label="Close search" onClick={() => closeSearch()}>
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="command-menu__results" aria-live="polite">
              {!query ? (
                <div className="command-menu__hint">
                  <Search aria-hidden="true" />
                  <p>Find any subject, teacher, room, or task.</p>
                  <span>Results stay on this device.</span>
                </div>
              ) : results.length ? (
                <ul>
                  {results.map((result) => (
                    <li key={`${result.kind}-${result.id}`}>
                      <button type="button" onClick={() => selectResult(result)}>
                        <span className="result-icon" data-kind={result.kind} aria-hidden="true">
                          {result.kind === "session" ? <CalendarDays /> : result.kind === "task" ? <CheckSquare2 /> : <BookOpen />}
                        </span>
                        <span>
                          <strong>{result.title}</strong>
                          <small>{result.detail}</small>
                        </span>
                        <span className="result-kind">{result.kind}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="command-menu__hint">
                  <Search aria-hidden="true" />
                  <p>No results for “{query}”</p>
                  <span>Try a subject code, teacher, or room.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <main id="main-content" className="app-main" tabIndex={-1}>
        {children}
      </main>

      <nav className="mobile-tabbar glass-surface" aria-label="Mobile navigation">
        {MOBILE_NAVIGATION.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "is-active" : "")}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        className="mobile-add-button"
        type="button"
        aria-label={`Add from ${location.pathname.slice(1) || "ClassBud"}`}
        onClick={onAdd}
      >
        <ListPlus aria-hidden="true" />
      </button>
    </div>
  );
}
