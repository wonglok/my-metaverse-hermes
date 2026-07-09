// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "./index.css";
import { LandingPage } from "@/pages/landing";
import { GamePage } from "@/pages/game";

createRoot(document.getElementById("root")!).render(
  <>
    <BrowserRouter>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="/game/:placeId" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  </>,
);

//
