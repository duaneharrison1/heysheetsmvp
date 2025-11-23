import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SidebarLayout from "@/components/SidebarLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import StorePage from "./pages/StorePage";
import StoreSettings from "./pages/StoreSettings";
// Correct import for the chat components showcase page
import ChatComponentsShowcase from "./pages/ChatComponents";
import Account from "./pages/Account";
import Billing from './pages/Billing';
import Help from './pages/Help';
import AdminUsers from './pages/AdminUsers';
import AdminStores from './pages/AdminStores';
import { DebugPanel } from "@/components/debug/DebugPanel";
import { DebugToggle } from "@/components/debug/DebugToggle";
import { QAResultsPage } from "@/qa/components/QAResultsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      {/* Debug Panel - now visible in production */}
      <DebugPanel />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/components" element={<ChatComponentsShowcase />} />
          <Route path="/store/:storeId" element={<StorePage />} />

          {/* Protected Routes with Sidebar Layout */}
          <Route path="/dashboard" element={<SidebarLayout><Dashboard /></SidebarLayout>} />
          <Route path="/settings/:storeId" element={<SidebarLayout><StoreSettings /></SidebarLayout>} />
          {/* removed /profile route (no profile page) */}
          <Route path="/account" element={<SidebarLayout><Account /></SidebarLayout>} />
          <Route path="/billing" element={<SidebarLayout><Billing /></SidebarLayout>} />
          <Route path="/help" element={<SidebarLayout><Help /></SidebarLayout>} />
          <Route path="/admin/users" element={<SidebarLayout><AdminUsers /></SidebarLayout>} />
          <Route path="/admin/stores" element={<SidebarLayout><AdminStores /></SidebarLayout>} />
          <Route path="/qa-results" element={<SidebarLayout><QAResultsPage /></SidebarLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      {/* Fixed Debug Toggle - Bottom Left */}
      <div className="fixed bottom-4 left-4 z-50">
        <DebugToggle />
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
