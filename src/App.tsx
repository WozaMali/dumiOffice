import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Orders from "./pages/Orders";
import Inventory from "./pages/Inventory";
import OilsPage from "./pages/OilsPage";
import Marketing from "./pages/Marketing";
import Content from "./pages/Content";
import SettingsPage from "./pages/SettingsPage";
import Accounting from "./pages/Accounting";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import AuthGate from "./components/AuthGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AuthGate />}>
            <Route path="/" element={<Index />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/oils" element={<OilsPage />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/content" element={<Content />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
