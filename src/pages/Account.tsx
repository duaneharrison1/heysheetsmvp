import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { User, Trash } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/styles/theme";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';
import { H1, Lead } from '@/components/ui/heading';

const Account = () => {
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setFullName((user?.user_metadata as any)?.full_name ?? "");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setFullName((session?.user?.user_metadata as any)?.full_name ?? "");
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (error) throw error;
      toast({ title: "Saved", description: "Profile updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Could not update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // detect if user changed their full name compared to the current profile
  const hasChanges = fullName !== ((user?.user_metadata as any)?.full_name ?? "");

  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <H1>Account settings</H1>
        <Lead>Manage your account profile and preferences.</Lead>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Personal information</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
              <p className="text-sm text-muted-foreground">Email managed by Google</p>
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Theme</Label>
                <div className="text-sm text-muted-foreground">Switch between light and dark theme</div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
            </div>
          </CardContent>

          <CardFooter className="flex gap-2 justify-end">
            <Button
              variant={hasChanges ? 'default' : 'secondary'}
              onClick={onSave}
              disabled={saving || !hasChanges}
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </CardFooter>
        </Card>

        <div className="mt-4 max-w-3xl mx-auto space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <Trash className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Danger zone</CardTitle>
                  <CardDescription>Permanently delete your account and all associated data.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Deleting your account is irreversible. All your stores, settings, and data will be removed. Please make sure you have exports/backups before proceeding.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button variant="destructive" onClick={async () => {
                const ok = window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.');
                if (!ok) return;
                try {
                  setDeleting(true);
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error('Not signed in');

                  // Call a server-side function to delete the user (requires service role)
                  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({}),
                  });

                  const result = await res.json();
                  if (!res.ok) throw new Error(result?.error || 'Deletion failed');

                  toast({ title: 'Account deleted', description: 'Your account has been deleted.' });
                  // Sign out locally and navigate to auth
                  await supabase.auth.signOut();
                  navigate('/auth');
                } catch (err: any) {
                  toast({ title: 'Error', description: err?.message ?? 'Could not delete account', variant: 'destructive' });
                } finally {
                  setDeleting(false);
                }
              }} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete account'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Account;
