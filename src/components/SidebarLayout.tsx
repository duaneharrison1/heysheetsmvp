import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Sidebar,
  SidebarContent as SidebarContentArea,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Store, Users, UserCog, Receipt, LifeBuoy, Loader2, LogOut, LayoutGrid, MessageSquare } from "lucide-react";
// No sidebar tooltips needed; keep imports minimal

// Create a context to share user data with child components
export const UserContext = React.createContext<any>(null);

// Navigation items configuration
const navItems = [
  { id: "stores", label: "My Stores", href: "/", icon: Store },
  { id: "account", label: "Account Settings", href: "/account", icon: UserCog },
  { id: "billing", label: "Billing", href: "/billing", icon: Receipt },
  { id: "help", label: "Help & Support", href: "/help", icon: LifeBuoy },
];

// Admin navigation items
const adminNavItems = [
  { id: "admin-users", label: "All Users", href: "/admin/users", icon: Users },
  { id: "admin-stores", label: "All Stores", href: "/admin/stores", icon: LayoutGrid },
  { id: "admin-feedback", label: "Chat Feedback", href: "/admin/feedback", icon: MessageSquare },
];

interface SidebarLayoutProps {
  children: React.ReactNode;
}

// User profile section component
function UserProfileSection({ user }: { user: any }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ')[0]
    : user?.email?.split('@')[0] || 'User';

  const userEmail = user?.email || '';

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Avatar className="h-8 w-8 cursor-pointer" variant="user">
          <AvatarImage src={user?.user_metadata?.avatar_url} />
          <AvatarFallback className="avatar-fallback text-xs">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <Button
          onClick={handleSignOut}
          disabled={loading}
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8" variant="user">
          <AvatarImage src={user?.user_metadata?.avatar_url} />
          <AvatarFallback className="avatar-fallback text-xs">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{firstName}</p>
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        </div>
      </div>
      <Button onClick={handleSignOut} disabled={loading} variant="outline" className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
        Sign Out
      </Button>
    </div>
  );
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
        <SidebarWrapper user={user} location={location} />
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

// Sidebar content component that can use useSidebar hook
function SidebarWrapper({ user, location }: { user: any; location: any }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      {/* Platform logo and name */}
      <SidebarHeader className="border-b border-border h-16">
        <div className={`flex items-center h-full transition-all duration-200 ease-in-out ${isCollapsed ? 'justify-center' : 'justify-start gap-3 px-4 h-full'}`}>
          <img src="/shop.svg" alt="HeySheets" className="h-6 w-6 shrink-0" />
              <span className="font-semibold text-lg text-foreground whitespace-nowrap group-data-[collapsible=icon]:hidden">
                HeySheets
              </span>
        </div>
      </SidebarHeader>

      <SidebarContentArea className="pt-3 px-4">
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
                >
                  <Link to={item.href} className={isCollapsed ? 'flex items-center justify-center w-full' : 'flex items-center gap-3'}>
                    <Icon className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          
          {/* Admin Section */}
              <div className="my-3 border-t border-border" />
              <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                Admin
              </div>
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                  asChild
                  isActive={isActive}
                >
                  <Link to={item.href} className={isCollapsed ? 'flex items-center justify-center w-full' : 'flex items-center gap-3'}>
                    <Icon className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
                
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContentArea>

      <SidebarFooter className="border-t border-border">
        <UserProfileSection user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
