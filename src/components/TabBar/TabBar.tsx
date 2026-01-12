import { useLocation, useNavigate } from "react-router-dom";
import styles from "./TabBar.module.css";

type TabItem = {
  key: string;
  label: string;
  icon: string;
  iconActive: string;
  path: string;
};

const TABS: TabItem[] = [
  {
    key: "home",
    label: "Inicio",
    icon: "🏠",
    iconActive: "🏠",
    path: "/",
  },
  {
    key: "train",
    label: "Entrenar",
    icon: "💪",
    iconActive: "💪",
    path: "/train",
  },
  {
    key: "explore",
    label: "Explorar",
    icon: "🔍",
    iconActive: "🔍",
    path: "/explore",
  },
  {
    key: "profile",
    label: "Perfil",
    icon: "👤",
    iconActive: "👤",
    path: "/profile",
  },
];

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (tab: TabItem) => {
    // Exact match for home
    if (tab.path === "/") {
      return location.pathname === "/";
    }
    // Prefix match for other tabs
    return location.pathname.startsWith(tab.path);
  };

  const handleTabClick = (tab: TabItem) => {
    navigate(tab.path);
  };

  return (
    <nav className={styles.tabBar}>
      {TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.key}
            className={`${styles.tab} ${active ? styles.active : ""}`}
            onClick={() => handleTabClick(tab)}
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.icon}>{active ? tab.iconActive : tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
