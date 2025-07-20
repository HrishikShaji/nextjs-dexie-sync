import { LocalMessage } from '@/chatbot/types/chat.type';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
	try {
		const items = await request.json();

		console.log("syncing called", items)
		const results = await Promise.all(
			items.map(async (item: { message: LocalMessage, conversationId: string }) => {
				try {
					const savedMessage = await prisma.message.create({
						data: {
							id: item.message.id,
							text: item.message.text,
							conversationId: item.conversationId,
							sender: item.message.sender
						},
					});


					return {
						conversationId: savedMessage.conversationId,
						id: savedMessage.id,
						status: 'success'
					};
				} catch (error) {
					console.error('Error saving item:', error);
					return {
						conversationId: item.conversationId,
						id: item.message.id,
						status: 'error'
					};
				}
			})
		);
		console.log("syncing success", results)

		return NextResponse.json({
			success: true,
			results
		});
	} catch (error) {
		console.error('Sync error:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to sync conversations' },
			{ status: 500 }
		);
	}
}
