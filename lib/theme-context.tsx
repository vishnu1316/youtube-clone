"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  autoTheme: boolean;
  toggleTheme: () => void;
  setAutoTheme: (auto: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  autoTheme: true,
  toggleTheme: () => {},
  setAutoTheme: () => {},
});

function getIstHour(): number {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600000;
  const istDate = new Date(istMs);
  return istDate.getHours();
}

function getAutoTheme(): Theme {
  const hour = getIstHour();
  return hour >= 5 && hour < 12 ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme>("light");
  const [autoTheme, setAutoThemeState] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const storedAuto = localStorage.getItem("autoTheme");

    if (storedAuto === "false") {
      setAutoThemeState(false);
      if (stored) {
        setTheme(stored);
        applyTheme(stored);
        return;
      }
    }

    const auto = getAutoTheme();
    setTheme(auto);
    applyTheme(auto);
  }, []);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data } = await supabase
        .from("user_theme_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const userAuto = data.auto_theme;
        setAutoThemeState(userAuto);

        if (userAuto) {
          const auto = getAutoTheme();
          setTheme(auto);
          applyTheme(auto);
        } else {
          setTheme(data.theme as Theme);
          applyTheme(data.theme as Theme);
        }
      } else {
        const auto = getAutoTheme();
        setTheme(auto);
        applyTheme(auto);
        await supabase.from("user_theme_preferences").insert({
          user_id: user.id,
          theme: auto,
          auto_theme: true,
        });
      }
    })();
  }, [user]);

  const applyTheme = (t: Theme) => {
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", t);
  };

  const toggleTheme = useCallback(() => {
    setAutoThemeState(false);
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem("autoTheme", "false");

      if (user) {
        supabase
          .from("user_theme_preferences")
          .upsert(
            {
              user_id: user.id,
              theme: next,
              auto_theme: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          )
          .then(() => {});
      }

      return next;
    });
  }, [user]);

  const setAutoTheme = useCallback((auto: boolean) => {
    setAutoThemeState(auto);
    localStorage.setItem("autoTheme", String(auto));

    if (auto) {
      const autoT = getAutoTheme();
      setTheme(autoT);
      applyTheme(autoT);
    }

    if (user) {
      supabase
        .from("user_theme_preferences")
        .upsert(
          {
            user_id: user.id,
            theme: auto ? getAutoTheme() : theme,
            auto_theme: auto,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .then(() => {});
    }
  }, [user, theme]);

  return (
    <ThemeContext.Provider value={{ theme, autoTheme, toggleTheme, setAutoTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
