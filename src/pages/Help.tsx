import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { H1, Lead } from "@/components/ui/heading";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";

const Help = () => {
  const [category, setCategory] = useState("feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setContactEmail(user.email ?? "");
        setUserId(user.id);
        // Fetch user's store
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        if (store) setStoreId(store.id);
      }
    };
    loadUserData();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user;
      setContactEmail(user?.email ?? "");
      setUserId(user?.id ?? null);
      if (user) {
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        setStoreId(store?.id ?? null);
      } else {
        setStoreId(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Missing fields", { description: "Please add a subject and message." });
      return;
    }

    try {
      setSubmitting(true);

      // Insert ticket directly into Supabase
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: userId,
          store_id: storeId,
          category,
          subject: subject.trim(),
          message: message.trim(),
          contact_email: contactEmail.trim() || null,
        });

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      toast.success("✓ Message sent!", {
        description: "Thanks for reaching out. We'll review your message and reply to your email within 1-3 business days.",
      });
      setSubject("");
      setMessage("");
      setCategory("feedback");
    } catch (err: any) {
      console.error('Failed to submit support ticket:', err);
      toast.error("Error", { description: err?.message ?? "Could not submit your message" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <H1>Help & support</H1>
        <Lead>Report bugs, ask questions, or leave feedback — we'll read everything.</Lead>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Contact support</CardTitle>
                <CardDescription>Use the form below to send a message to the team.</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="category">Category</Label>
              <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="bug">Bug report</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </Select>
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue or feedback in as much detail as you like" />
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="contactEmail">Contact email (optional)</Label>
              <Input id="contactEmail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email to reach you at" />
              <p className="text-sm text-muted-foreground">If you leave an email we'll reply there. If you're signed in, your account email is prefilled.</p>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setSubject(""); setMessage(""); }} disabled={submitting}>Reset</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? 'Sending...' : 'Send message'}</Button>
          </CardFooter>
        </Card>

        <div className="mt-4 text-sm text-muted-foreground">
          <p>Typical response time: 1-3 business days. For urgent issues, please email us as directly at help@heysheets.com.</p>
        </div>
      </div>
    </div>
  );
};

export default Help;
