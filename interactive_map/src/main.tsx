import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { FornitoreStato } from "./state/store";
import "./styles.css";

const radice = document.getElementById("radice");
if (!radice) throw new Error("Elemento #radice non trovato in index.html");

createRoot(radice).render(
  <StrictMode>
    <FornitoreStato>
      <App />
    </FornitoreStato>
  </StrictMode>
);
