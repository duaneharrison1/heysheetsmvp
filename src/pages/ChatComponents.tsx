import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { H2, Lead } from '@/components/ui/heading';
import ChatBubble from '@/components/chat/ChatBubble';
import ChatMessage from '@/components/chat/ChatMessage';
import ProductCard from '@/components/chat/ProductCard';
import ServiceCard from '@/components/chat/ServiceCard';
import ServicesGrid from '@/components/chat/ServicesGrid';
import HoursList from '@/components/chat/HoursList';
import BookingCard from '@/components/chat/BookingCard';
import LeadForm from '@/components/chat/LeadForm';
import LeadFormWithSelection from '@/components/chat/LeadFormWithSelection';
import ProductDetailCard from '@/components/chat/ProductDetailCard';

const sampleProducts = [
	{
		name: 'Classic Coffee Mug',
		price: '12.99',
		stock: '8',
		description: 'A durable ceramic mug perfect for coffee lovers.',
	},
	{
		name: 'Ceramic Teapot',
		price: '24.0',
		stock: '5',
		description: 'Stylish teapot for the perfect brew.',
	},
	{
		name: 'Travel Tumbler',
		price: '18.5',
		stock: '12',
		description: 'Keep your drinks hot or cold on the go.',
	},
	{
		name: 'Espresso Set',
		price: '39.99',
		stock: '3',
		description: 'Two-cup espresso set with glass cups.',
	},
	{
		name: 'Coffee Scoop',
		price: '6.5',
		stock: '20',
		description: 'Precision scoop for the perfect dose.',
	},
	{
		name: 'Bean Sampler Pack',
		price: '14.99',
		stock: '0',
		description: 'Try three single-origin coffees.',
	},
];

const sampleService = {
	serviceName: 'Haircut - Classic',
	duration: 45,
	category: 'Grooming',
	price: '29.00',
	description: "A classic men's haircut with a relaxing finish.",
};

const sampleHours = [
	{ day: 'Monday', isOpen: 'Yes', openTime: '9:00', closeTime: '17:00' },
	{ day: 'Tuesday', isOpen: 'Yes', openTime: '9:00', closeTime: '17:00' },
	{ day: 'Sunday', isOpen: 'No' },
];

const sampleBooking = {
	service: 'Haircut - Classic',
	status: 'Confirmed',
	date: '2025-11-20',
	time: '10:30',
	phone: '+1 555 123 4567',
};

const sampleMessageProducts = {
	id: 'm-products',
	type: 'bot' as const,
	content: 'Here are some products from the shop — swipe or use the arrows on desktop.',
	timestamp: new Date(),
	richContent: {
		type: 'products',
		data: sampleProducts,
	},
};

const sampleMessageServices = {
	id: 'm-services',
	type: 'bot' as const,
	content: 'We offer these services.',
	timestamp: new Date(),
	richContent: {
		type: 'services',
		data: [sampleService],
	},
};

const sampleMessageHours = {
	id: 'm-hours',
	type: 'bot' as const,
	content: 'Our operating hours are below.',
	timestamp: new Date(),
	richContent: {
		type: 'hours',
		data: sampleHours,
	},
};

const sampleMessageBookings = {
	id: 'm-bookings',
	type: 'bot' as const,
	content: 'Recent bookings.',
	timestamp: new Date(),
	richContent: {
		type: 'bookings',
		data: [sampleBooking],
	},
};

const sampleMessageQuick = {
	id: 'm-quick',
	type: 'bot' as const,
	content: 'Quick actions you can try.',
	timestamp: new Date(),
	richContent: {
		type: 'quick_actions',
		data: ['View menu', 'Book appointment', 'Contact support'],
	},
};

const sampleProductDetail = {
	title: 'Classic Coffee Mug',
	price: '$12.99',
	images: [
		'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
		'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
	],
	description:
		'A durable ceramic mug perfect for coffee lovers. Dishwasher and microwave safe. Holds 12oz.',
	specifications: (
		<ul className="list-disc pl-4 text-sm">
			<li>Material: Ceramic</li>
			<li>Capacity: 12oz</li>
			<li>Color: White</li>
			<li>Safe for dishwasher & microwave</li>
		</ul>
	),
	reviews: (
		<div className="space-y-2 text-sm">
			<div>
				<strong>Jane:</strong> Love this mug! Keeps my coffee warm.
			</div>
			<div>
				<strong>Alex:</strong> Simple and sturdy. Great value.
			</div>
		</div>
	),
};

const ChatComponentsShowcase: React.FC = () => {
	return (
		<div className="p-6 md:p-12">
			<div className="max-w-[1400px] mx-auto">
				<div className="mb-6">
					<H2 className="mb-1">Chat Components Showcase</H2>
					<Lead>
						A public demo page showing previews of chat-related components used
						across the app.
					</Lead>
				</div>

				<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Chat Bubbles</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-start">
									<ChatBubble type="bot" timestamp={new Date()}>
										<div className="text-sm">
											This is a bot bubble — it supports aria-live and timestamps.
										</div>
									</ChatBubble>
								</div>
								<div className="flex items-end justify-end">
									<ChatBubble type="user" timestamp={new Date()}>
										<div className="text-sm">This is a user bubble.</div>
									</ChatBubble>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="xl:col-span-2">
						<CardHeader>
							<CardTitle>Chat Message (with rich content)</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								<div className="border-l-2 border-muted pl-3">
									<div className="text-xs text-muted-foreground mb-2">
										Products Carousel
									</div>
																	<ChatMessage
																				message={sampleMessageProducts}
																				storeLogo={''}
																				storeId={''}
																				conversationHistory={[]}
																				onActionClick={(a, d) => console.log('action', a, d)}
																		/>
								</div>
								<div className="border-l-2 border-muted pl-3">
									<div className="text-xs text-muted-foreground mb-2">
										Services Grid
									</div>
																<ServicesGrid
																	services={sampleMessageServices.richContent.data}
																	onActionClick={(a, d) => console.log('action', a, d)}
																/>
								</div>
								<div className="border-l-2 border-muted pl-3">
									<div className="text-xs text-muted-foreground mb-2">
										Hours List
									</div>
									<ChatMessage
										message={sampleMessageHours}
										storeLogo={''}
										storeId={''}
										conversationHistory={[]}
										onActionClick={(a, d) => console.log('action', a, d)}
									/>
								</div>
								<div className="border-l-2 border-muted pl-3">
									<div className="text-xs text-muted-foreground mb-2">
										Bookings Grid
									</div>
									<ChatMessage
										message={sampleMessageBookings}
										storeLogo={''}
										storeId={''}
										conversationHistory={[]}
										onActionClick={(a, d) => console.log('action', a, d)}
									/>
								</div>
								<div className="border-l-2 border-muted pl-3">
									<div className="text-xs text-muted-foreground mb-2">
										Quick Actions
									</div>
									<ChatMessage
										message={sampleMessageQuick}
										storeLogo={''}
										storeId={''}
										conversationHistory={[]}
										onActionClick={(a, d) => console.log('action', a, d)}
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="mt-8">
					<h3 className="text-lg font-semibold mb-4">Individual Components</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
						<div>
							<div className="text-xs text-muted-foreground mb-2 font-medium">
								ProductCard
							</div>
							<ProductCard
								product={sampleProducts[0]}
								onActionClick={(a, d) => console.log(a, d)}
							/>
						</div>

						<div>
							<div className="text-xs text-muted-foreground mb-2 font-medium">
								ServiceCard
							</div>
							<ServiceCard
								service={sampleService}
								onActionClick={(a, d) => console.log(a, d)}
							/>
						</div>

						<div>
							<div className="text-xs text-muted-foreground mb-2 font-medium">
								HoursList
							</div>
							<HoursList hours={sampleHours} />
						</div>

						<div>
							<div className="text-xs text-muted-foreground mb-2 font-medium">
								BookingCard
							</div>
							<BookingCard
								booking={sampleBooking}
								onActionClick={(a, d) => console.log(a, d)}
							/>
						</div>

						<div>
							<div className="text-xs text-muted-foreground mb-2 font-medium">
								LeadForm
							</div>
							<LeadForm stackButtons onSubmit={(d) => console.log('lead', d)} />
						</div>

						<div>
							<div className="text-xs text-muted-foreground mb-2 font-medium">
								Contact With Selection
							</div>
							<LeadFormWithSelection
								products={sampleProducts}
								services={[sampleService]}
								onSubmit={(d) => console.log('contact about', d)}
							/>
						</div>

						<div>
							<div className="text-xs text-muted-foreground mb-2 font-medium">
								ProductDetailCard
							</div>
							<ProductDetailCard {...sampleProductDetail} />
						</div>
					</div>
				</div>

				<Separator className="my-8" />

				<div className="flex gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={() => (window.location.href = '/')}
					>
						Back to app
					</Button>
					<Button
						size="sm"
						onClick={() =>
							window.open('/components/chat', '_blank')
						}
					>
						Open this page in new tab
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ChatComponentsShowcase;