import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building, Clock, Package, ShoppingCart, Calendar, Settings } from "lucide-react";
import { Spreadsheet } from "@/components/Spreadsheet";

// Store-specific data configurations
const getStoreData = (storeId: string) => {
  const baseColumns = {
    hours: [
      { key: 'day', label: 'Day of Week' },
      { key: 'openTime', label: 'Open Time' },
      { key: 'closeTime', label: 'Close Time' },
      { key: 'isOpen', label: 'Open?' },
      { key: 'notes', label: 'Notes' },
    ],
    products: [
      { key: 'name', label: 'Product Name' },
      { key: 'category', label: 'Category' },
      { key: 'price', label: 'Price', type: 'number' as const },
      { key: 'stock', label: 'Stock', type: 'number' as const },
      { key: 'description', label: 'Description' },
    ],
    services: [
      { key: 'serviceName', label: 'Service Name' },
      { key: 'duration', label: 'Duration (min)', type: 'number' as const },
      { key: 'price', label: 'Price', type: 'number' as const },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
    ],
    bookings: [
      { key: 'bookingId', label: 'Booking ID' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'service', label: 'Service' },
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
      { key: 'phone', label: 'Phone', type: 'tel' as const },
      { key: 'status', label: 'Status' },
    ],
    orders: [
      { key: 'orderId', label: 'Order ID' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'date', label: 'Date' },
      { key: 'total', label: 'Total', type: 'number' as const },
      { key: 'status', label: 'Status' },
    ],
  };

  switch (storeId) {
    case 'salon-1': // Bella Beauty Salon
      return [
        {
          id: 'hours',
          label: 'Operating Hours',
          icon: Clock,
          columns: baseColumns.hours,
          initialData: [
            { day: 'Monday', openTime: '9:00 AM', closeTime: '7:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Tuesday', openTime: '9:00 AM', closeTime: '7:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Wednesday', openTime: '9:00 AM', closeTime: '7:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Thursday', openTime: '9:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Late night appointments' },
            { day: 'Friday', openTime: '9:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Weekend prep rush' },
            { day: 'Saturday', openTime: '8:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: 'Busiest day' },
            { day: 'Sunday', openTime: '10:00 AM', closeTime: '5:00 PM', isOpen: 'Yes', notes: 'Limited services' },
          ]
        },
        {
          id: 'products',
          label: 'Products',
          icon: Package,
          columns: baseColumns.products,
          initialData: [
            { name: 'Olaplex No.3 Hair Perfector', category: 'Hair Treatment', price: '28.00', stock: '15', description: 'At-home bond building treatment to strengthen and repair damaged hair' },
            { name: 'Redken All Soft Shampoo', category: 'Shampoo', price: '24.50', stock: '32', description: 'Moisturizing shampoo for dry, brittle hair with argan oil' },
            { name: 'Moroccanoil Treatment Original', category: 'Hair Oil', price: '44.00', stock: '18', description: 'Versatile argan oil-infused hair treatment for all hair types' },
            { name: 'Kerastase Elixir Ultime', category: 'Hair Oil', price: '52.00', stock: '12', description: 'Luxurious hair oil with marula oil for ultimate shine and nourishment' },
            { name: 'Bumble & Bumble Hairdresser\'s Invisible Oil', category: 'Hair Oil', price: '38.00', stock: '20', description: 'Lightweight oil blend that conditions without weighing hair down' },
            { name: 'Living Proof Perfect Hair Day Dry Shampoo', category: 'Dry Shampoo', price: '29.00', stock: '25', description: 'Time-release dry shampoo that absorbs oil and extends style longevity' },
            { name: 'Davines OI All in One Milk', category: 'Leave-in Treatment', price: '32.00', stock: '14', description: 'Multi-benefit leave-in treatment with roucou oil for shine and protection' },
            { name: 'Schwarzkopf Professional Blondme Toning Spray', category: 'Toner', price: '26.50', stock: '10', description: 'Instant toning spray to neutralize brass and enhance blonde tones' }
          ]
        },
        {
          id: 'services',
          label: 'Services',
          icon: Settings,
          columns: baseColumns.services,
          initialData: [
            { serviceName: 'Women\'s Cut & Style', duration: '75', price: '85.00', category: 'Hair Cut', description: 'Precision cut with blow-dry styling, includes consultation and scalp massage' },
            { serviceName: 'Men\'s Cut & Style', duration: '45', price: '45.00', category: 'Hair Cut', description: 'Classic or modern men\'s cut with styling and beard trim if needed' },
            { serviceName: 'Full Highlight', duration: '180', price: '165.00', category: 'Color', description: 'Full head highlights with toner, gloss, cut and style included' },
            { serviceName: 'Root Touch-up', duration: '90', price: '95.00', category: 'Color', description: 'Root color refresh up to 2 inches of regrowth, includes blow-dry' },
            { serviceName: 'Balayage', duration: '210', price: '195.00', category: 'Color', description: 'Hand-painted highlights for natural sun-kissed look, includes toning and styling' },
            { serviceName: 'Deep Conditioning Treatment', duration: '30', price: '35.00', category: 'Treatment', description: 'Intensive moisture treatment with steam for damaged or dry hair' },
            { serviceName: 'Keratin Smoothing Treatment', duration: '150', price: '275.00', category: 'Treatment', description: 'Professional keratin treatment to reduce frizz and add shine for 3-4 months' },
            { serviceName: 'Special Occasion Updo', duration: '90', price: '125.00', category: 'Styling', description: 'Elegant updo styling for weddings, proms, or special events' },
            { serviceName: 'Blowout Styling', duration: '45', price: '55.00', category: 'Styling', description: 'Professional blow-dry with round brush styling for smooth, voluminous finish' }
          ]
        },
        {
          id: 'bookings',
          label: 'Bookings',
          icon: Calendar,
          columns: baseColumns.bookings,
          initialData: [
            { bookingId: 'BKG001', customerName: 'Sarah Johnson', service: 'Balayage', date: '2025-08-20', time: '10:00 AM', phone: '(555) 123-4567', status: 'Confirmed' },
            { bookingId: 'BKG002', customerName: 'Michael Chen', service: 'Men\'s Cut & Style', date: '2025-08-20', time: '2:30 PM', phone: '(555) 234-5678', status: 'Confirmed' },
            { bookingId: 'BKG003', customerName: 'Emily Rodriguez', service: 'Full Highlight', date: '2025-08-21', time: '9:00 AM', phone: '(555) 345-6789', status: 'Pending' }
          ]
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: ShoppingCart,
          columns: baseColumns.orders,
          initialData: [
            { orderId: 'ORD001', customerName: 'Jessica Williams', date: '2025-08-18', total: '72.00', status: 'Completed' },
            { orderId: 'ORD002', customerName: 'David Thompson', date: '2025-08-17', total: '28.00', status: 'Ready for Pickup' }
          ]
        }
      ];

    case 'salon-2': // Glow Skincare Clinic
      return [
        {
          id: 'hours',
          label: 'Operating Hours',
          icon: Clock,
          columns: baseColumns.hours,
          initialData: [
            { day: 'Monday', openTime: '10:00 AM', closeTime: '7:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Tuesday', openTime: '10:00 AM', closeTime: '7:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Wednesday', openTime: '10:00 AM', closeTime: '7:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Thursday', openTime: '10:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Extended for working professionals' },
            { day: 'Friday', openTime: '10:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Saturday', openTime: '9:00 AM', closeTime: '5:00 PM', isOpen: 'Yes', notes: 'Popular for weekend treatments' },
            { day: 'Sunday', openTime: '', closeTime: '', isOpen: 'No', notes: 'Closed for equipment maintenance' },
          ]
        },
        {
          id: 'products',
          label: 'Products',
          icon: Package,
          columns: baseColumns.products,
          initialData: [
            { name: 'SkinCeuticals CE Ferulic Serum', category: 'Vitamin C Serum', price: '182.00', stock: '8', description: 'Gold-standard antioxidant serum with 15% L-ascorbic acid, vitamin E, and ferulic acid' },
            { name: 'Revision Skincare Intellishade Original', category: 'Moisturizer SPF', price: '75.00', stock: '12', description: 'All-in-one tinted moisturizer with SPF 45, peptides, and antioxidants' },
            { name: 'ZO Skin Health Exfoliating Polish', category: 'Exfoliant', price: '78.00', stock: '15', description: 'Magnesium crystal exfoliant removes dead skin cells for smoother texture' },
            { name: 'Obagi Nu-Derm Clear Fx', category: 'Brightening', price: '98.00', stock: '6', description: 'Non-hydroquinone skin brightener with arbutin and vitamin C' },
            { name: 'EltaMD UV Clear Broad-Spectrum SPF 46', category: 'Sunscreen', price: '45.00', stock: '20', description: 'Oil-free facial sunscreen with niacinamide, safe for sensitive skin' },
            { name: 'PCA Skin Hydrating Mask', category: 'Face Mask', price: '58.00', stock: '10', description: 'Intensive hydrating mask with hyaluronic acid and panthenol' },
            { name: 'Alastin Restorative Eye Treatment', category: 'Eye Cream', price: '95.00', stock: '7', description: 'Potent eye cream with peptides to target fine lines and dark circles' }
          ]
        },
        {
          id: 'services',
          label: 'Services',
          icon: Settings,
          columns: baseColumns.services,
          initialData: [
            { serviceName: 'HydraFacial MD', duration: '60', price: '175.00', category: 'Facial', description: 'Medical-grade resurfacing treatment that cleanses, extracts, and hydrates skin instantly' },
            { serviceName: 'Chemical Peel - Light', duration: '45', price: '125.00', category: 'Peel', description: 'Gentle glycolic or lactic acid peel for improved texture and mild pigmentation' },
            { serviceName: 'Chemical Peel - Medium', duration: '60', price: '195.00', category: 'Peel', description: 'TCA peel for moderate sun damage, fine lines, and deeper pigmentation issues' },
            { serviceName: 'Microneedling with PRP', duration: '90', price: '350.00', category: 'Advanced Treatment', description: 'Collagen induction therapy with platelet-rich plasma for skin rejuvenation' },
            { serviceName: 'IPL Photofacial', duration: '45', price: '275.00', category: 'Laser Treatment', description: 'Intense pulsed light therapy for sun damage, rosacea, and uneven skin tone' },
            { serviceName: 'Dermaplaning', duration: '45', price: '95.00', category: 'Exfoliation', description: 'Manual exfoliation removing dead skin and vellus hair for smoother complexion' },
            { serviceName: 'LED Light Therapy', duration: '30', price: '65.00', category: 'Light Therapy', description: 'Non-invasive light treatment to reduce acne bacteria and stimulate healing' },
            { serviceName: 'Custom European Facial', duration: '75', price: '145.00', category: 'Facial', description: 'Personalized facial with cleansing, extractions, mask, and massage based on skin analysis' }
          ]
        },
        {
          id: 'bookings',
          label: 'Bookings',
          icon: Calendar,
          columns: baseColumns.bookings,
          initialData: [
            { bookingId: 'GLS001', customerName: 'Amanda Foster', service: 'HydraFacial MD', date: '2025-08-19', time: '11:00 AM', phone: '(555) 456-7890', status: 'Confirmed' },
            { bookingId: 'GLS002', customerName: 'Jennifer Liu', service: 'Microneedling with PRP', date: '2025-08-21', time: '2:00 PM', phone: '(555) 567-8901', status: 'Confirmed' }
          ]
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: ShoppingCart,
          columns: baseColumns.orders,
          initialData: [
            { orderId: 'GLS001', customerName: 'Rebecca Martinez', date: '2025-08-17', total: '227.00', status: 'Shipped' }
          ]
        }
      ];

    case 'coach-1': // FitLife Personal Training
      return [
        {
          id: 'hours',
          label: 'Operating Hours',
          icon: Clock,
          columns: baseColumns.hours,
          initialData: [
            { day: 'Monday', openTime: '5:30 AM', closeTime: '9:00 PM', isOpen: 'Yes', notes: 'Early morning and evening slots available' },
            { day: 'Tuesday', openTime: '5:30 AM', closeTime: '9:00 PM', isOpen: 'Yes', notes: 'Peak hours 6-8 AM, 6-8 PM' },
            { day: 'Wednesday', openTime: '5:30 AM', closeTime: '9:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Thursday', openTime: '5:30 AM', closeTime: '9:00 PM', isOpen: 'Yes', notes: 'Group classes available' },
            { day: 'Friday', openTime: '5:30 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Limited evening slots' },
            { day: 'Saturday', openTime: '7:00 AM', closeTime: '4:00 PM', isOpen: 'Yes', notes: 'Weekend warrior sessions' },
            { day: 'Sunday', openTime: '8:00 AM', closeTime: '3:00 PM', isOpen: 'Yes', notes: 'Recovery and mobility focus' },
          ]
        },
        {
          id: 'products',
          label: 'Products',
          icon: Package,
          columns: baseColumns.products,
          initialData: [
            { name: 'Optimum Nutrition Gold Standard Whey', category: 'Protein Powder', price: '58.99', stock: '12', description: '5lb container of premium whey protein isolate with 24g protein per serving' },
            { name: 'Creatine Monohydrate Powder', category: 'Supplements', price: '24.99', stock: '18', description: 'Pure creatine monohydrate for strength and power enhancement, 300g container' },
            { name: 'Resistance Band Set', category: 'Equipment', price: '29.99', stock: '8', description: 'Complete set of 5 resistance bands with door anchor and handles for home workouts' },
            { name: 'Foam Roller - High Density', category: 'Recovery', price: '34.99', stock: '6', description: '18-inch high-density foam roller for muscle recovery and myofascial release' },
            { name: 'Pre-Workout Energy Drink', category: 'Supplements', price: '39.99', stock: '15', description: 'Natural pre-workout with caffeine, beta-alanine, and citrulline malate' },
            { name: 'Yoga Mat - Premium', category: 'Equipment', price: '49.99', stock: '10', description: 'Non-slip 6mm thick yoga mat perfect for stretching and core workouts' },
            { name: 'Shaker Bottle with Mixer', category: 'Accessories', price: '14.99', stock: '25', description: 'BPA-free protein shaker with built-in mixer ball and measurement marks' }
          ]
        },
        {
          id: 'services',
          label: 'Services',
          icon: Settings,
          columns: baseColumns.services,
          initialData: [
            { serviceName: 'Personal Training Session', duration: '60', price: '85.00', category: 'One-on-One', description: 'Customized workout session with certified trainer focusing on your specific goals' },
            { serviceName: 'Fitness Assessment', duration: '45', price: '65.00', category: 'Assessment', description: 'Comprehensive body composition analysis, movement screening, and goal setting' },
            { serviceName: 'Small Group Training (2-4 people)', duration: '60', price: '45.00', category: 'Group Training', description: 'Semi-private training session split among 2-4 participants for cost-effective coaching' },
            { serviceName: 'Nutrition Consultation', duration: '60', price: '95.00', category: 'Nutrition', description: 'Personalized meal planning and nutrition guidance with macro tracking setup' },
            { serviceName: 'HIIT Circuit Class', duration: '45', price: '25.00', category: 'Group Class', description: 'High-intensity interval training with rotating stations for maximum calorie burn' },
            { serviceName: 'Strength Training Basics', duration: '75', price: '75.00', category: 'Education', description: 'Learn proper form and technique for fundamental strength training movements' },
            { serviceName: 'Mobility & Recovery Session', duration: '45', price: '55.00', category: 'Recovery', description: 'Guided stretching, foam rolling, and mobility work to prevent injury and improve performance' },
            { serviceName: '4-Week Transformation Program', duration: '240', price: '320.00', category: 'Program', description: 'Comprehensive 4-session package with training, nutrition, and accountability check-ins' }
          ]
        },
        {
          id: 'bookings',
          label: 'Bookings',
          icon: Calendar,
          columns: baseColumns.bookings,
          initialData: [
            { bookingId: 'FIT001', customerName: 'Mark Peterson', service: 'Personal Training Session', date: '2025-08-19', time: '6:00 AM', phone: '(555) 678-9012', status: 'Confirmed' },
            { bookingId: 'FIT002', customerName: 'Lisa Anderson', service: 'Nutrition Consultation', date: '2025-08-20', time: '5:30 PM', phone: '(555) 789-0123', status: 'Confirmed' },
            { bookingId: 'FIT003', customerName: 'Jake Morrison', service: 'Fitness Assessment', date: '2025-08-21', time: '7:00 AM', phone: '(555) 890-1234', status: 'Pending' }
          ]
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: ShoppingCart,
          columns: baseColumns.orders,
          initialData: [
            { orderId: 'FIT001', customerName: 'Rachel Green', date: '2025-08-18', total: '83.98', status: 'Ready for Pickup' },
            { orderId: 'FIT002', customerName: 'Tom Wilson', date: '2025-08-17', total: '34.99', status: 'Completed' }
          ]
        }
      ];

    case 'coach-2': // Mindful Life Coaching
      return [
        {
          id: 'hours',
          label: 'Operating Hours',
          icon: Clock,
          columns: baseColumns.hours,
          initialData: [
            { day: 'Monday', openTime: '9:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Evening sessions popular' },
            { day: 'Tuesday', openTime: '9:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Wednesday', openTime: '9:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Group sessions available' },
            { day: 'Thursday', openTime: '9:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: '' },
            { day: 'Friday', openTime: '9:00 AM', closeTime: '5:00 PM', isOpen: 'Yes', notes: 'Half day for planning' },
            { day: 'Saturday', openTime: '10:00 AM', closeTime: '4:00 PM', isOpen: 'Yes', notes: 'Weekend workshops only' },
            { day: 'Sunday', openTime: '', closeTime: '', isOpen: 'No', notes: 'Rest and recharge day' },
          ]
        },
        {
          id: 'products',
          label: 'Products',
          icon: Package,
          columns: baseColumns.products,
          initialData: [
            { name: 'The 7 Habits of Highly Effective People', category: 'Self-Help Books', price: '16.99', stock: '5', description: 'Stephen Covey\'s classic guide to personal and professional effectiveness' },
            { name: 'Mindfulness Journal', category: 'Journals', price: '24.99', stock: '12', description: 'Guided daily journal with prompts for mindfulness practice and reflection' },
            { name: 'Essential Oil Diffuser Set', category: 'Aromatherapy', price: '49.99', stock: '8', description: 'Ultrasonic diffuser with lavender, eucalyptus, and peppermint oils for relaxation' },
            { name: 'Meditation Cushion', category: 'Meditation', price: '39.99', stock: '6', description: 'Comfortable zabuton cushion for meditation practice, organic cotton cover' },
            { name: 'Goal Setting Workbook', category: 'Workbooks', price: '19.99', stock: '15', description: 'Comprehensive workbook for setting and achieving personal and professional goals' },
            { name: 'Stress Relief Tea Blend', category: 'Wellness', price: '14.99', stock: '20', description: 'Organic herbal tea blend with chamomile, passionflower, and lemon balm' },
            { name: 'Vision Board Kit', category: 'Creative Tools', price: '29.99', stock: '10', description: 'Complete kit with cork board, pins, markers, and inspiration cards for vision creation' }
          ]
        },
        {
          id: 'services',
          label: 'Services',
          icon: Settings,
          columns: baseColumns.services,
          initialData: [
            { serviceName: 'Individual Life Coaching Session', duration: '60', price: '125.00', category: 'One-on-One', description: 'Personalized coaching session focused on goal setting, obstacle removal, and action planning' },
            { serviceName: 'Career Transition Coaching', duration: '90', price: '175.00', category: 'Career', description: 'Specialized coaching for career changes, including skills assessment and strategic planning' },
            { serviceName: 'Mindfulness Workshop', duration: '120', price: '85.00', category: 'Group Workshop', description: 'Learn practical mindfulness techniques for stress reduction and emotional regulation' },
            { serviceName: 'Relationship Coaching Session', duration: '75', price: '145.00', category: 'Relationships', description: 'Coaching focused on improving communication and building healthier relationships' },
            { serviceName: 'Goal Achievement Program', duration: '300', price: '450.00', category: 'Program Package', description: '5-session package for comprehensive goal setting and achievement with accountability' },
            { serviceName: 'Stress Management Consultation', duration: '45', price: '95.00', category: 'Wellness', description: 'Assessment and personalized strategies for managing stress and preventing burnout' },
            { serviceName: 'Values Clarification Session', duration: '75', price: '135.00', category: 'Self-Discovery', description: 'Deep dive into personal values to align life choices with core beliefs' },
            { serviceName: 'Monthly Group Mastermind', duration: '90', price: '45.00', category: 'Group Session', description: 'Monthly peer coaching group for support, accountability, and shared wisdom' }
          ]
        },
        {
          id: 'bookings',
          label: 'Bookings',
          icon: Calendar,
          columns: baseColumns.bookings,
          initialData: [
            { bookingId: 'MLC001', customerName: 'Patricia Davis', service: 'Individual Life Coaching Session', date: '2025-08-19', time: '2:00 PM', phone: '(555) 901-2345', status: 'Confirmed' },
            { bookingId: 'MLC002', customerName: 'Robert Kim', service: 'Career Transition Coaching', date: '2025-08-20', time: '10:00 AM', phone: '(555) 012-3456', status: 'Confirmed' }
          ]
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: ShoppingCart,
          columns: baseColumns.orders,
          initialData: [
            { orderId: 'MLC001', customerName: 'Sarah Mitchell', date: '2025-08-18', total: '44.98', status: 'Shipped' }
          ]
        }
      ];

    case 'craft-1': // Artisan Craft Studio
      return [
        {
          id: 'hours',
          label: 'Operating Hours',
          icon: Clock,
          columns: baseColumns.hours,
          initialData: [
            { day: 'Monday', openTime: '', closeTime: '', isOpen: 'No', notes: 'Closed for inventory and planning' },
            { day: 'Tuesday', openTime: '10:00 AM', closeTime: '7:00 PM', isOpen: 'Yes', notes: 'Adult workshops available' },
            { day: 'Wednesday', openTime: '10:00 AM', closeTime: '7:00 PM', isOpen: 'Yes', notes: 'Kids classes 4-6 PM' },
            { day: 'Thursday', openTime: '10:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Extended for evening classes' },
            { day: 'Friday', openTime: '10:00 AM', closeTime: '8:00 PM', isOpen: 'Yes', notes: 'Date night pottery classes' },
            { day: 'Saturday', openTime: '9:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: 'Busiest day - all ages workshops' },
            { day: 'Sunday', openTime: '11:00 AM', closeTime: '5:00 PM', isOpen: 'Yes', notes: 'Family craft time, open studio' },
          ]
        },
        {
          id: 'products',
          label: 'Products',
          icon: Package,
          columns: baseColumns.products,
          initialData: [
            { name: 'Acrylic Paint Set - 24 Colors', category: 'Paints', price: '32.99', stock: '15', description: 'Professional grade acrylic paints in 2oz tubes, vibrant colors with excellent coverage' },
            { name: 'Canvas Panels 8x10 (Pack of 12)', category: 'Canvas', price: '18.99', stock: '25', description: 'Pre-primed cotton canvas panels, perfect for acrylic and oil painting practice' },
            { name: 'Pottery Clay - Earthenware 25lbs', category: 'Clay', price: '28.50', stock: '8', description: 'Smooth throwing clay, cone 04-06, perfect for beginners and wheel throwing' },
            { name: 'Watercolor Paper Pad 140lb', category: 'Paper', price: '24.99', stock: '20', description: 'Cold-pressed watercolor paper, 12 sheets 9x12, acid-free and archival quality' },
            { name: 'Ceramic Glazes Starter Set', category: 'Glazes', price: '45.99', stock: '12', description: 'Set of 6 food-safe glazes in popular colors, lead-free and non-toxic' },
            { name: 'Natural Bristle Brush Set', category: 'Brushes', price: '29.99', stock: '18', description: 'Set of 10 artist brushes, hog bristle and sable, various sizes for all techniques' },
            { name: 'Polymer Clay Multi-Pack', category: 'Clay', price: '22.99', stock: '14', description: '8 colors of Sculpey polymer clay, 2oz each, perfect for jewelry and miniatures' },
            { name: 'Embroidery Hoop Set', category: 'Embroidery', price: '16.99', stock: '10', description: 'Bamboo hoops in 4", 6", and 8" sizes with fabric and thread starter pack' },
            { name: 'Glass Fusion Kit', category: 'Glass Art', price: '89.99', stock: '6', description: 'Beginner glass fusing kit with colored glass, tools, and safety equipment' }
          ]
        },
        {
          id: 'services',
          label: 'Services',
          icon: Settings,
          columns: baseColumns.services,
          initialData: [
            { serviceName: 'Beginning Pottery Wheel Class', duration: '120', price: '65.00', category: 'Pottery', description: '2-hour intro to wheel throwing, includes clay, tools, and firing for 2 pieces' },
            { serviceName: 'Acrylic Painting Workshop', duration: '180', price: '75.00', category: 'Painting', description: '3-hour guided painting session, all materials included, take home finished 11x14 canvas' },
            { serviceName: 'Kids Art Explorers (Ages 6-12)', duration: '90', price: '35.00', category: 'Kids Classes', description: 'Weekly art class exploring different mediums, includes all supplies and smock' },
            { serviceName: 'Date Night Pottery', duration: '150', price: '120.00', category: 'Couples', description: 'Couples pottery experience with wine, includes clay, glazing, and firing for 4 pieces' },
            { serviceName: 'Watercolor Basics', duration: '120', price: '55.00', category: 'Painting', description: 'Learn fundamental watercolor techniques, paper and paints provided' },
            { serviceName: 'Jewelry Making Workshop', duration: '180', price: '85.00', category: 'Jewelry', description: 'Create 3 pieces of polymer clay jewelry, includes all materials and findings' },
            { serviceName: 'Glass Fusing Introduction', duration: '240', price: '125.00', category: 'Glass Art', description: '4-hour workshop creating fused glass pieces, includes firing and second visit for pickup' },
            { serviceName: 'Private Art Lesson', duration: '90', price: '95.00', category: 'Private Instruction', description: 'One-on-one instruction in medium of choice, materials included' },
            { serviceName: 'Open Studio Time', duration: '120', price: '25.00', category: 'Studio Rental', description: '2-hour access to studio space and basic tools, bring your own materials' }
          ]
        },
        {
          id: 'bookings',
          label: 'Bookings',
          icon: Calendar,
          columns: baseColumns.bookings,
          initialData: [
            { bookingId: 'ART001', customerName: 'Emma Thompson', service: 'Beginning Pottery Wheel Class', date: '2025-08-20', time: '6:00 PM', phone: '(555) 123-4567', status: 'Confirmed' },
            { bookingId: 'ART002', customerName: 'Mike & Sarah Jones', service: 'Date Night Pottery', date: '2025-08-22', time: '7:00 PM', phone: '(555) 234-5678', status: 'Confirmed' },
            { bookingId: 'ART003', customerName: 'Lucas Martinez (Age 8)', service: 'Kids Art Explorers', date: '2025-08-21', time: '4:00 PM', phone: '(555) 345-6789', status: 'Pending' }
          ]
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: ShoppingCart,
          columns: baseColumns.orders,
          initialData: [
            { orderId: 'ART001', customerName: 'Jennifer Lee', date: '2025-08-17', total: '78.97', status: 'Ready for Pickup' },
            { orderId: 'ART002', customerName: 'David Chen', date: '2025-08-18', total: '124.98', status: 'Completed' }
          ]
        }
      ];

    case 'education-1': // Little Scholars Academy
      return [
        {
          id: 'hours',
          label: 'Operating Hours',
          icon: Clock,
          columns: baseColumns.hours,
          initialData: [
            { day: 'Monday', openTime: '7:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: 'Extended care available 6:30 AM - 7:00 PM' },
            { day: 'Tuesday', openTime: '7:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: 'Music lessons 3:30-5:00 PM' },
            { day: 'Wednesday', openTime: '7:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: 'Half day for teacher training (students dismissed 12 PM)' },
            { day: 'Thursday', openTime: '7:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: 'Art enrichment programs available' },
            { day: 'Friday', openTime: '7:00 AM', closeTime: '6:00 PM', isOpen: 'Yes', notes: 'Show & tell and special activities' },
            { day: 'Saturday', openTime: '8:00 AM', closeTime: '12:00 PM', isOpen: 'Yes', notes: 'Weekend enrichment programs only' },
            { day: 'Sunday', openTime: '', closeTime: '', isOpen: 'No', notes: 'Closed - family time encouraged' },
          ]
        },
        {
          id: 'products',
          label: 'Products',
          icon: Package,
          columns: baseColumns.products,
          initialData: [
            { name: 'Phonics Learning Kit', category: 'Reading', price: '34.99', stock: '8', description: 'Complete phonics program with flashcards, workbooks, and audio CD for ages 4-6' },
            { name: 'Math Manipulatives Set', category: 'Mathematics', price: '42.99', stock: '12', description: 'Counting bears, pattern blocks, and base-10 blocks for hands-on math learning' },
            { name: 'Science Experiment Kit', category: 'Science', price: '28.99', stock: '6', description: 'Safe, age-appropriate experiments for elementary students with instruction guide' },
            { name: 'Melissa & Doug Wooden Puzzles', category: 'Puzzles', price: '18.99', stock: '15', description: 'Educational wooden puzzles developing problem-solving and fine motor skills' },
            { name: 'Crayola Art Supply Bundle', category: 'Art Supplies', price: '25.99', stock: '20', description: 'Crayons, markers, colored pencils, and construction paper for creative expression' },
            { name: 'Sight Words Flash Cards', category: 'Reading', price: '12.99', stock: '25', description: 'High-frequency sight word cards for kindergarten through 2nd grade' },
            { name: 'Magnetic Letter Set', category: 'Language Arts', price: '16.99', stock: '18', description: 'Colorful magnetic letters for word building and spelling practice' },
            { name: 'Educational Tablet Games', category: 'Technology', price: '39.99', stock: '10', description: 'Age-appropriate learning apps and games for tablet-based learning' }
          ]
        },
        {
          id: 'services',
          label: 'Services',
          icon: Settings,
          columns: baseColumns.services,
          initialData: [
            { serviceName: 'Full-Day Preschool Program', duration: '480', price: '1250.00', category: 'Full-Time Care', description: 'Comprehensive preschool program (ages 3-5) with structured learning, meals, and extended care' },
            { serviceName: 'Half-Day Kindergarten Prep', duration: '240', price: '750.00', category: 'Part-Time Program', description: 'Morning program focusing on kindergarten readiness skills and social development' },
            { serviceName: 'After-School Enrichment', duration: '180', price: '85.00', category: 'After School', description: 'Homework help, educational activities, and supervised play for school-age children' },
            { serviceName: 'Summer Learning Camp', duration: '480', price: '275.00', category: 'Summer Program', description: 'Weekly summer camp with educational themes, field trips, and fun learning activities' },
            { serviceName: 'Private Tutoring Session', duration: '60', price: '65.00', category: 'Individual Support', description: 'One-on-one academic support in reading, math, or other subjects' },
            { serviceName: 'Parent-Child Music Class', duration: '45', price: '25.00', category: 'Music Program', description: 'Interactive music class for toddlers (18mo-3yrs) with parent participation' },
            { serviceName: 'Weekend Enrichment Workshop', duration: '120', price: '45.00', category: 'Weekend Program', description: 'Special workshops in science, art, or technology for school-age children' },
            { serviceName: 'Educational Assessment', duration: '90', price: '125.00', category: 'Assessment', description: 'Comprehensive developmental assessment and school readiness evaluation' }
          ]
        },
        {
          id: 'bookings',
          label: 'Bookings',
          icon: Calendar,
          columns: baseColumns.bookings,
          initialData: [
            { bookingId: 'EDU001', customerName: 'Sophia Williams (Age 4)', service: 'Full-Day Preschool Program', date: '2025-09-01', time: '7:30 AM', phone: '(555) 456-7890', status: 'Enrolled' },
            { bookingId: 'EDU002', customerName: 'Ethan Brown (Age 5)', service: 'Half-Day Kindergarten Prep', date: '2025-08-25', time: '9:00 AM', phone: '(555) 567-8901', status: 'Waitlisted' },
            { bookingId: 'EDU003', customerName: 'Ava Johnson (Age 7)', service: 'After-School Enrichment', date: '2025-08-19', time: '3:30 PM', phone: '(555) 678-9012', status: 'Confirmed' }
          ]
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: ShoppingCart,
          columns: baseColumns.orders,
          initialData: [
            { orderId: 'EDU001', customerName: 'Maria Garcia', date: '2025-08-16', total: '89.97', status: 'Shipped' },
            { orderId: 'EDU002', customerName: 'James Wilson', date: '2025-08-18', total: '34.99', status: 'Processing' }
          ]
        }
      ];

    default:
      return [];
  }
};

const tabs = getStoreData;

// Sample store data for header
const sampleStores = {
  'salon-1': { name: 'Bella Beauty Salon', type: 'salon' },
  'coach-1': { name: 'FitLife Personal Training', type: 'coach' },
  'craft-1': { name: 'Artisan Craft Studio', type: 'craft' },
  'education-1': { name: 'Little Scholars Academy', type: 'education' },
  'salon-2': { name: 'Glow Skincare Clinic', type: 'salon' },
  'coach-2': { name: 'Mindful Life Coaching', type: 'coach' },
};

export default function StoreManagement() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();

  const store = storeId ? sampleStores[storeId as keyof typeof sampleStores] : null;
  const storeData = storeId ? getStoreData(storeId) : [];

  if (!store || !storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Store not found</h1>
          <Button onClick={() => navigate('/')}>Return to Stores</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm relative z-50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="gap-2 relative z-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Stores
              </Button>
              <div className="flex items-center gap-3">
                <Building className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">{store.name}</h1>
                  <p className="text-muted-foreground capitalize">
                    {store.type} Management Dashboard
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue={storeData[0]?.id || "hours"} className="w-full">
          {/* Tab List - Google Sheets style bottom tabs */}
          <div className="bg-background border border-border rounded-lg overflow-hidden">
            <div className="h-[600px]">
              {storeData.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0 h-full">
                  <Spreadsheet
                    storeId={storeId || ''}
                    tabName={tab.id}
                    columns={tab.columns}
                    initialData={tab.initialData}
                  />
                </TabsContent>
              ))}
            </div>
            
            {/* Bottom tab navigation - Google Sheets style */}
            <div className="border-t border-border bg-muted/30">
              <TabsList className="h-auto bg-transparent p-0 w-full justify-start">
                {storeData.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="h-10 rounded-none border-r border-border last:border-r-0 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-b-primary gap-2 px-4"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
}