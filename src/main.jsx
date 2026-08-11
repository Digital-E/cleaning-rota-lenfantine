import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CleaningRota from "../cleaning-rota.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CleaningRota />
  </StrictMode>
);
