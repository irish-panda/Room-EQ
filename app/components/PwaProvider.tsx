"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaContextValue = {
  canInstall: boolean;
  isIosInstallAvailable: boolean;
  install: () => Promise<void>;
};

const PwaContext = createContext<PwaContextValue>({
  canInstall: false,
  isIosInstallAvailable: false,
  install: async () => undefined,
});

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIosInstallAvailable, setIsIosInstallAvailable] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIosInstallAvailable(ios && !isStandalone());

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setIsIosInstallAvailable(false);
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }, [promptEvent]);

  const value = useMemo(
    () => ({
      canInstall: Boolean(promptEvent) && !installed,
      isIosInstallAvailable: isIosInstallAvailable && !installed,
      install,
    }),
    [installed, install, isIosInstallAvailable, promptEvent],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function InstallAppControl({ compact = false }: { compact?: boolean }) {
  const { canInstall, isIosInstallAvailable, install } = useContext(PwaContext);

  if (!canInstall && !isIosInstallAvailable) return null;

  if (isIosInstallAvailable) {
    return (
      <p className={`install-app-hint${compact ? " compact" : ""}`}>
        On iPhone or iPad, tap Share, then Add to Home Screen.
      </p>
    );
  }

  return (
    <button
      className={`button secondary install-app-button${compact ? " compact" : ""}`}
      type="button"
      onClick={() => void install()}
    >
      Install Room EQ app
    </button>
  );
}
