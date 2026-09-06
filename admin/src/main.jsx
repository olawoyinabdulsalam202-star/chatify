import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "#272320",
          color: "#DED7CD",
          border: "1px solid #3C3630",
        },
      }}
    />
  </StrictMode>
);
