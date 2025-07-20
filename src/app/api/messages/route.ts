import { LocalMessage } from '@/chatbot/types/chat.type';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
	try {
		const { unsyncedMessages, conversationId } = await request.json();

		console.log("syncing called", unsyncedMessages, conversationId)
		const results = await Promise.all(
			unsyncedMessages.map(async (item: LocalMessage) => {
				try {
					const savedMessage = await prisma.message.create({
						data: {
							id: item.id,
							text: item.text,
							conversationId,
							sender: item.sender
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
						conversationId,
						id: item.id,
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
