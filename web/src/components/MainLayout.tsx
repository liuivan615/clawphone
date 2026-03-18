import { useState, useCallback, createContext, useContext, type ReactNode } from "react";

interface Props {
  leftDrawer: ReactNode;
  rightDrawer: ReactNode;
  children: ReactNode;
}

interface LayoutCtx {
  toggleLeft: () => void;
  toggleRight: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
}

const MainLayoutContext = createContext<LayoutCtx>({
  toggleLeft: () => {},
  toggleRight: () => {},
  leftOpen: false,
  rightOpen: false,
});

export function useLayout() {
  return useContext(MainLayoutContext);
}

export function MainLayout({ leftDrawer, rightDrawer, children }: Props) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const toggleLeft = useCallback(() => {
    setLeftOpen((v) => !v);
    setRightOpen(false);
  }, []);

  const toggleRight = useCallback(() => {
    setRightOpen((v) => !v);
    setLeftOpen(false);
  }, []);

  const closeAll = useCallback(() => {
    setLeftOpen(false);
    setRightOpen(false);
  }, []);

  return (
    <div className="relative h-full overflow-hidden flex" style={{ background: "var(--bg-root)" }}>
      {/* Tablet: persistent left sidebar */}
      <aside
        className="hidden lg:flex flex-col w-[320px] shrink-0"
        style={{ background: "var(--bg-primary)" }}
      >
        {leftDrawer}
      </aside>

      {/* Mobile: left drawer overlay */}
      {leftOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="backdrop-enter absolute inset-0"
            style={{ background: "var(--drawer-backdrop)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
            onClick={closeAll}
          />
          <div className="drawer-enter-left drawer-glass relative z-10 h-full w-[300px] max-w-[85vw] flex flex-col border-r"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {leftDrawer}
          </div>
        </div>
      )}

      {/* Center area */}
      <main className="flex-1 flex flex-col min-w-0 h-full" style={{ background: "var(--bg-glow)" }}>
        <MainLayoutContext.Provider value={{ toggleLeft, toggleRight, leftOpen, rightOpen }}>
          {children}
        </MainLayoutContext.Provider>
      </main>

      {/* Tablet: persistent right sidebar */}
      <aside
        className="hidden xl:flex flex-col w-[340px] shrink-0"
        style={{ background: "var(--bg-primary)" }}
      >
        {rightDrawer}
      </aside>

      {/* Mobile: right drawer overlay */}
      {rightOpen && (
        <div className="xl:hidden fixed inset-0 z-40 flex justify-end">
          <div
            className="backdrop-enter absolute inset-0"
            style={{ background: "var(--drawer-backdrop)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
            onClick={closeAll}
          />
          <div className="drawer-enter-right drawer-glass relative z-10 h-full w-[340px] max-w-[90vw] flex flex-col border-l"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {rightDrawer}
          </div>
        </div>
      )}
    </div>
  );
}
