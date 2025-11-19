import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AuthButton from "@/components/AuthButton";
import { Home, Grid, User, Settings, CreditCard, HelpCircle, Loader2, Shield } from "lucide-react";

// Create a context to share user data with child components
export const UserContext = React.createContext<any>(null);

// Navigation items configuration
const navItems = [
  { id: "stores", label: "My Stores", href: "/", icon: Grid },
  { id: "account", label: "Account Settings", href: "/account", icon: Settings },
  { id: "billing", label: "Billing", href: "/billing", icon: CreditCard },
  { id: "help", label: "Help & Support", href: "/help", icon: HelpCircle },
];

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <UserContext.Provider value={user}>
      <SidebarProvider>
        <Sidebar>
          {/* Sidebar header aligned to match the page header height (h-16).
              Show only first name to avoid long text breaking layout. */}
          <SidebarHeader className="border-b border-border h-16">
            <div className="flex items-center gap-3 px-4 h-full">
              <Avatar className="h-10 w-10" variant="user">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="avatar-fallback">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {
                    (user?.user_metadata?.full_name
                      ? user.user_metadata.full_name.split(' ')[0]
                      : user?.email?.split('@')[0]) || 'User'
                  }
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="pt-3 px-4">
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || 
                                (item.href === "/" && location.pathname === "/");
                
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link to={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              {/* Admin Section */}
              <div className="my-3 border-t border-sidebar-border" />
              <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/admin/users"}
                  tooltip="Manage Users"
                >
                  <Link to="/admin/users">
                    <User className="h-4 w-4" />
                    <span>All Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/admin/stores"}
                  tooltip="Manage Stores"
                >
                  <Link to="/admin/stores">
                    <Grid className="h-4 w-4" />
                    <span>All Stores</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-border">
            <div className="px-3 py-2">
              <AuthButton />
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          {/* Header with sidebar trigger and page title */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
          </header>

          {/* Main content area */}
          <div className="flex flex-1 flex-col gap-4 py-4 px-6 md:px-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </UserContext.Provider>
  );
}
