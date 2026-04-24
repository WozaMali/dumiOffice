import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import DispatchHub from "./pages/DispatchHub";
import Inventory from "./pages/Inventory";
import OilsPage from "./pages/OilsPage";
import Vendors from "./pages/Vendors";
import Expenses from "./pages/Expenses";
import Content from "./pages/Content";
import SettingsPage from "./pages/SettingsPage";
import Accounting from "./pages/Accounting";
import Marketing from "./pages/Marketing";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import AuthGate from "./components/AuthGate";
import Clients from "./pages/Clients";
import WalkInClientForm from "./pages/WalkInClientForm";
import ShopMens from "./pages/ShopMens";
import ProductDetail from "./pages/ProductDetail";
import StorefrontShell from "./components/StorefrontShell";
import StoreAccountPage from "./pages/StoreAccountPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public walk-in client form (no back-office login required) */}
          <Route
            path="/walk-in"
            element={
              <StorefrontShell>
                <WalkInClientForm />
              </StorefrontShell>
            }
          />
          {/* Storefront: Men's Line product cards */}
          <Route
            path="/shop/mens"
            element={
              <StorefrontShell>
                <ShopMens />
              </StorefrontShell>
            }
          />
          {/* Storefront: Product detail page (by code slug) */}
          <Route
            path="/product/:code"
            element={
              <StorefrontShell>
                <ProductDetail />
              </StorefrontShell>
            }
          />
          <Route
            path="/account"
            element={
              <StorefrontShell>
                <StoreAccountPage />
              </StorefrontShell>
            }
          />
          <Route element={<AuthGate />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/dispatch" element={<DispatchHub />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/oils" element={<OilsPage />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/expenses" element={<Expenses />} />
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
