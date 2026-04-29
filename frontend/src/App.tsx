import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./routes/login/LoginPage";
import { Dashboard } from "./routes/dashboard/Dashboard";
import { MarketsList } from "./routes/markets/MarketsList";
import { MarketDetail } from "./routes/markets/MarketDetail";
import { PolymarketList } from "./routes/polymarket/PolymarketList";
import { PolymarketDetail } from "./routes/polymarket/PolymarketDetail";
import { PortfoliosList } from "./routes/portfolios/PortfoliosList";
import { PortfolioDetail } from "./routes/portfolios/PortfolioDetail";
import { Strategies } from "./routes/strategies/Strategies";
import { Backtests } from "./routes/backtests/Backtests";
import { Settings } from "./routes/settings/Settings";
import { getToken } from "./lib/api";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/markets" element={<MarketsList />} />
        <Route path="/markets/:symbol" element={<MarketDetail />} />
        <Route path="/polymarket" element={<PolymarketList />} />
        <Route path="/polymarket/:slug" element={<PolymarketDetail />} />
        <Route path="/portfolios" element={<PortfoliosList />} />
        <Route path="/portfolios/:id" element={<PortfolioDetail />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/backtests" element={<Backtests />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
