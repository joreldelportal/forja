import { Outlet } from "react-router-dom";
import TabBar from "../TabBar/TabBar";
import styles from "./MainLayout.module.css";

/**
 * MainLayout - Layout principal con navegación por tabs
 * 
 * Envuelve las páginas principales (Home, Train, Explore, Profile)
 * y muestra el TabBar en la parte inferior.
 * 
 * Las páginas de flujo (Workout, Preview, Builder, Editor) NO usan este layout
 * para evitar distracciones durante el entrenamiento.
 */
export default function MainLayout() {
  return (
    <div className={styles.layout}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
