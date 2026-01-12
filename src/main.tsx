import React from "react";
import ReactDOM from "react-dom/client";

import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { useAuthStore } from "./stores/authStore";
import "./index.css";


function Boot() {
  const init = useAuthStore((s) => s.init);
  React.useEffect(() => {
    init();
  }, [init]);

  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boot />
  </React.StrictMode>
);
