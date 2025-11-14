import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SidebarLayout from "@/components/SidebarLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import StorePage from "./pages/StorePage";
import StoreSettings from "./pages/StoreSettings";
// Correct import for the chat components showcase page
import ChatComponentsShowcase from "./pages/ChatComponents";
import Account from "./pages/Account";
import Billing from './pages/Billing';
import Help from './pages/Help';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/components/chat" element={<ChatComponentsShowcase />} />
          <Route path="/store/:storeId" element={<StorePage />} />

          {/* Protected Routes with Sidebar Layout */}
          <Route path="/" element={<SidebarLayout><Dashboard /></SidebarLayout>} />
          <Route path="/settings/:storeId" element={<SidebarLayout><StoreSettings /></SidebarLayout>} />
          {/* removed /profile route (no profile page) */}
          <Route path="/account" element={<SidebarLayout><Account /></SidebarLayout>} />
          <Route path="/billing" element={<SidebarLayout><Billing /></SidebarLayout>} />
          <Route path="/help" element={<SidebarLayout><Help /></SidebarLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
