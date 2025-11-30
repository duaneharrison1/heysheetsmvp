import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  category: string;
  items: FAQItem[];
}

interface FAQSectionProps {
  title?: string;
  categories?: FAQCategory[];
}

const defaultCategories: FAQCategory[] = [
  {
    category: "General",
    items: [
      {
        question: "What is a FAQ and why is it important?",
        answer: "A FAQ (Frequently Asked Questions) section helps users find quick answers to common questions, reducing support burden and improving user experience.",
      },
      {
        question: "Why should I use a FAQ on my website or app?",
        answer: "FAQs provide immediate answers to common questions, reduce support tickets, improve user satisfaction, and help with SEO by addressing search queries.",
      },
      {
        question: "How do I effectively create a FAQ section?",
        answer: "Identify common user questions, organize them by category, write clear and concise answers, and keep the content updated based on user feedback.",
      },
      {
        question: "What are the benefits of having a well-maintained FAQ section?",
        answer: "A well-maintained FAQ section reduces customer support workload, improves user experience, increases conversion rates, and builds trust with your audience.",
      },
    ],
  },
  {
    category: "Billing",
    items: [
      {
        question: "How do I change my billing information?",
        answer: "You can update your billing information in your account settings under the Billing section. Changes take effect immediately for future charges.",
      },
      {
        question: "How do I cancel my subscription?",
        answer: "To cancel your subscription, go to your account settings, select the Billing tab, and click on 'Cancel Subscription'. You'll retain access until the end of your billing period.",
      },
    ],
  },
];

export function FAQSection({
  title = "Frequently asked questions.",
  categories = defaultCategories,
}: FAQSectionProps) {
  return (
    <section id="faq" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
      <div className="mb-12">
        <Badge variant="outline" className="mb-6">FAQ</Badge>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
          {title}
        </h2>
      </div>

      <div className="space-y-12">
        {categories.map((category, categoryIdx) => (
          <div key={categoryIdx}>
            {/* Category Title */}
            <h3 className="text-xl font-semibold mb-6 pb-4 border-b border-border">
              {category.category}
            </h3>

            {/* Category Questions */}
            <Accordion className="space-y-1">
              {category.items.map((item, itemIdx) => (
                <AccordionItem key={itemIdx} className="border-b border-border">
                  <AccordionTrigger className="text-left py-4 hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>
    </section>
  );
}

export default FAQSection;
